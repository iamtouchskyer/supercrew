---
status: draft
reviewers: []
# approved_by: ""
---

# SuperCrew MVP

## Background

基于 `.supercrew/` schema 的 feature-centric 项目管理系统。将 kanban 从资源导向完全迁移到 feature 导向的数据模型。MVP 包含三大模块：

1. **AI 集成插件**（skills + hooks + pre-commit）在用户 repo 中创建和管理 `.supercrew/` 目录
2. **后端**通过 GitHub API（OAuth）只读访问用户 repo 中的 `.supercrew/` 数据
3. **前端看板**以只读方式渲染 feature-centric 视图

参考 [superpowers](https://github.com/obra/superpowers) 的插件架构和 [vibe-kanban](https://github.com/BloopAI/vibe-kanban) 的 issue→workspace 模式。

## Requirements

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

### 关键原则

- **写入方唯一：** Claude Code 插件在用户本地 repo 操作 `.supercrew/`，通过 git commit + push 同步
- **读取方唯一：** Kanban 服务通过 OAuth 获取的 GitHub access_token 调用 GitHub Contents API 读取
- **Kanban 完全只读：** 不提供任何写入 API，不修改用户 repo 中的数据

## Design

### Phase 1: AI 集成插件

插件目录结构：
```
plugins/supercrew/
├── .claude-plugin/marketplace.json
├── skills/
│   ├── create-feature/SKILL.md
│   ├── update-status/SKILL.md
│   ├── sync-plan/SKILL.md
│   ├── log-progress/SKILL.md
│   └── managing-features/SKILL.md
├── commands/
│   ├── new-feature.md
│   └── feature-status.md
├── hooks/
│   ├── hooks.json
│   └── session-start
└── templates/
```

### Phase 2: 后端（只读）

- 重写 GitHub Store 为只读访问 `.supercrew/features/`
- 实现：`listFeatures()`, `getFeatureMeta(id)`, `getFeatureDesign(id)`, `getFeaturePlan(id)`
- API Routes：仅 GET 端点

### Phase 3: 前端看板（只读）

- 6 列布局：Planning | Designing | Ready | Active | Blocked | Done
- Feature 卡片显示：title, priority badge, owner, progress
- Feature 详情页：Overview / Design / Plan 三 Tab
- 无拖拽功能

### Phase 4: 集成与测试

- 插件测试、后端测试、前端测试、端到端测试

## Out of Scope

- Sprint 机制（Post-MVP Iter 2）
- 跨 Feature 协调与依赖可视化（Post-MVP Iter 3）
- Release 协调（Post-MVP Iter 4）
- Per user/per agent track
- ADO 集成
