# SuperCrew MVP — `.supercrew/` Schema + Kanban + AI Plugin

**TL;DR:** 基于 `user/steinsz/supercrew_schema` 分支的 demo 实现，将 kanban 从 `.team/` 资源导向 完全迁移到 `.supercrew/features/` feature 导向的数据模型。MVP 包含三大模块：(1) AI 集成插件（skills + hooks + pre-commit）在用户 repo 中创建和管理 `.supercrew/` 目录，(2) 后端通过 GitHub API（OAuth）只读访问用户 repo 中的 `.supercrew/` 数据，(3) 前端看板以只读方式渲染 feature-centric 视图。参考 [superpowers](https://github.com/obra/superpowers) 的插件架构和 [vibe-kanban](https://github.com/BloopAI/vibe-kanban) 的 issue→workspace 模式。插件在 monorepo 的 `plugins/supercrew/` 子目录开发，MVP 阶段通过绝对路径加载（`/plugin marketplace add /path/to/supercrew/plugins/supercrew`），Post-MVP 抽取为独立 repo 后发布到 marketplace。

### 数据流架构

```
用户 Repo（数据源）              Kanban 服务（只读展示）
┌─────────────────────┐        ┌──────────────────────┐
│  .supercrew/        │        │  Vercel (后端)        │
│    features/        │        │                      │
│      feature-a/     │        │  GitHub API ──读取──►│
│        meta.yaml    │        │  (OAuth)             │
│        design.md    │        │                      │
│        plan.md      │        │  前端（只读看板）      │
│        log.md       │        │                      │
└─────────────────────┘        └──────────────────────┘
        ▲                              ▲
        │                              │
  Claude Code 插件               用户浏览器
  (本地写入 → git push)          (OAuth 登录 → 查看看板)
```

**关键原则：**
- **写入方唯一：** Claude Code 插件在用户本地 repo 操作 `.supercrew/`，通过 git commit + push 同步
- **读取方唯一：** Kanban 服务通过 OAuth 获取的 GitHub access_token 调用 GitHub Contents API 读取
- **Kanban 完全只读：** 不提供任何写入 API，不修改用户 repo 中的数据

---

## Phase 1: AI 集成插件（数据写入方）

**目标：** 在 monorepo 的 `plugins/supercrew/` 子目录下创建 Claude Code 插件，在用户 repo 中自动创建和管理 `.supercrew/` 目录。这是唯一的数据写入方。参考 superpowers 的 skills/hooks/commands 架构。

**Monorepo 策略：** 插件代码保留在 `plugins/supercrew/`，与 `kanban/` 共存于同一 repo。Claude Code marketplace 要求 plugin 为独立 repo（整个 repo = plugin 根目录），因此：
- **MVP 阶段**：通过绝对路径加载 — `/plugin marketplace add /path/to/supercrew/plugins/supercrew`（在任意 repo 中均可安装），`plugins/supercrew/` 内含 `.claude-plugin/marketplace.json`（`"source": "./"`），结构与独立 repo 一致
- **Post-MVP**：将 `plugins/supercrew/` 抽取为独立 repo（如 `supercrew-plugin`），注册到 marketplace，用户可通过 `/plugin install supercrew@marketplace` 安装
- **目录结构已按独立 repo 标准设计**，抽取时无需重构

### 1.1 插件目录结构
```
plugins/supercrew/
├── .claude-plugin/marketplace.json    # 发布到 Claude Code marketplace
├── skills/
│   ├── create-feature/SKILL.md        # 创建 feature 目录 + 4 文件
│   ├── update-status/SKILL.md         # 状态流转
│   ├── sync-plan/SKILL.md             # 生成/更新 plan.md
│   └── log-progress/SKILL.md         # 追加 log.md
├── commands/
│   ├── new-feature.md                 # /new-feature slash command
│   └── feature-status.md             # /feature-status slash command
├── hooks/
│   ├── hooks.json                     # SessionStart hook
│   └── session-start                  # 注入 .supercrew context
├── agents/
│   └── supercrew-manager.md           # 综合管理 agent
└── templates/
    ├── meta.yaml.tmpl
    ├── design.md.tmpl
    ├── plan.md.tmpl
    └── log.md.tmpl
```

### 1.2 Schema 定义（插件内共享）
- 定义 `SupercrewStatus` 枚举：`planning → designing → ready → active → blocked → done`
- 定义 `FeaturePriority`: `P0 | P1 | P2 | P3`
- `.supercrew/features/<feature-id>/` 下 4 个文件：
  - `meta.yaml`：必填字段 `id`, `title`, `status`, `owner`, `priority`；可选 `teams`, `target_release`, `created`, `updated`, `tags`, `blocked_by`
  - `design.md`：YAML frontmatter（`status: draft|in-review|approved|rejected`, `reviewers`, `approved_by`）+ markdown body
  - `plan.md`：YAML frontmatter（`total_tasks`, `completed_tasks`, `progress`）+ workitem breakdown markdown
  - `log.md`：纯 markdown 追加日志

### 1.3 Skills 实现
- **`create-feature`**: 用户描述需求 → AI 通过 PRD 讨论提炼 → 在 `.supercrew/features/<id>/` 下生成 `meta.yaml`（自动填充 id、title、owner、priority、status=planning、dates）+ `design.md`（初始 draft 模板）+ `plan.md`（空结构）+ `log.md`（初始化记录）
- **`update-status`**: 根据代码/commit 状态自动判断并更新 `meta.yaml` 中的 status 字段，遵循合法状态转换图
- **`sync-plan`**: 在 design 完成后，基于 `design.md` 内容生成 `plan.md` 中的 task breakdown；coding 阶段持续更新 `completed_tasks`/`progress`
- **`log-progress`**: 每次 session 结束时自动追加 `log.md`，记录本次工作内容、完成的 tasks、遇到的问题

### 1.4 Hooks
- **SessionStart**: 检测当前 repo 是否有 `.supercrew/features/` → 有则执行 **Active Feature 匹配**，确定当前 session 聚焦的 feature：
  1. **Git branch 名匹配**（优先）：当前分支名 `feature/<id>` → 自动关联 `.supercrew/features/<id>/`，注入该 feature 的完整 context（meta + design + plan progress + 最近 log）。无论是普通 checkout 还是 git worktree 均适用（均通过 `git branch --show-current` 读取）
  2. **用户显式选择**：无匹配时，列出所有 `status != done` 的 features 摘要表（id | title | status | progress），请求用户确认："当前 session 聚焦哪个 feature？"
  3. 确认后，后续 `update-status`、`sync-plan`、`log-progress` 等 skill 自动作用于该 feature
  4. 始终注入所有 feature 的简要列表到 context（确保 AI 知道全局状态），但仅对 active feature 注入详细信息
  - **注**：MVP 不强制使用 git worktree，branch 匹配对 checkout 和 worktree 均兼容。Worktree 自动化生命周期管理在 Post-MVP 引入（见 Next Steps Iteration 1）
- **pre-commit hook**: 校验 `.supercrew/features/*/meta.yaml` 的 schema 合法性（必填字段、status 枚举值、priority 枚举值）；校验 `plan.md` frontmatter 的 `total_tasks ≥ completed_tasks`

### 1.5 Commands
- **`/new-feature`**: 触发 `create-feature` skill，交互式创建新 feature
- **`/feature-status`**: 显示所有 feature 的当前状态概览（表格形式：id | title | status | progress | owner）
- **`/work-on <feature-id>`**: 切换当前 session 聚焦的 feature（覆盖 SessionStart 的自动匹配结果），后续所有 skill 操作自动作用于该 feature

### 1.6 Agent
- **`supercrew-manager`**: 综合 agent，可以执行所有 skills，负责在适当时机自动调用 `update-status`、`sync-plan`、`log-progress`

---

## Phase 2: Schema 基础设施 — 后端（只读）

**目标：** Kanban 后端通过 GitHub API（OAuth）只读访问用户 repo 中的 `.supercrew/features/` 数据。不提供任何写入 API。

### 2.1 定义 TypeScript 类型
- 基于 commit `62cd395f` 的 `SupercrewStatus`、`FeatureMeta` 类型，在 `kanban/backend/src/types/index.ts` 中替换现有 `Task`/`Sprint` 等类型
- 新增类型：`FeatureMeta`（meta.yaml）、`DesignDoc`（design.md frontmatter + body）、`PlanDoc`（plan.md frontmatter + tasks breakdown）、`FeatureLog`（log.md）
- 定义 `SupercrewStatus`、`FeaturePriority` 类型（与插件 schema 保持一致）
- 使用 `zod` 做读取时的运行时校验（解析 meta.yaml 时验证字段合法性）

### 2.2 重写 GitHub Store（只读）
- 将 `kanban/backend/src/store/github-store.ts` 改为通过 GitHub Contents API **只读** 访问 `.supercrew/features/` 路径
- 复用现有的 `ghGet` pattern，路径从 `.team/tasks/` 改为 `.supercrew/features/<id>/`
- 实现：`listFeatures()`（列出所有 feature 目录）、`getFeatureMeta(id)`、`getFeatureDesign(id)`、`getFeaturePlan(id)`、`getFeatureLog(id)`
- 移除所有 `ghPut`/`ghDelete` 调用 — Kanban 不写入用户 repo

### 2.3 重写 Local Store（只读，仅开发调试用）
- 将 `kanban/backend/src/store/index.ts` 改为只读访问本地 `.supercrew/features/` 目录
- 用于本地开发时 mock 数据（读取本地 `.supercrew/features/` 目录中的文件）
- 不包含任何写入逻辑

### 2.4 重写 API Routes（只读）
- 将 `kanban/backend/src/routes/` 下的 `tasks.ts`、`sprints.ts`、`people.ts`、`knowledge.ts`、`decisions.ts` 合并/替换为：
  - `features.ts`：**仅 GET 端点**
    - `GET /api/features` — 列出所有 features（meta 摘要）
    - `GET /api/features/:id` — 获取单个 feature 完整信息
    - `GET /api/features/:id/design` — 获取 design.md
    - `GET /api/features/:id/plan` — 获取 plan.md（含 progress）
  - `GET /api/board` — 聚合 endpoint，将 features 按 status 映射到看板列
- 保留 auth 路由（`auth.ts`）和 projects 路由（`projects.ts`：OAuth 绑定 repo）不变
- 移除 `SUPERCREW_DEMO` 环境变量守卫
- `GET /api/projects/github/repos/:owner/:repo/init-status` 改为检查 `.supercrew/features/` 是否存在
- 移除 `POST /api/projects/github/repos/:owner/:repo/init` — 不再由 Kanban 服务初始化

### 2.5 删除遗留代码
- 移除 `.team/` 相关的所有 store 逻辑、路由、类型
- 移除 `Sprint`、`Person`、`KnowledgeEntry`、`Decision` 类型（MVP 阶段只聚焦 Feature）
- 清理 `index.ts` 中的路由注册

---

## Phase 3: 前端看板重构（只读）

**目标：** 用 feature-centric 只读视图替代现有 task-centric 看板。不提供任何数据修改操作。

### 3.1 数据层重构
- 更新 `kanban/frontend/packages/app-core/src/types.ts`：用 `Feature`（含 meta + design status + plan progress）替代 `Task`/`Sprint` 等
- 更新 `kanban/frontend/packages/app-core/src/api.ts`：仅保留只读 API 调用
  - `fetchFeatures()` — 获取所有 features 列表
  - `fetchFeature(id)` — 获取单个 feature 详情
  - `fetchFeatureDesign(id)` — 获取 design.md
  - `fetchFeaturePlan(id)` — 获取 plan.md
  - `fetchBoard()` — 获取看板聚合数据
- 移除所有 `create`/`update`/`delete` 相关的 API 调用和 mutations
- 更新 `useBoard()` hook：返回 `{ features, featuresByStatus, isLoading, error }`
- 移除 `useMutations()` hook — 看板无写操作

### 3.2 看板主视图
- 重构 `kanban/frontend/packages/ui/` 中的 `KanbanBoard` 组件
- 6 列布局对应 status：`Planning | Designing | Ready | Active | Blocked | Done`
- Feature 卡片显示：`title`、`priority` badge（P0 红/P1 橙/P2 蓝/P3 灰）、`owner`、`teams` tags、plan `progress` 进度条
- **无拖拽功能** — 看板只读，status 变更由 Claude Code 插件在用户 repo 中完成
- 参考 vibe-kanban 的卡片 UI 风格：简洁、信息密度高
- 点击卡片 → 跳转 Feature 详情页

### 3.3 Feature 详情页
- 新建 `/features/:id` 路由，替代原 `/tasks/:id`
- 三 Tab 布局：**Overview**（meta.yaml 渲染：owner、priority、teams、target_release、tags、dates）、**Design**（design.md markdown 渲染 + status/reviewer 信息）、**Plan**（plan.md 渲染：进度条 + task checklist 可视化，类似 societas floating todo bar）
- Design tab 显示 review status badge（draft/in-review/approved/rejected）
- Plan tab 显示 `completed_tasks/total_tasks` 进度 + 每个 workitem 的完成状态
- 所有内容只读展示，不提供编辑功能

### 3.4 FRE 与空状态处理
- 更新 Welcome wizard：OAuth 登录 → Select Repo（绑定已有 repo）
- **不再提供 Init 功能** — `.supercrew/` 目录由 Claude Code 插件创建
- 空状态处理：
  - repo 中不存在 `.supercrew/features/` → 显示空看板 + 引导提示："请在该 repo 中安装 SuperCrew 插件并使用 `/new-feature` 创建第一个 feature"
  - repo 中存在 `.supercrew/features/` 但内容为空 → 类似引导

### 3.5 清理遗留页面
- 移除 `/people`、`/knowledge`、`/decisions` 页面和底部导航对应入口
- 移除拖拽相关组件和依赖（`@hello-pangea/dnd` 可移除）
- 底部导航简化为：**Board**（feature 看板）
- 保留 dark/light theme 和 i18n

---

## Phase 4: 集成与测试

### 4.1 插件测试
- 在 Claude Code 中加载插件 → 执行 `/new-feature` → 验证 `.supercrew/features/<id>/` 下 4 个文件正确生成
- 测试 `/feature-status` 输出
- 测试 `update-status`、`sync-plan`、`log-progress` skills
- 测试 pre-commit hook schema 校验（故意写错 meta.yaml → 应拦截 commit）
- 测试 SessionStart hook 注入 context

### 4.2 后端测试
- 为 supercrew GitHub store 写单元测试（vitest）：只读列出 features、解析 meta.yaml/design.md/plan.md
- 为 features API 写集成测试：只读 GET 端点 + auth
- 测试 `.supercrew/` 不存在时返回空数组

### 4.3 前端测试
- Feature card 组件测试
- Board 视图测试（6 列布局、正确分组）
- Feature 详情页 Tab 切换测试
- 空状态 UI 测试（无 `.supercrew/` 时的引导状态）

### 4.4 端到端集成测试
- 完整 flow：
  1. 用户 repo A 安装 Claude Code 插件
  2. 在 repo A 中使用 `/new-feature` 创建 feature
  3. `git commit && git push` 到 main
  4. 在 Kanban 网页中 OAuth 绑定 repo A
  5. 看板正确显示 feature 数据
  6. 在 repo A 中用插件更新 status/plan → push → 看板数据刷新

### 4.5 部署验证
- Vercel 部署验证：确保 GitHub store 正确只读访问 `.supercrew/` 路径
- 运行 `kanban/scripts/verify-before-deploy.sh`

---

## Verification
- `cd kanban && bun test` — 后端单元测试
- `cd kanban/frontend && pnpm test` — 前端测试
- 插件测试：在 Claude Code 中加载插件 → 执行 `/new-feature` → 验证文件生成 → commit 触发 pre-commit hook → push 到 main
- 端到端测试：在 test repo 中用插件创建 feature + push → 在 Kanban 网页 OAuth 绑定该 repo → 看板正确展示 feature 数据 → 查看详情页

---

## Decisions
- **`.team/` 完全弃用**：MVP 不做兼容，直接替换。简化实现复杂度。
- **Feature-centric 而非 Task-centric**：看板的最小单位是 feature，不再是 task。Task 作为 plan.md 内的 checklist 存在。
- **插件在 monorepo 子目录开发**：`plugins/supercrew/` 保留在 monorepo 中，MVP 通过绝对路径加载 `/plugin marketplace add /path/to/supercrew/plugins/supercrew`（在任意 repo 中均可安装）。目录结构按独立 repo 标准设计（`.claude-plugin/` 在 `plugins/supercrew/` 根），Post-MVP 抽取为独立 repo 后可直接发布到 marketplace，无需重构。
- **Sprint/People/Knowledge/Decisions 移除**：MVP 聚焦 feature lifecycle，这些概念不在 `.supercrew/` schema 中，不保留。
- **log.md 保留**：虽然讨论文档未提及，但 demo 分支已实现，作为 AI context 很有价值，保留。
- **Design review 纳入 MVP**：`design.md` 的 `status/reviewer/approved_by` 字段保留，在详情页展示。在 pre-commit hook 中不强制校验。
- **Kanban 完全只读**：看板服务不写入用户 repo，所有数据变更由 Claude Code 插件在本地完成后 push。
- **插件优先开发**：Phase 顺序调整为插件→后端→前端，因为没有插件就没有数据可读。
- **无 Init API**：Kanban 不负责初始化 `.supercrew/` 目录，由插件负责。看板对未初始化的 repo 显示空状态 + 引导。
- **无拖拽**：看板只读，不提供拖拽修改 status 的功能。
- **MVP 不含 Sprint**：30 人团队未来需要时间节奏，但 MVP 先聚焦 feature lifecycle。Sprint 机制在 Post-MVP 迭代中引入（见 Next Steps）。
- **上线/Release 协调 Post-MVP**：MVP 不包含 release train 或 deployment 协调功能。Post-MVP 根据团队实际需求决定是否引入。

---

## Next Steps — Post-MVP 迭代规划

MVP 解决了 Layer 2（团队协调层）中"项目管理可见性"和"设计/文档强制性"两大核心缺口。以下迭代聚焦补齐剩余 gap：**跨组协调**、**时间节奏（Sprint）**、**Agent 能力深化**、**上线协调**。

### Iteration 1: supercrew-manager Agent 能力增强 + Worktree 自动化

MVP 的 `supercrew-manager` agent 描述过于简略。参考 `ddd-tech-lead` agent 的设计深度，迭代 1 补充完整的 agent prompt 设计。同时引入 git worktree 自动化，消除 MVP 阶段手动管理分支的摩擦。

#### 1.1 决策指引框架
- **Feature 识别**：用户描述需求时，自动判断是新建 feature 还是归属已有 feature
- **状态推断规则**：根据代码变更、commit 内容、test 结果自动推断 status 转换（例：design.md status 从 draft → approved 后，自动建议 feature status 从 designing → ready）
- **优先级升降规则**：根据 `blocked_by` 依赖链和 deadline 接近程度，主动提醒优先级调整
- **Context 注入策略**：SessionStart 时不只列出 feature 列表，而是智能摘要——突出 blocked features、临近 deadline 的 features、长期无更新的 features

#### 1.2 自检清单（Self-Verification）
Agent 在每次操作前/后执行自检：
1. 目标 feature 文件夹是否存在？不存在是否应创建？
2. `meta.yaml` 中所有必填字段是否完整？
3. `plan.md` 的 `completed_tasks` 是否与实际 checklist 一致？
4. `log.md` 是否已记录本次 session 的工作内容？
5. 是否有 `blocked_by` 指向的 feature 已经完成但未更新？
6. 是否有跨 feature 的架构影响需要在 `design.md` 中记录？

#### 1.3 主动行为（Proactive Behaviors）
- 检测到用户长时间在某 feature 上工作但未更新 `log.md` → 主动提醒记录
- 检测到 `plan.md` 中 `completed_tasks` 落后于实际 commit → 主动建议同步
- 检测到多个 features 的 `blocked_by` 形成环形依赖 → 告警
- Session 结束前自动执行 `log-progress` skill
- 检测到新 feature 的 `design.md` 仍为 draft 但 status 已到 active → 警告跳过设计审查

#### 1.4 沟通风格
- 状态更新简洁直接，用结构化格式（表格、列表）
- 关键决策需提供上下文说明
- 需求模糊时主动提出澄清问题
- 区分 Critical/Important/Minor 事项

#### 1.5 Git Worktree 自动化
MVP 阶段用户手动管理分支，Iter 1 引入 worktree 自动化生命周期管理，消除手动操作摩擦：
- **`/new-feature` 增强**：创建 feature 时自动执行 `git worktree add .worktrees/<id> feature/<id>` + 安装依赖 + 提示用户在新窗口打开该目录
- **`/close-feature <id>`**（新增 command）：merge/PR + `git worktree remove` + 清理分支，用户无需了解 worktree 命令
- **SessionStart hook** 在 worktree 下天然准确匹配 active feature（每个 worktree 锁定一个 branch，不存在 session 中途切分支的问题）
- 兼容 superpowers 的 `using-git-worktrees` skill

### Iteration 2: Sprint 机制引入

为 30 人团队引入时间节奏，在 feature 下嵌套 Sprint 结构：

#### 2.1 Schema 扩展
```
.supercrew/
  features/
    feature-a/
      meta.yaml
      design.md
      plan.md
      log.md
      sprints/                     # 新增
        sprint_260303/             # YYMMDD 格式
          goals.md                 # Sprint 目标
          tasks.md                 # 本 Sprint 的 task breakdown + 状态
          retro.md                 # Sprint 回顾（可选）
```

- `meta.yaml` 新增可选字段：`current_sprint: sprint_260303`
- `tasks.md` 结构：YAML frontmatter（`sprint_start`, `sprint_end`, `velocity_planned`, `velocity_actual`）+ task checklist（每项含 assignee、status、estimate）
- `goals.md`：本 Sprint 在该 feature 上要达成的目标
- `retro.md`：Sprint 结束时由 AI 自动生成回顾摘要

#### 2.2 插件新增 Skills
- **`create-sprint`**：在指定 feature 下创建 `sprints/sprint_YYMMDD/` 目录 + 初始文件
- **`close-sprint`**：汇总完成情况，生成 `retro.md`，更新 `plan.md` progress
- **`sprint-status`**：展示当前 Sprint 的 task 完成情况

#### 2.3 看板前端扩展
- Feature 详情页新增 **Sprint** Tab：展示当前 Sprint 的 task 列表、进度、燃尽图
- 看板卡片可展示当前 Sprint 进度（可选 toggle）
- Sprint 历史视图：查看历次 Sprint 的 velocity 趋势

#### 2.4 Commands
- **`/new-sprint`**：在当前 feature 下创建新 Sprint
- **`/sprint-review`**：展示当前 Sprint 摘要 + 建议关闭

### Iteration 3: 跨 Feature 协调与依赖可视化

解决"小组之间不通气"的核心问题：

#### 3.1 依赖图可视化
- 前端新增 **Dependencies** 视图：基于所有 features 的 `blocked_by` 字段，渲染有向依赖图
- 高亮环形依赖（红色标注）
- 高亮关键路径（影响最多下游 feature 的上游）

#### 3.2 `notes.md` 引入
- 在 feature 文件中新增 `notes.md`：用于非结构化的研究笔记、讨论记录、补充上下文（参考 DDD 的 `notes.md`）
- `log.md` 保持时间线追加语义，`notes.md` 用于随意记录

#### 3.3 跨 Feature 变更通知
- 看板前端新增简单的 **Activity Feed**：聚合所有 features 的最近变更（基于 git commit 时间戳 + log.md 最新条目）
- 按团队（`teams` 字段）筛选 feed，实现"看到其他组在做什么"

#### 3.4 架构治理
- 新增 `.supercrew/architecture/` 目录（可选）：存放全局 ADR（Architecture Decision Records）
- Agent 在 `design.md` 涉及跨 feature 架构变更时，自动建议创建/更新 ADR

### Iteration 4: Release 协调

解决"上线难度高"的问题：

#### 4.1 Release 概念引入
- 新增 `.supercrew/releases/` 目录：每个 release 一个文件夹
- `release.yaml`：`version`, `target_date`, `features[]`（包含的 feature id 列表）, `status`（planning/staging/released）
- 看板新增 **Release** 视图：按 release 分组展示 features 及其就绪状态

#### 4.2 Release Readiness 检查
- Agent 新增 **`release-check`** skill：扫描 release 中所有 features，检查是否全部 `status=done`、`design.md` approved、`plan.md` progress=100%
- 前端展示 release readiness dashboard（红/黄/绿信号灯）

### 迭代优先级与时间线

| 迭代 | 聚焦 | 解决的 Layer 2 问题 | 建议时间 |
|---|---|---|---|
| **MVP** | Feature lifecycle + 只读看板 | 项目管理、设计/文档 | 当前 |
| **Iter 1** | Agent 能力增强 + Worktree 自动化 | 提升自动化程度，减少人工维护负担，消除分支管理摩擦 | MVP 后 1-2 周 |
| **Iter 2** | Sprint 机制 | 时间节奏、任务粒度管理 | Iter 1 后 2-3 周 |
| **Iter 3** | 跨 Feature 协调 | 小组不通气、架构治理 | Iter 2 后 2-3 周 |
| **Iter 4** | Release 协调 | 上线难度高 | Iter 3 后 2-3 周 |
