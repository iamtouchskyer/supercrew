---
status: approved
reviewers: [alice]
approved_by: [alice]
---

# API 限流保护 - 设计文档

## 概述
为所有公共 API 添加速率限制，防止滥用和 DDoS 攻击。支持按 IP 和按用户两种限流策略。

## 目标
- 每个用户每分钟最多 60 次请求
- 未认证请求每 IP 每分钟 20 次
- 429 状态码 + Retry-After header
- 支持白名单

## 非目标
- 不做分布式限流（单实例够用）
- 不做按 API 细分限流规则

## 技术方案
1. **算法**: 滑动窗口计数器
2. **存储**: 内存 Map（本地）/ Vercel KV（生产）
3. **中间件**: Hono middleware，在 auth 之前执行
4. **Header**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## 评审记录
- 2026-02-28 @alice: 方案通过，建议先实现基础版，观察效果后再调参数
