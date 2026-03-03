---
status: in-review
reviewers: [alice, david]
approved_by: []
---

# 仪表盘重设计 - 设计文档

## 概述
重新设计 Kanban 仪表盘，增加数据统计卡片、Sprint 进度可视化和团队负载热力图。

## 目标
- 一眼看到项目整体状态
- Sprint 进度一目了然
- 团队任务分配均衡性可视化

## 非目标
- 不做自定义仪表盘布局（MVP 固定布局）
- 不做数据导出功能

## 技术方案
1. **统计卡片**: React 组件 + CountUp 动画
2. **进度图**: 使用 recharts 库绘制 Sprint Burndown
3. **热力图**: CSS Grid + 颜色渐变

## 数据模型

```typescript
interface DashboardStats {
  totalTasks: number
  byStatus: Record<TaskStatus, number>
  byPriority: Record<TaskPriority, number>
  sprintProgress: { completed: number; total: number }
  teamLoad: { team: string; taskCount: number }[]
}
```

---

## 评审记录
- 2026-03-01 @alice: 建议增加 "本周完成" 趋势图，待讨论
