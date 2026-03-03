---
status: approved
reviewers: [alice, bob]
approved_by: [alice, bob]
---

# 通知推送系统 - 设计文档

## 概述
实时通知系统，支持任务状态变更、评论、@mentions 等事件的推送通知。

## 目标
- 实时推送任务状态变更通知
- 支持 @mention 通知
- 浏览器内 toast 通知（MVP）
- 未读消息计数

## 非目标
- 不做邮件通知（后续迭代）
- 不做移动端推送
- 不做通知偏好设置

## 技术方案
1. **传输**: Server-Sent Events (SSE)
2. **后端**: Hono SSE endpoint + 内存事件总线
3. **前端**: EventSource API + React Context
4. **存储**: 最近 50 条通知缓存在内存

---

## 评审记录
- 2026-02-25 @alice: SSE 比 WebSocket 简单，MVP 够用 ✅
- 2026-02-25 @bob: 需要依赖认证系统完成后才能开发
