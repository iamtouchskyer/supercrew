# SuperCrew MVP — `.supercrew/` Schema + Kanban + AI Plugin

**TL;DR:** 基于 `user/steinsz/supercrew_schema` 分支的 demo 实现，将 kanban 从 `.team/` 资源导向 完全迁移到 `.supercrew/features/` feature 导向的数据模型。MVP 包含三大模块：(1) 后端 store + API 替换为 `.supercrew/` schema，(2) 前端看板重构为 feature-centric 视图，(3) AI 集成插件（skills + hooks + pre-commit）实现 `.supercrew/` 目录的自动化管理。参考 [superpowers](https://github.com/obra/superpowers) 的插件架构和 [vibe-kanban](https://github.com/BloopAI/vibe-kanban) 的 issue→workspace 模式。

---

## Phase 1: Schema 基础设施 — 后端迁移

**目标：** 用 `.supercrew/features/` 替换 `.team/`，后端只认 `.supercrew/`。

### 1.1 定义 TypeScript 类型与 Schema 校验
- 基于 commit `62cd395f` 的 `SupercrewStatus`、`FeatureMeta` 类型，在 `kanban/backend/src/types/index.ts` 中替换现有 `Task`/`Sprint` 等类型
- 新增类型：`FeatureMeta`（meta.yaml）、`DesignDoc`（design.md frontmatter + body）、`PlanDoc`（plan.md frontmatter + tasks breakdown）、`FeatureLog`（log.md）
- 定义 `SupercrewStatus` 枚举：`planning → designing → ready → active → blocked → done`
- 新增 `FeaturePriority`: `P0 | P1 | P2 | P3`
- 使用 `zod` 做运行时校验（meta.yaml 必填字段：`id`, `title`, `status`, `owner`, `priority`）

### 1.2 重写 Local Store
- 将 `kanban/backend/src/store/index.ts` 改为读写 `.supercrew/features/` 目录
- 每个子目录 = 一个 feature，读取 `meta.yaml`（用 `js-yaml`）、`design.md`（用 `gray-matter`）、`plan.md`（用 `gray-matter`）、`log.md`
- CRUD：创建 feature = 创建子目录 + 4 个模板文件；更新 = 写入对应文件；删除 = 删除整个子目录
- Status 流转逻辑放在 store 层（校验合法转换）

### 1.3 重写 GitHub Store
- 将 `kanban/backend/src/store/github-store.ts` 改为通过 GitHub Contents API 读写 `.supercrew/features/` 路径
- 复用现有的 `ghGet`/`ghPut`/`ghDelete` pattern，路径从 `.team/tasks/` 改为 `.supercrew/features/<id>/`
- Init 端点改为初始化 `.supercrew/features/` 目录（替代 `.team/`）

### 1.4 重写 API Routes
- 将 `kanban/backend/src/routes/` 下的 `tasks.ts`、`sprints.ts`、`people.ts`、`knowledge.ts`、`decisions.ts` 合并/替换为：
  - `features.ts`：`GET/POST/PATCH/DELETE /api/features`，`PUT /api/features/:id/status`
  - `GET /api/features/:id/design` — 获取 design.md
  - `GET /api/features/:id/plan` — 获取 plan.md（含 progress）
  - `GET /api/board` — 聚合 endpoint，将 features 按 status 映射到看板列
- 保留 auth 路由（`auth.ts`）和 projects 路由不变
- 移除 `SUPERCREW_DEMO` 环境变量守卫，`.supercrew/` 成为默认唯一模式
- Init-status 改为检查 `.supercrew/features/` 是否存在

### 1.5 删除遗留代码
- 移除 `.team/` 相关的所有 store 逻辑、路由、类型
- 移除 `Sprint`、`Person`、`KnowledgeEntry`、`Decision` 类型（MVP 阶段只聚焦 Feature）
- 清理 `index.ts` 中的路由注册

---

## Phase 2: 前端看板重构

**目标：** 用 feature-centric 视图替代现有 task-centric 看板。

### 2.1 数据层重构
- 更新 `kanban/frontend/packages/app-core/src/types.ts`：用 `Feature`（含 meta + design status + plan progress）替代 `Task`/`Sprint` 等
- 更新 `kanban/frontend/packages/app-core/src/api.ts`：`fetchFeatures()`、`createFeature()`、`updateFeature()`、`updateFeatureStatus()`、`deleteFeature()`、`fetchFeatureDesign()`、`fetchFeaturePlan()`
- 更新 `useBoard()` hook：返回 `{ features, featuresByStatus, isLoading, error }`
- 更新 `useMutations()`：feature CRUD + status 更新 + optimistic updates

### 2.2 看板主视图
- 重构 `kanban/frontend/packages/ui/` 中的 `KanbanBoard` 组件
- 6 列布局对应 status：`Planning | Designing | Ready | Active | Blocked | Done`
- Feature 卡片显示：`title`、`priority` badge（P0 红/P1 橙/P2 蓝/P3 灰）、`owner`、`teams` tags、plan `progress` 进度条
- 拖拽：保留 `@hello-pangea/dnd`，拖拽 = status 流转（需校验合法转换）
- 参考 vibe-kanban 的卡片 UI 风格：简洁、信息密度高

### 2.3 Feature 详情页
- 新建 `/features/:id` 路由，替代原 `/tasks/:id`
- 三 Tab 布局：**Overview**（meta.yaml 渲染：owner、priority、teams、target_release、tags、dates）、**Design**（design.md markdown 渲染 + status/reviewer 信息）、**Plan**（plan.md 渲染：进度条 + task checklist 可视化，类似 societas floating todo bar）
- Design tab 显示 review status badge（draft/in-review/approved/rejected）
- Plan tab 显示 `completed_tasks/total_tasks` 进度 + 每个 workitem 的完成状态

### 2.4 FRE 与 Init 流程更新
- 更新 Welcome wizard：Select Repo → Initialize `.supercrew/` directory（替代 `.team/`）
- Init API 调用改为 `/api/projects/github/repos/:owner/:repo/init`，创建 `.supercrew/features/` 目录

### 2.5 清理遗留页面
- 移除 `/people`、`/knowledge`、`/decisions` 页面和底部导航对应入口
- 底部导航简化为：**Board**（feature 看板）、**Features**（列表视图，可选）
- 保留 dark/light theme 和 i18n

---

## Phase 3: AI 集成插件

**目标：** 创建独立插件，在用户 repo 中自动管理 `.supercrew/` 目录。参考 superpowers 的 skills/hooks/commands 架构，但独立发布。

### 3.1 插件目录结构
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

### 3.2 Skills 实现

- **`create-feature`**: 用户描述需求 → AI 通过 PRD 讨论提炼 → 生成 `meta.yaml`（自动填充 id、title、owner、priority、status=planning、dates）+ `design.md`（初始 draft 模板）+ `plan.md`（空结构）+ `log.md`（初始化记录）
- **`update-status`**: 根据代码/commit 状态自动判断并更新 `meta.yaml` 中的 status 字段，遵循合法状态转换图
- **`sync-plan`**: 在 design 完成后，基于 `design.md` 内容生成 `plan.md` 中的 task breakdown；coding 阶段持续更新 `completed_tasks`/`progress`
- **`log-progress`**: 每次 session 结束时自动追加 `log.md`，记录本次工作内容、完成的 tasks、遇到的问题

### 3.3 Hooks

- **SessionStart**: 检测当前 repo 是否有 `.supercrew/features/` → 有则注入所有 feature 的 meta 信息到 context → 提示 AI 当前活跃 feature 和进度
- **pre-commit hook**: 校验 `.supercrew/features/*/meta.yaml` 的 schema 合法性（必填字段、status 枚举值、priority 枚举值）；校验 `plan.md` frontmatter 的 `total_tasks ≥ completed_tasks`

### 3.4 Commands

- **`/new-feature`**: 触发 `create-feature` skill，交互式创建新 feature
- **`/feature-status`**: 显示所有 feature 的当前状态概览（表格形式：id | title | status | progress | owner）

### 3.5 Agent

- **`supercrew-manager`**: 综合 agent，可以执行所有 skills，负责在适当时机自动调用 `update-status`、`sync-plan`、`log-progress`

---

## Phase 4: 集成与测试

### 4.1 后端测试
- 为 supercrew-store 写单元测试（vitest）：CRUD、status 流转校验、schema 校验
- 为 features API 写集成测试：HTTP 层面的 CRUD + auth

### 4.2 前端测试
- Feature card 组件测试
- Board 视图 + 拖拽测试
- Feature 详情页 Tab 切换测试

### 4.3 端到端集成测试
- 用真实 GitHub repo 测试完整 flow：OAuth → init `.supercrew/` → create feature → update status → view on board
- 用 Claude Code 测试插件 flow：安装插件 → `/new-feature` → coding → plan 自动更新 → commit（pre-commit hook 校验）

### 4.4 部署验证
- Vercel 部署验证：确保 GitHub store 正确读写 `.supercrew/` 路径
- 运行 `kanban/scripts/verify-before-deploy.sh`

---

## Verification
- `cd kanban && bun test` — 后端单元测试
- `cd kanban/frontend && pnpm test` — 前端测试
- 手动测试：选择一个 test repo → 通过 kanban FRE 初始化 `.supercrew/` → 创建 feature → 在看板上拖拽 → 查看详情页
- 插件测试：在 Claude Code 中加载插件 → 执行 `/new-feature` → 验证文件生成 → commit 触发 pre-commit hook

---

## Decisions
- **`.team/` 完全弃用**：MVP 不做兼容，直接替换。简化实现复杂度。
- **Feature-centric 而非 Task-centric**：看板的最小单位是 feature，不再是 task。Task 作为 plan.md 内的 checklist 存在。
- **插件独立于 superpowers**：降低耦合，独立发布到 marketplace。Post-MVP 可以与 superpowers 融合。
- **Sprint/People/Knowledge/Decisions 移除**：MVP 聚焦 feature lifecycle，这些概念不在 `.supercrew/` schema 中，不保留。
- **log.md 保留**：虽然讨论文档未提及，但 demo 分支已实现，作为 AI context 很有价值，保留。
- **Design review 纳入 MVP**：`design.md` 的 `status/reviewer/approved_by` 字段保留，在详情页展示。在 pre-commit hook 中不强制校验。
