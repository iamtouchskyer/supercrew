---
total_tasks: 6
completed_tasks: 1
progress: 16
---

# 仪表盘重设计 - 实现计划

## 任务分解

### Phase 1: 数据层
- [x] 设计 DashboardStats 数据模型 @bob
- [ ] 实现后端 /api/dashboard/stats 接口 @bob

### Phase 2: UI 组件
- [ ] 统计卡片组件 (任务数/优先级分布) @bob
- [ ] Sprint Burndown 图表 @charlie
- [ ] 团队负载热力图 @charlie

### Phase 3: 集成
- [ ] 仪表盘页面路由和布局 @bob

## 依赖 (跨组协调)

| 依赖项 | 提供方 | 需求方 | 状态 | 截止 |
|--------|--------|--------|------|------|
| 设计稿 | design | frontend | in-progress | 03-05 |
| 统计 API | platform | frontend | waiting | 03-10 |

## 风险
- recharts 包体积较大，需评估对加载时间的影响
