# SuperCrew MVP — `.supercrew/` Schema + Kanban + AI Plugin

**TL;DR:** 基于 `user/steinsz/supercrew_schema` 分支的 demo 实现，将 kanban 从 `.team/` 资源导向 完全迁移到 `.supercrew/features/` feature 导向的数据模型。MVP 包含三大模块：(1) AI 集成插件（skills + hooks + pre-commit）在用户 repo 中创建和管理 `.supercrew/` 目录，(2) 后端通过 GitHub API（OAuth）只读访问用户 repo 中的 `.supercrew/` 数据，(3) 前端看板以只读方式渲染 feature-centric 视图。参考 [superpowers](https://github.com/obra/superpowers) 的插件架构和 [vibe-kanban](https://github.com/BloopAI/vibe-kanban) 的 issue→workspace 模式。

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

**目标：** 创建独立插件，在用户 repo 中自动创建和管理 `.supercrew/` 目录。这是唯一的数据写入方。参考 superpowers 的 skills/hooks/commands 架构，独立发布到 marketplace。

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
- **SessionStart**: 检测当前 repo 是否有 `.supercrew/features/` → 有则注入所有 feature 的 meta 信息到 context → 提示 AI 当前活跃 feature 和进度
- **pre-commit hook**: 校验 `.supercrew/features/*/meta.yaml` 的 schema 合法性（必填字段、status 枚举值、priority 枚举值）；校验 `plan.md` frontmatter 的 `total_tasks ≥ completed_tasks`

### 1.5 Commands
- **`/new-feature`**: 触发 `create-feature` skill，交互式创建新 feature
- **`/feature-status`**: 显示所有 feature 的当前状态概览（表格形式：id | title | status | progress | owner）

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
- **插件独立于 superpowers**：降低耦合，独立发布到 marketplace。Post-MVP 可以与 superpowers 融合。
- **Sprint/People/Knowledge/Decisions 移除**：MVP 聚焦 feature lifecycle，这些概念不在 `.supercrew/` schema 中，不保留。
- **log.md 保留**：虽然讨论文档未提及，但 demo 分支已实现，作为 AI context 很有价值，保留。
- **Design review 纳入 MVP**：`design.md` 的 `status/reviewer/approved_by` 字段保留，在详情页展示。在 pre-commit hook 中不强制校验。
- **Kanban 完全只读**：看板服务不写入用户 repo，所有数据变更由 Claude Code 插件在本地完成后 push。
- **插件优先开发**：Phase 顺序调整为插件→后端→前端，因为没有插件就没有数据可读。
- **无 Init API**：Kanban 不负责初始化 `.supercrew/` 目录，由插件负责。看板对未初始化的 repo 显示空状态 + 引导。
- **无拖拽**：看板只读，不提供拖拽修改 status 的功能。
