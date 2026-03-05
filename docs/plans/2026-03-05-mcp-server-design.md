# SuperCrew MCP Server 设计方案

**Date:** 2026-03-05
**Status:** Approved
**前置文档:** [Vibe Kanban 对比分析](./2026-03-05-vibe-kanban-comparison.md)

---

## 一、背景与目标

### 当前痛点

SuperCrew 现有架构存在"闭环割裂"问题：

```
Web 看 → CLI 做 → git 同步
```

| 问题 | 影响 |
|------|------|
| Web 只读 | 无法在 Web 创建/编辑 Feature |
| 同步延迟 | 必须 push 后 Web 才能看到更新 |
| 分支盲区 | Web 只读 main，feature branch 不可见 |

### 目标

实现**双向协作闭环**：

> Web 可创建/编辑 Feature，Claude Code 可执行，两边实时同步，自动聚合所有分支

借鉴 Vibe Kanban 的 MCP Server 架构，但保留 GitHub 作为持久化和团队共享渠道。

---

## 二、架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SuperCrew MCP Server                          │
│                    (本地运行，监听 localhost:3456)                    │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────────┐ │
│  │ Feature Store │  │ Event Bus     │  │ GitHub Sync Worker      │ │
│  │ (SQLite)      │  │ (广播变更)     │  │ (异步推送/拉取 GitHub)   │ │
│  └───────────────┘  └───────────────┘  └─────────────────────────┘ │
│         │                   │                       │               │
│  ┌──────┴───────────────────┴───────────────────────┴─────────────┐ │
│  │                     Branch Scanner                              │ │
│  │              (扫描所有分支，聚合 Features)                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────┬───────────────────┬───────────────────┬──────────────────┘
           │                   │                   │
     MCP Protocol         WebSocket            GitHub API
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │ Claude Code │     │  Web UI     │     │ GitHub Repo │
    │  (Agent)    │     │ (Browser)   │     │  (备份)     │
    └─────────────┘     └─────────────┘     └─────────────┘
```

### 核心组件

| 组件 | 职责 |
|------|------|
| **Feature Store (SQLite)** | 本地数据库，快速读写，即时响应 |
| **Event Bus** | 广播变更事件，通知所有连接方 |
| **GitHub Sync Worker** | 异步同步到 GitHub，作为持久化备份 |
| **Branch Scanner** | 扫描所有分支，聚合去重 Features |
| **MCP Endpoint** | Claude Code 通过 MCP 协议连接 |
| **WebSocket Endpoint** | Web UI 通过 WebSocket 实时连接 |

---

## 三、数据设计

### 数据库 vs Git 文件的关系

| 层 | 存储 | 职责 | 特点 |
|---|------|------|------|
| **主数据** | SQLite | 实时读写 | 快、即时、本地 |
| **备份** | GitHub Repo | 持久化 + 团队共享 | 慢、异步、远端 |

### SQLite Schema

```sql
CREATE TABLE features (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,  -- planning/designing/ready/active/blocked/done
  owner TEXT,
  priority TEXT,         -- P0/P1/P2/P3
  branch TEXT NOT NULL,  -- 所在分支
  teams TEXT,            -- JSON array
  tags TEXT,             -- JSON array
  blocked_by TEXT,       -- JSON array
  target_release TEXT,
  created_at TEXT,
  updated_at TEXT,
  meta_yaml TEXT,        -- 原始 meta.yaml 内容
  design_md TEXT,        -- 原始 design.md 内容
  plan_md TEXT,          -- 原始 plan.md 内容
  log_md TEXT,           -- 原始 log.md 内容
  synced_at TEXT         -- 最后同步到 GitHub 的时间
);

