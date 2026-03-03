# Document-Driven Development (DDD) - 数据结构规范

---

## 文件夹结构

```
.supercrew/features/{feature-id}/
├── meta.yaml       # 🖥️ Kanban 渲染
├── design.md       # 🤖 AI Agent 理解设计意图
├── plan.md         # 🖥️🤖 两者都用
└── log.md          # 🤖 AI Agent 理解进度上下文
```

---

## 用途分类

### 🖥️ Kanban UI 渲染 — 给人看的

| 文件 | 字段 | 渲染为 |
|------|------|--------|
| `meta.yaml` | `title` | 卡片标题 |
| `meta.yaml` | `status` | 看板列 (planning/designing/ready/active/blocked/done) |
| `meta.yaml` | `owner` | 负责人头像/名字 |
| `meta.yaml` | `teams[]` | 团队标签 |
| `meta.yaml` | `priority` | 优先级徽章 (P0/P1/P2/P3) |
| `meta.yaml` | `target_release` | 发布目标标签 |
| `meta.yaml` | `blocked_by` | 阻塞提示 (红色警告) |
| `plan.md` | YAML `progress` | 进度条 |
| `design.md` | YAML `status` | 设计状态徽章 (draft/in-review/approved) |

### 🤖 AI Agent 理解 — 给 Claude Code 读的

| 文件 | 用途 |
|------|------|
| `design.md` body | **理解设计意图** — AI 写代码前读这个，知道要做什么、怎么做、边界在哪 |
| `plan.md` 任务列表 | **理解当前任务** — AI 知道自己要做哪个任务，上下游是什么 |
| `plan.md` 依赖表 | **理解阻塞** — AI 知道等什么、找谁 |
| `log.md` | **理解历史上下文** — AI 知道之前做了什么、遇到什么问题、做了什么决策 |

---

## Schema 定义

### `meta.yaml` — 🖥️ Kanban 卡片数据

```yaml
# === Kanban 必填 ===
id: user-auth
title: "用户认证系统"
status: planning | designing | ready | active | blocked | done
owner: alice
priority: P0 | P1 | P2 | P3

# === 团队协调 ===
teams: [platform, frontend]
target_release: "2025-Q1"

# === 时间戳 ===
created: "2025-03-01"
updated: "2025-03-02"

# === 可选 ===
tags: [auth, security]
blocked_by: ""
```

**Status 流转**:
```
planning → designing → ready → active → done
              ↓           ↓       ↓
           blocked ←──────┴───────┘
```

---

### `design.md` — 🤖 AI 理解设计意图

**YAML 头 (Kanban 用)**:
```yaml
---
status: draft | in-review | approved | rejected
reviewers: [bob, charlie]
approved_by: []
---
```

**Markdown 体 (AI Agent 用)**:
```markdown
# {Feature Title} - 设计文档

## 概述
<!-- AI 读这个知道 feature 是什么 -->

## 目标
<!-- AI 读这个知道要达成什么 -->

## 非目标
<!-- AI 读这个知道边界在哪，不要过度实现 -->

## 技术方案
<!-- AI 读这个知道怎么实现 -->

## API 设计
<!-- AI 读这个知道接口规范 -->

## 数据模型
<!-- AI 读这个知道数据结构 -->

---

## 评审记录
<!-- AI 读这个知道有什么反馈需要处理 -->
```

---

### `plan.md` — 🖥️🤖 两者都用

**YAML 头 (Kanban 进度条)**:
```yaml
---
total_tasks: 7
completed_tasks: 2
progress: 28
---
```

**Markdown 体 (AI Agent 用)**:
```markdown
# {Feature Title} - 实现计划

## 任务分解

### Phase 1: 基础认证
- [x] 实现 JWT token 生成 @alice
- [ ] 实现登录 API @alice          ← AI 读这个知道下一个任务
- [ ] 添加登录页面 @bob

## 依赖 (跨组协调)

| 依赖项 | 提供方 | 需求方 | 状态 | 截止 |
|--------|--------|--------|------|------|
| 认证头规范 | api-gateway | platform | waiting | 03-10 |

<!-- AI 读依赖表知道：被卡住了，要等 api-gateway 团队 -->

## 风险
<!-- AI 读这个知道要注意什么 -->
```

**AI 解析规则**:
- `- [x]` = 已完成
- `- [ ]` = 未完成
- `@username` = assignee
- 依赖表 `waiting`/`blocked` = 有阻塞

---

### `log.md` — 🤖 AI 理解历史上下文

