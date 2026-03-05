# Vibe Kanban vs SuperCrew 对比分析

**Date:** 2026-03-05
**Status:** Analysis

---

## 一、产品定位

| 维度 | Vibe Kanban | SuperCrew |
|------|-------------|-----------|
| **一句话定位** | AI Agent 执行环境管理器 | 团队 Feature 生命周期可视化 |
| **核心问题** | "如何让多个 AI Agent 高效并行工作" | "团队如何共享 Feature 进度" |
| **目标用户** | 个人开发者 (指挥多 Agent) | 团队 (共享可视化看板) |
| **设计哲学** | Agent-centric (以 Agent 为中心) | Feature-centric (以 Feature 为中心) |

---

## 二、数据架构

| 维度 | Vibe Kanban | SuperCrew |
|------|-------------|-----------|
| **数据归属** | 本地 SQLite + Git worktree | GitHub 远端 repo (`.supercrew/features/`) |
| **持久化** | 本地 SQLite 数据库 | GitHub Contents API (只读) + Vercel KV (用户绑定) |
| **同步方式** | 本地文件，无需 push | **必须 push 才能同步** |
| **离线能力** | 完全支持 | 需要网络连接 |
| **写入能力** | SQLite 直接写 | UI 只读，需本地 Claude Code 写入后 push |

### SuperCrew 数据流

```
Claude Code (本地写入 .supercrew/features/)
    ↓ git push
GitHub Repo (远端存储)
    ↓ GitHub Contents API
Kanban Backend (只读获取)
    ↓
Kanban Frontend (可视化展示)
```

---

## 三、Task/Feature 管理

| 维度 | Vibe Kanban | SuperCrew |
|------|-------------|-----------|
| **管理粒度** | Issue/Task 级 | Feature 级 (含完整 spec) |
| **编辑入口** | UI 直接编辑 | Claude Code CLI 编辑 → push |
| **状态列** | 自定义 | 固定 6 列：planning → designing → ready → active → blocked → done |
| **上下文深度** | 轻量 issue 描述 | 完整 spec：meta.yaml + design.md + plan.md + log.md |
| **进度追踪** | Agent 执行状态 | plan.md 中的 checklist 进度 |

### SuperCrew Feature 结构

```
.supercrew/features/<id>/
├── meta.yaml      # ID, title, status, owner, priority, dates
├── design.md      # 需求、架构、约束
├── plan.md        # 任务分解、checklist、进度
└── log.md         # 时间线进展记录
```

---

## 四、AI Agent 集成

| 维度 | Vibe Kanban | SuperCrew |
|------|-------------|-----------|
| **支持 Agent** | 10+ (Claude, Codex, Copilot, Cursor...) | Claude Code 专属 |
| **执行环境** | 每 workspace 独立 branch/terminal/devserver | 用户本地 Claude Code session |
| **连接方式** | MCP Server (UI ↔ Agent 双向) | Skills/Hooks (单向上下文加载) |
| **交互闭环** | UI inline comment → Agent 即时响应 | 手动更新 log.md → push |
| **环境隔离** | 自动创建 Git worktree | 用户手动管理分支 |

### Vibe Kanban 执行流

```
UI 创建 Issue → 自动创建 Workspace (worktree)
→ Agent 在隔离环境执行 → UI 实时显示 diff
→ Inline 反馈 → Agent 修改 → 满意后 PR
```

### SuperCrew 执行流

```
/supercrew:new-feature → 创建 spec 文件
→ /supercrew:work-on → 加载上下文到 Claude Code
→ 手动开发 → 更新 log.md → git push
→ Kanban 刷新看到新状态
```

---

## 五、工作流对比