CREATE INDEX idx_features_status ON features(status);
CREATE INDEX idx_features_branch ON features(branch);
```

### 数据流

**场景 1：Web UI 创建 Feature**
```
1. Web UI → POST /api/features → MCP Server
2. MCP Server → 写入 SQLite
3. MCP Server → Event Bus 广播 "feature:created"
4. Claude Code (MCP Client) 收到事件 → 更新本地状态
5. GitHub Sync Worker 异步 → push 到 GitHub
```

**场景 2：Claude Code 更新 Feature 状态**
```
1. Claude Code → MCP call "update_feature_status"
2. MCP Server → 写入 SQLite
3. MCP Server → Event Bus 广播 "feature:updated"
4. Web UI (WebSocket) 收到事件 → 即时刷新
5. GitHub Sync Worker 异步 → push 到 GitHub
```

**场景 3：团队成员同步**
```
1. 成员 A push 到 GitHub
2. 成员 B 的 MCP Server 定期 pull → 检测到变化
3. 更新本地 SQLite → 广播事件 → Web/CLI 刷新
```

---

## 四、分支聚合设计

### 扫描逻辑

```
1. 列出所有分支: main, feature/*, fix/*
2. 扫描每个分支的 .supercrew/features/
3. 聚合去重 → 写入 SQLite
```

### 去重优先级

同一个 Feature 可能在多个分支存在：

| 场景 | 处理方式 |
|------|---------|
| Feature 只在 `feature/x` | 显示，标记分支 |
| Feature 只在 `main` | 显示，标记 main |
| Feature 在两个分支都有 | **以 feature branch 为准**（更新的版本） |

```typescript
// 去重优先级：feature/* > fix/* > main
function dedupeFeatures(featuresPerBranch: Map<string, Feature[]>) {
  const result = new Map<string, Feature>()

  // 先加 main 的
  for (const f of featuresPerBranch.get('main') ?? []) {
    result.set(f.id, { ...f, branch: 'main' })
  }

  // 再用 feature/* 覆盖（更新的版本）
  for (const [branch, features] of featuresPerBranch) {
    if (branch.startsWith('feature/') || branch.startsWith('fix/')) {
      for (const f of features) {
        result.set(f.id, { ...f, branch })
      }
    }
  }

  return Array.from(result.values())
}
```

### 扫描触发时机

| 触发方式 | 说明 |
|---------|------|
| **启动时** | MCP Server 启动时全量扫描 |
| **定时** | 每 30 秒增量检查 |
| **Webhook** | GitHub push 事件触发扫描（可选） |
| **手动** | Web UI "Refresh" 按钮 / CLI 命令 |

---

## 五、MCP Tools 定义

Claude Code 可以通过 MCP 调用这些工具：

```typescript
const tools = [
  {
    name: "list_features",
    description: "列出所有 features",
    handler: () => featureStore.listAll()
  },
  {
    name: "get_feature",
    description: "获取单个 feature 详情",
    inputSchema: { id: "string" },
    handler: ({ id }) => featureStore.get(id)
  },
  {
    name: "create_feature",
    description: "创建新 feature",
    inputSchema: {
      title: "string",
      priority: "string",
      owner: "string",
      teams: "string[]"
    },
    handler: (data) => {
      const feature = featureStore.create(data)
      eventBus.emit("feature:created", feature)
      githubSync.queue("create", feature)
      return feature
    }
  },
  {
    name: "update_feature_status",
    description: "更新 feature 状态",
    inputSchema: { id: "string", status: "SupercrewStatus" },
    handler: ({ id, status }) => {
      const feature = featureStore.updateStatus(id, status)
      eventBus.emit("feature:updated", feature)
      githubSync.queue("update", feature)
      return feature
    }
  },
  {
    name: "update_feature_plan",
    description: "更新 feature plan.md",
    inputSchema: { id: "string", content: "string" },
    handler: ({ id, content }) => {
      const feature = featureStore.updatePlan(id, content)
      eventBus.emit("feature:updated", feature)
      githubSync.queue("update", feature)
      return feature
    }
  },
  {
    name: "log_progress",
    description: "追加 feature log 记录",
    inputSchema: { id: "string", entry: "string" },
    handler: ({ id, entry }) => {
      const feature = featureStore.appendLog(id, entry)
      eventBus.emit("feature:updated", feature)
      githubSync.queue("update", feature)
      return feature
    }
  },
  {
    name: "sync_now",
    description: "立即同步到 GitHub",
    handler: () => githubSync.flushAll()
  }
]
```

---

## 六、Web UI 变更

### 新增功能

| 功能 | 说明 |
|------|------|
| **创建 Feature** | 表单创建，调用 MCP Server API |
| **编辑 Feature** | 内联编辑 status、owner、priority |
| **分支标记** | 卡片显示所在分支 |
| **实时更新** | WebSocket 连接，无需手动刷新 |

### UI 示例

```
┌─────────────────────────────────────────────────────────────────────┐
│  SuperCrew Kanban                         [+ New Feature] [Refresh] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Planning      Designing      Ready      Active      Blocked  Done  │
│  ─────────     ─────────     ─────────  ─────────   ────────  ────  │
│                                                                     │
│  ┌─────────┐   ┌─────────┐              ┌─────────┐                 │
│  │ signup  │   │ oauth   │              │ login   │                 │
│  │ @alice  │   │ @bob    │              │ @charlie│                 │
│  │ P2      │   │ P1      │              │ P0      │                 │
│  │ 🌿 main │   │ 🌿 feat/│              │ 🌿 feat/│                 │
│  │         │   │   oauth │              │   login │                 │
│  └─────────┘   └─────────┘              └─────────┘                 │
│                                                                     │
│  ● Connected                                          Updated: Now  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 七、与现有架构对比

| 维度 | 现有架构 | MCP Server 架构 |
|------|---------|----------------|
| **数据源** | GitHub Repo (远端) | SQLite (本地) + GitHub (备份) |
| **Web 读取** | GitHub Contents API | MCP Server HTTP |
| **Web 写入** | 不支持 | MCP Server API |
| **CLI 读取** | 本地文件 / git pull | MCP Protocol |
| **CLI 写入** | 本地文件 → push | MCP Protocol |
| **同步延迟** | 需要 push/pull | 即时 (毫秒级) |
| **分支支持** | 只读 main | 聚合所有分支 |
| **离线能力** | Web 不可用 | 本地可用 |

---

## 八、实施计划

| 阶段 | 目标 | 工作量 |
|------|------|--------|
| **Phase 1** | MCP Server 基础 + SQLite + Branch Scanner | 1 周 |
| **Phase 2** | Claude Code MCP 集成 (Tools) | 0.5 周 |
| **Phase 3** | Web UI WebSocket + 实时更新 | 1 周 |
| **Phase 4** | Web UI 创建/编辑功能 | 0.5 周 |
| **Phase 5** | GitHub Sync Worker + 多机同步 | 1 周 |

**总计：约 4 周**

---

## 九、风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| **MCP Server 未启动** | Web 降级为只读模式（现有架构） |
| **多机数据冲突** | GitHub 作为 source of truth，定期 pull 覆盖本地 |
| **分支过多性能问题** | 只扫描 main + 最近 30 天活跃的 feature/* 分支 |
| **SQLite 损坏** | 启动时从 GitHub 重建 |

---

## 十、决策点

以下问题已在设计讨论中确认：

| 决策点 | 结论 | 理由 |
|--------|------|------|
| **MCP Server 运行位置** | 用户本地（Claude Code 机器上） | MCP 协议为本地通信设计，支持离线，团队通过 GitHub 同步 |
| **启动方式** | 随 SuperCrew 插件安装自动配置 | 与 skills/hooks 一致，可装在系统目录或项目目录 |
| **多项目支持** | 每个 repo 一个实例 | 隔离清晰，与 Claude Code 一个项目一个 session 的模式匹配 |
| **冲突策略** | 手动解决，提示用户选择 | 用户完全控制，避免意外覆盖 |