```markdown
# {Feature Title} - 开发日志

## 2025-03-02

### 进展
- JWT token 模块完成

### 阻塞
- 等 API Gateway 认证头规范 @david

### 决策
- 用 JWT 不用 session cookie (见 ADR-002)

---

## 2025-03-01
...
```

**AI 读这个知道**:
- 之前做了什么 → 不重复劳动
- 遇到什么问题 → 避免踩同样的坑
- 做了什么决策 → 保持一致性

---

## 总结：谁读什么

| 文件 | Kanban UI | AI Agent |
|------|:---------:|:--------:|
| `meta.yaml` 全部 | ✅ | - |
| `design.md` YAML 头 | ✅ (状态徽章) | - |
| `design.md` body | - | ✅ 理解设计 |
| `plan.md` YAML 头 | ✅ (进度条) | - |
| `plan.md` 任务列表 | - | ✅ 理解任务 |
| `plan.md` 依赖表 | - | ✅ 理解阻塞 |
| `log.md` | - | ✅ 理解上下文 |

---

## Claude Code 插件规划

为了让 AI Agent 能够自动创建和管理 `.supercrew` 文件结构，需要开发一套 Claude Code 插件。

> 参考: [obra/superpowers](https://github.com/obra/superpowers) — Claude Code 插件参考实现

### 插件目录结构

```
supercrew-plugin/
├── plugins/
│   ├── skills/
│   │   ├── create-feature/
│   │   │   └── SKILL.md           # 创建 feature 目录结构
│   │   ├── update-status/
│   │   │   └── SKILL.md           # 更新 meta.yaml status
│   │   ├── log-progress/
│   │   │   └── SKILL.md           # 追加 log.md 条目
│   │   └── sync-plan/
│   │       └── SKILL.md           # 同步 checkbox → progress
│   │
│   ├── agents/
│   │   └── supercrew-manager.md   # 项目管理 subagent
│   │
│   ├── commands/
│   │   ├── new-feature.md         # /new-feature 命令
│   │   └── feature-status.md      # /feature-status 命令
│   │
│   └── hooks/
│       ├── hooks.json             # Hook 配置
│       └── session-start          # 启动时注入 .supercrew 上下文
│
├── templates/                      # 文件模板
│   ├── meta.yaml
│   ├── design.md
│   ├── plan.md
│   └── log.md
│
├── CLAUDE.md                       # 项目说明
└── README.md                       # 安装/使用文档
```

### Skills 定义 (SKILL.md 格式)

每个 skill 必须有 YAML frontmatter，`description` 必须以 **"Use when..."** 开头。

#### `create-feature/SKILL.md`

```markdown
---
name: create-feature
description: Use when starting a new feature and need to create the .supercrew/features/<id>/ directory with meta.yaml, design.md, plan.md, log.md files
---

# Create Feature

## Overview
创建标准化的 feature 目录结构，包含所有必需的文件模板。

## When to Use
- 用户说 "创建新 feature" / "new feature"
- 用户说 "开始一个新功能"
- 需要初始化项目管理文件

## Implementation Steps
1. 确认 feature-id (kebab-case)
2. 创建 `.supercrew/features/<feature-id>/` 目录
3. 从模板生成 meta.yaml, design.md, plan.md, log.md
4. 填充 meta.yaml 的 id, title, owner, created 字段
5. 设置 status 为 `planning`
```

#### `update-status/SKILL.md`

```markdown
---
name: update-status
description: Use when feature status changes (planning/designing/ready/active/blocked/done) and need to update meta.yaml
---

# Update Status

## Overview
更新 feature 的 meta.yaml status 字段，并自动记录到 log.md。

## When to Use
- 设计评审通过 → `designing` → `ready`
- 开始开发 → `ready` → `active`
- 遇到阻塞 → `active` → `blocked`
- 功能完成 → `active` → `done`

## Status Flow
planning → designing → ready → active → done
             ↓           ↓       ↓
          blocked ←──────┴───────┘
```

#### `sync-plan/SKILL.md`

```markdown
---
name: sync-plan
description: Use when plan.md tasks are updated and need to sync checkbox counts to YAML frontmatter progress field
---

# Sync Plan Progress

## Overview
解析 plan.md 中的 checkbox (`- [x]` / `- [ ]`)，计算完成率，更新 YAML 头的 progress。

## When to Use
- 完成任务后同步进度
- Kanban 需要显示进度条
- 检查任务完成情况

## Algorithm
1. 读取 plan.md
2. 统计 `- [x]` (completed) 和 `- [ ]` (pending)
3. 计算 progress = completed / total * 100
4. 更新 YAML frontmatter: total_tasks, completed_tasks, progress
```

#### `log-progress/SKILL.md`

```markdown
---
name: log-progress
description: Use when completing work on a feature and need to record progress, blockers, or decisions in log.md
---

# Log Progress

## Overview
在 log.md 追加今日进展条目，记录进展、阻塞、决策。

## When to Use
- 完成一个任务
- 遇到阻塞需要记录
- 做了重要决策

## Log Entry Format
## YYYY-MM-DD

### 进展
- [具体完成的事项]

### 阻塞 (可选)
- [等待什么/谁]

### 决策 (可选)
- [做了什么决策，为什么]
```

### Agent 定义

#### `agents/supercrew-manager.md`

```markdown
---
name: supercrew-manager
description: Use when managing features in .supercrew/ directory - creating features, updating status, tracking progress, resolving blockers
model: inherit
---

# Supercrew Manager

你是一个项目管理助手，负责管理 `.supercrew/features/` 目录下的 feature 文件。

## 职责

1. **创建 Feature** — 使用 `create-feature` skill 初始化目录结构
2. **追踪状态** — 使用 `update-status` skill 更新 meta.yaml
3. **同步进度** — 使用 `sync-plan` skill 计算 checkbox 完成率
4. **记录日志** — 使用 `log-progress` skill 追加进展条目

## 工作流程

当用户提到 feature 管理相关需求时：

1. 先读取 `.supercrew/features/` 了解现有 features
2. 根据用户意图调用对应 skill
3. 执行完成后汇报结果

## 注意事项

- 保持 meta.yaml 与实际状态一致
- 每次状态变更都记录到 log.md
- 遵循 status 流转规则
```

### Commands 定义

#### `commands/new-feature.md`

```markdown
---
description: Create a new feature with .supercrew directory structure
disable-model-invocation: true
---

Invoke the create-feature skill and follow it exactly as presented to you.
Ask the user for feature-id and title if not provided.
```

#### `commands/feature-status.md`

```markdown
---
description: Update feature status in meta.yaml
disable-model-invocation: true
---

Invoke the update-status skill and follow it exactly as presented to you.
Ask the user for feature-id and new status if not provided.
```

### Hooks 配置

#### `hooks/hooks.json`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "'${CLAUDE_PLUGIN_ROOT}/hooks/session-start'",
            "async": false
          }
        ]
      }
    ]
  }
}
```

#### `hooks/session-start`

```bash
#!/usr/bin/env bash
# 启动时检查 .supercrew 目录，注入上下文