| 阶段 | Vibe Kanban | SuperCrew |
|------|-------------|-----------|
| **创建任务** | UI 直接创建 Issue | CLI: `/supercrew:new-feature` |
| **分配执行** | UI 选择 Agent + 创建 Workspace | CLI: `/supercrew:work-on <id>` |
| **执行过程** | Agent 自动执行，UI 实时 diff 预览 | 开发者在 Claude Code 中工作 |
| **反馈迭代** | UI inline comment → Agent 即时响应 | 手动编辑 → commit → push |
| **代码审查** | UI 内置 diff 审查 + inline 评论 | GitHub PR 流程 |
| **合并完成** | AI 生成 PR 描述 → 一键合并 | 标准 GitHub PR 流程 |

---

## 六、用户关注点

| 用户角色 | Vibe Kanban 关注 | SuperCrew 关注 |
|----------|-----------------|----------------|
| **开发者** | Agent 执行状态、diff 预览、inline 反馈 | Feature 当前阶段、plan 进度、阻塞原因 |
| **队友** | (单人场景为主) | 谁在做什么、整体进度、依赖关系 |
| **管理者** | (不适用) | Feature 状态分布、瓶颈在哪、燃尽趋势 |

---

## 七、技术架构

| 维度 | Vibe Kanban | SuperCrew |
|------|-------------|-----------|
| **后端语言** | Rust | TypeScript (Bun/Node.js + Hono) |
| **前端** | TypeScript + 自研 | React + Vite + TanStack |
| **数据库** | SQLite (sqlx-cli) | 无 DB，GitHub API + Vercel KV |
| **部署** | 本地 / 自托管 Docker | Vercel Serverless |
| **Agent 通信** | MCP Server | 无直接通信，靠 git 同步 |

---

## 八、核心差异总结

| 差异点 | Vibe Kanban | SuperCrew |
|--------|-------------|-----------|
| **数据所有权** | 用户本地 | 用户 GitHub repo |
| **实时性** | 本地即时 | 依赖 push + API 延迟 |
| **UI 写入** | 支持 | 只读 |
| **多 Agent** | 支持 10+ Agent 切换 | 仅 Claude Code |
| **团队协作** | 弱 (本地为主) | 强 (GitHub 天然共享) |
| **环境隔离** | 自动 worktree | 手动分支管理 |
| **审查体验** | 内置 diff + inline | 依赖 GitHub PR |

---

## 九、优劣势分析

### Vibe Kanban 优势

1. **即时反馈** — 本地 SQLite + MCP，Agent 执行和反馈都是实时的
2. **多 Agent 支持** — 可以在不同任务间切换 Agent
3. **环境隔离** — 自动 worktree，每个任务独立分支/终端
4. **一体化体验** — UI 集成了 diff 审查、inline 评论、PR 生成
5. **离线工作** — 不依赖网络

### Vibe Kanban 劣势

1. **单人场景** — 团队协作能力弱
2. **本地绑定** — 数据在本地，换机器不好迁移
3. **技术门槛** — Rust + SQLite，定制成本高

### SuperCrew 优势

1. **团队可见** — GitHub 天然共享，团队成员都能看到进度
2. **Feature 深度** — 完整 spec (design + plan + log)，不只是轻量 issue
3. **Git 原生** — 数据就是代码仓库的一部分，天然版本控制
4. **低运维** — Vercel serverless，无需自己维护服务器
5. **结构化流程** — brainstorming → writing-plans → subagent-driven-development

### SuperCrew 劣势

1. **同步延迟** — 必须 push 才能更新，UI 只读
2. **单 Agent** — 仅支持 Claude Code
3. **无实时反馈** — 没有 MCP 双向通信
4. **无环境隔离** — 需用户手动管理分支

---

## 十、定位总结

| | Vibe Kanban | SuperCrew |
|---|-------------|-----------|
| **核心场景** | 个人 vibe coding session | 团队 feature 进度追踪 |
| **类比** | "AI Agent 的 IDE" | "团队 Feature 的 Dashboard" |
| **价值主张** | 提升个人 Agent 执行效率 | 提升团队 Feature 可见度 |
