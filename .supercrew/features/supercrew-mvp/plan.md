---
total_tasks: 24
completed_tasks: 22
progress: 92
---

# SuperCrew MVP — Implementation Plan

## Phase 1: AI 集成插件（数据写入方）

- [x] 1.1 创建插件目录结构 `plugins/supercrew/`
- [x] 1.2 定义 Schema（SupercrewStatus 枚举、FeaturePriority、4 个文件结构）
- [x] 1.3 实现 `create-feature` skill
- [x] 1.4 实现 `update-status` skill
- [x] 1.5 实现 `sync-plan` skill
- [x] 1.6 实现 `log-progress` skill
- [x] 1.7 实现 `managing-features` skill（综合管理）
- [x] 1.8 实现 SessionStart hook（Active Feature 匹配）
- [x] 1.9 实现 `/new-feature` command
- [x] 1.10 实现 `/feature-status` command
- [x] 1.11 实现 `/work-on <id>` command
- [x] 1.12 创建 `.claude-plugin/marketplace.json`

## Phase 2: 后端 Schema 基础设施（只读）

- [x] 2.1 定义 TypeScript 类型（FeatureMeta, DesignDoc, PlanDoc, FeatureLog）
- [x] 2.2 重写 GitHub Store 为只读访问 `.supercrew/features/`
- [x] 2.3 重写 Local Store（只读，开发调试用）
- [x] 2.4 重写 API Routes（仅 GET 端点）
- [x] 2.5 删除 `.team/` 遗留代码

## Phase 3: 前端看板重构（只读）

- [x] 3.1 更新数据层（types.ts, api.ts）
- [x] 3.2 重构 KanbanBoard 组件（6 列布局，无拖拽）
- [x] 3.3 创建 Feature 详情页（3 Tab 布局）
- [x] 3.4 更新 FRE 与空状态处理
- [x] 3.5 清理遗留页面（people, knowledge, decisions）

## Phase 4: 集成与测试

- [ ] 4.1 插件测试（create-feature, status, plan, log, hook）
- [ ] 4.2 后端单元测试（vitest）
- [x] 4.3 前端组件测试
- [x] 4.4 端到端集成测试