set -euo pipefail

SUPERCREW_DIR=".supercrew/features"

if [ -d "$SUPERCREW_DIR" ]; then
  features=$(ls -1 "$SUPERCREW_DIR" 2>/dev/null | head -10)
  context="Active features in .supercrew/features/: $features"
else
  context="No .supercrew/features/ directory found. Use /new-feature to create one."
fi

# Escape for JSON
escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

escaped=$(escape_for_json "$context")

cat <<EOF
{
  "additional_context": "${escaped}"
}
EOF
```

### 文件模板

#### `templates/meta.yaml`

```yaml
# === Kanban 必填 ===
id: {{feature-id}}
title: "{{title}}"
status: planning
owner: {{owner}}
priority: P2

# === 团队协调 ===
teams: []
target_release: ""

# === 时间戳 ===
created: "{{date}}"
updated: "{{date}}"

# === 可选 ===
tags: []
blocked_by: ""
```

#### `templates/design.md`

```markdown
---
status: draft
reviewers: []
approved_by: []
---

# {{title}} - 设计文档

## 概述
<!-- 这个 feature 是什么 -->

## 目标
<!-- 要达成什么 -->

## 非目标
<!-- 边界在哪，不做什么 -->

## 技术方案
<!-- 怎么实现 -->

## API 设计
<!-- 接口规范 (如适用) -->

## 数据模型
<!-- 数据结构 (如适用) -->

---

## 评审记录
<!-- 评审反馈和讨论 -->
```

#### `templates/plan.md`

```markdown
---
total_tasks: 0
completed_tasks: 0
progress: 0
---

# {{title}} - 实现计划

## 任务分解

### Phase 1: 基础实现
- [ ] TODO @{{owner}}

## 依赖 (跨组协调)

| 依赖项 | 提供方 | 需求方 | 状态 | 截止 |
|--------|--------|--------|------|------|

