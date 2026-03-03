# 用户认证系统 - 开发日志

## 2026-03-02

### 进展
- Auth middleware 完成，所有 /api/ 路由已添加保护
- 开始前端登录页面设计

### 决策
- Token 存储使用 httpOnly cookie 而非 localStorage（安全性考虑）

---

## 2026-02-28

### 进展
- GitHub OAuth 回调完成
- JWT 生成验证模块通过单元测试

### 阻塞
- 等 DevOps 配置生产环境的 GitHub OAuth App

---

## 2026-02-20

### 进展
- 设计文档完成，通过评审
- JWT token 模块开始开发

### 决策
- 用 JWT (HS256) 不用 session cookie（支持无状态验证）
- Token 有效期 7 天（采纳 Bob 的建议）
