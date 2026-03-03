---
status: approved
reviewers: [bob, charlie]
approved_by: [bob]
---

# 用户认证系统 - 设计文档

## 概述
基于 GitHub OAuth + JWT 的用户认证系统，支持登录、注册、Token 刷新和权限管理。

## 目标
- 实现 GitHub OAuth 登录流程
- JWT Token 生成与验证
- 支持 Token 自动刷新
- 基本的 RBAC 权限模型

## 非目标
- 不实现邮箱/密码登录
- 不实现 2FA（后续迭代）
- 不做细粒度的 API 级别权限控制

## 技术方案
1. **OAuth Flow**: GitHub OAuth App → Authorization Code → Access Token
2. **Token**: JWT (HS256), 有效期 7 天，支持 refresh
3. **存储**: Vercel KV 存储用户信息和 session
4. **中间件**: Hono middleware 做 token 验证

## API 设计

### POST /auth/login
```
Request: { code: string }
Response: { token: string, user: { id, name, avatar } }
```

### POST /auth/refresh
```
Request: { token: string }
Response: { token: string }
```

### GET /auth/me
```
Headers: Authorization: Bearer <token>
Response: { id, name, avatar, teams }
```

## 数据模型

```typescript
interface User {
  id: string
  github_id: number
  username: string
  name: string
  avatar_url: string
  teams: string[]
  created_at: string
  last_login: string
}
```

---

## 评审记录
- 2026-02-20 @bob: 建议 token 有效期从 30 天改为 7 天 ✅ 已采纳
- 2026-02-21 @charlie: RBAC 可以先简化，只区分 admin/member ✅ 已采纳