## 风险
<!-- 需要注意的风险点 -->
```

#### `templates/log.md`

```markdown
# {{title}} - 开发日志

## {{date}}

### 进展
- Feature 创建
```

---

### Marketplace 发布配置

Claude Code 插件通过 `.claude-plugin/` 目录配置 Marketplace 发布信息。

#### 完整目录结构 (含 Marketplace 配置)

```
supercrew-plugin/
├── .claude-plugin/
│   ├── marketplace.json       # ⭐ Marketplace 发布配置
│   └── plugin.json            # 本地插件配置 (可选)
│
├── agents/                     # Agent 定义
│   └── supercrew-manager.md
│
├── commands/                   # 命令定义
│   ├── new-feature.md
│   └── feature-status.md
│
├── hooks/                      # Hook 配置
│   ├── hooks.json
│   └── session-start
│
├── skills/                     # Skill 定义
│   ├── create-feature/
│   │   └── SKILL.md
│   ├── update-status/
│   │   └── SKILL.md
│   ├── sync-plan/
│   │   └── SKILL.md
│   └── log-progress/
│       └── SKILL.md
│
├── templates/                  # 文件模板
│   ├── meta.yaml
│   ├── design.md
│   ├── plan.md
│   └── log.md
│
├── CLAUDE.md
├── README.md
└── LICENSE
```

#### `.claude-plugin/marketplace.json`

```json
{
  "name": "supercrew",
  "description": "Document-Driven Development plugin for managing .supercrew feature files",
  "owner": {
    "name": "Your Name",
    "email": "your@email.com"
  },
  "plugins": [
    {
      "name": "supercrew",
      "description": "Manage .supercrew/features/ directory with meta.yaml, design.md, plan.md, log.md for Kanban and AI Agent workflows",
      "version": "1.0.0",
      "source": "./",
      "author": {
        "name": "Your Name",
        "email": "your@email.com"
      }
    }
  ]
}
```

**字段说明**:

| 字段 | 说明 |
|------|------|
| `name` | 插件在 Marketplace 的唯一标识 |
| `description` | 插件简介，显示在 Marketplace 列表 |
| `owner` | 发布者信息 |
| `plugins[].name` | 插件包名 |
| `plugins[].description` | 详细描述 |
| `plugins[].version` | 语义化版本号 |
| `plugins[].source` | 插件源码路径 (相对于仓库根目录) |
| `plugins[].author` | 作者信息 |

#### `.claude-plugin/plugin.json` (可选 - 本地开发用)

```json
{
  "name": "supercrew",
  "version": "1.0.0",
  "description": "Local development configuration"
}
```

---

### 实现步骤

1. **Phase 1: 核心 Skills** (Week 1)
   - [ ] 创建 `plugins/skills/create-feature/SKILL.md`
   - [ ] 创建 `plugins/skills/update-status/SKILL.md`
   - [ ] 编写 `templates/` 下的 4 个模板文件
   - [ ] 测试: 手动调用 skill 创建 feature

2. **Phase 2: 自动化 Skills** (Week 2)
   - [ ] 创建 `plugins/skills/sync-plan/SKILL.md`
   - [ ] 创建 `plugins/skills/log-progress/SKILL.md`
   - [ ] 配置 `hooks/hooks.json` 和 `session-start` 脚本
   - [ ] 测试: checkbox 同步和日志记录

3. **Phase 3: Agent 集成** (Week 3)
   - [ ] 创建 `plugins/agents/supercrew-manager.md`
   - [ ] 创建 `plugins/commands/new-feature.md`
   - [ ] 创建 `plugins/commands/feature-status.md`
   - [ ] 测试: 通过 `/new-feature` 命令创建 feature

4. **Phase 4: 打包发布**
   - [ ] 创建 `.claude-plugin/marketplace.json`
   - [ ] 创建 `.claude-plugin/plugin.json`
   - [ ] 编写 `README.md` (安装说明、使用示例)
   - [ ] 编写 `CLAUDE.md` (项目约定)
   - [ ] 添加 `LICENSE` 文件
   - [ ] 发布到 GitHub
   - [ ] 提交到 Claude Code Marketplace

---

## 验证清单

- [ ] 创建 `.supercrew/features/example-feature/` 示例
- [ ] Kanban API 能解析 `meta.yaml` 渲染卡片
- [ ] Kanban API 能读取 `plan.md` YAML 头显示进度条
- [ ] AI Agent 能读取 `design.md` 理解设计意图
- [ ] AI Agent 能解析 `plan.md` checkbox 知道当前任务
