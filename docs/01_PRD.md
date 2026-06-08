# Codex Note Mirror MVP PRD

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 产品名称 | Codex Note Mirror |
| 文档类型 | MVP PRD |
| 当前版本 | v0.1 |
| 目标用户 | 使用 Codex 进行本地开发、希望沉淀 AI 协作记录的开发者 |
| 核心目标 | 从 Codex 本地 JSONL 会话数据中提取用户可见聊天内容，并镜像同步为 Markdown 笔记 |

---

## 2. 背景

Codex 在本地会保存用户与模型交互过程中产生的会话数据，通常以 JSONL 形式存储。

但 Codex 原始数据并不是面向用户阅读和笔记沉淀设计的，其中可能包含大量系统事件、工具调用、中间状态、调试信息和界面不可见内容。

对用户来说，真正有价值的是：

- 自己向 Codex 提出的问题；
- Codex 在聊天界面中展示的回答；
- 一次任务中的关键上下文；
- 会话对应的时间、项目、文件和结果；
- 可被长期检索、阅读、整理的笔记内容。

因此，需要一个本地工具，将 Codex 的原始 JSONL 会话数据转化为用户可控、可阅读、可同步的 Markdown 笔记。

---

## 3. 产品定位

Codex Note Mirror 是一个本地 CLI 工具。

它不是 Codex 的完整数据备份工具，也不是会话重放工具，而是一个面向个人知识资产沉淀的 **Codex 聊天视图镜像工具**。

核心职责：

> 从 Codex 本地原始会话数据中，抽取用户在聊天视图中能看到的实际内容，并将其增量同步到用户指定的笔记目录。

---

## 4. MVP 目标

MVP 阶段只完成一个最小闭环：

```text
用户指定 Codex 数据目录
        ↓
工具扫描 JSONL 文件
        ↓
解析会话数据
        ↓
提取用户可见聊天内容
        ↓
生成 Markdown 笔记
        ↓
同步到用户指定目录
        ↓
再次运行时只更新变化内容
```

MVP 成功标准：

1. 用户可以通过 CLI 配置 Codex 数据源目录和目标笔记目录。
2. 工具可以扫描并解析 Codex JSONL 文件。
3. 工具可以过滤系统事件、调试事件和内部工具事件。
4. 工具可以提取用户消息和 Codex 可见回复。
5. 工具可以为每个会话生成一份 Markdown 笔记。
6. 工具可以记录同步状态，避免每次全量重复处理。
7. 工具再次运行时，可以增量同步新增或变化的会话。
8. 工具不会覆盖用户在同步区块之外手动添加的笔记内容。

---

## 5. MVP 不做什么

1. 不做图形界面。
2. 不做 Notion、飞书、Obsidian 插件、数据库等第三方集成。
3. 不做云端同步。
4. 不做账号系统。
5. 不做 AI 自动摘要。
6. 不做 AI 自动打标签。
7. 不做复杂的项目归类。
8. 不做完整 Codex 会话 replay。
9. 不尝试还原 Codex 的全部内部状态。
10. 不保证支持所有历史版本 Codex 数据结构，只保证对当前用户本地样本进行适配。

---

## 6. 用户画像与痛点

主要用户是使用 Codex 进行本地开发的开发者。他们会在 Codex 中完成代码修复、Bug 定位、需求拆解、技术方案讨论、项目文档生成、代码审查、Git 操作辅助、调试过程分析。

痛点：

- Codex 会话留在 Codex 内部，不方便统一管理；
- 原始 JSONL 文件不可读；
- 原始数据和用户实际看到的聊天界面不一致；
- 难以被个人笔记系统检索；
- 难以沉淀为项目知识；
- 难以迁移到用户自己的知识库。

用户期望：

- Codex 聊天内容可以自动保存到自己指定的目录；
- 保存后的内容是人能读懂的 Markdown；
- 不需要每次手动复制粘贴；
- 不需要处理复杂 JSONL；
- 后续可以在自己的笔记系统、项目文档、静态站或知识库中继续使用。

---

## 7. 核心使用场景

### 场景 1：同步 Codex 对话到本地笔记目录

```bash
codex-note-mirror sync
```

工具自动读取 Codex 本地数据，将新增会话生成 Markdown 文件。

### 场景 2：用户指定数据源和目标目录

```bash
codex-note-mirror init
```

配置：

```text
Codex 数据目录：/Users/xxx/.codex/sessions
目标笔记目录：/Users/xxx/Notes/Codex
```

### 场景 3：保留用户自己的补充笔记

```md
<!-- CODEX_SYNC_START -->

这里是工具自动同步的 Codex 内容。

<!-- CODEX_SYNC_END -->
```

再次同步时，工具只更新同步区域，不覆盖用户手写内容。

### 场景 4：检查同步状态

```bash
codex-note-mirror status
```

### 场景 5：诊断配置和数据问题

```bash
codex-note-mirror doctor
```

---

## 8. 功能需求

### 8.1 初始化配置

配置文件：

```text
~/.codex-note-mirror/config.json
```

配置示例：

```json
{
  "sourcePath": "/Users/xxx/.codex/sessions",
  "targetPath": "/Users/xxx/Notes/Codex",
  "outputFormat": "markdown",
  "syncMode": "view"
}
```

### 8.2 扫描 Codex JSONL 文件

```ts
type SourceFile = {
  path: string
  fileName: string
  size: number
  modifiedAt: string
  contentHash: string
}
```

规则：递归扫描 sourcePath，只处理 `.jsonl`，忽略隐藏文件和空文件。

### 8.3 解析 JSONL 文件

```ts
type RawEvent = {
  type?: string
  role?: string
  content?: unknown
  timestamp?: string
  [key: string]: unknown
}
```

单行 JSON 解析失败不终止整个文件解析。

### 8.4 识别会话

MVP 策略：一个 JSONL 文件对应一个会话。

```ts
type Session = {
  id: string
  sourceFile: string
  createdAt?: string
  updatedAt?: string
  title?: string
  rawEvents: RawEvent[]
}
```

### 8.5 提取用户可见消息

```ts
type VisibleMessage = {
  role: "user" | "assistant"
  content: string
  createdAt?: string
}
```

只提取用户消息和 Codex 可见回复。过滤 system/tool/debug/internal/metadata/unknown/empty event。

### 8.6 生成 Markdown 笔记

文件名：

```text
YYYY-MM-DD_session-{shortId}.md
```

模板：

```md
---
source: codex
session_id: xxx
source_file: xxx.jsonl
created_at: 2026-06-08 20:10
updated_at: 2026-06-08 20:40
sync_hash: xxx
---

# Codex Session xxx

<!-- CODEX_SYNC_START -->

## 对话内容

### User

...

### Codex

...

<!-- CODEX_SYNC_END -->

## 我的补充
```

### 8.7 增量同步

状态文件：

```text
~/.codex-note-mirror/state.json
```

基于 contentHash 判断 new / changed / unchanged。

### 8.8 保留用户手写内容

只替换同步区块内部内容。目标文件存在但缺少同步区块时，不覆盖文件。

---

## 9. CLI 命令设计

```bash
codex-note-mirror init
codex-note-mirror sync
codex-note-mirror status
codex-note-mirror doctor
```

---

## 10. 权限与隐私

MVP 阶段：

1. 不上传任何数据；
2. 不调用外部 API；
3. 不默认收集 telemetry；
4. 不读取 sourcePath 之外的数据；
5. 不写入 targetPath 和自身配置目录之外的位置；
6. 不自动删除用户笔记；
7. 不覆盖用户手写内容。

---

## 11. MVP 完成定义

1. init 可用；
2. sync 可用；
3. status 可用；
4. doctor 可用；
5. JSONL 可以被解析；
6. user / assistant 消息可以被提取；
7. tool/system/debug/internal/metadata event 可以被过滤；
8. Markdown 可以生成；
9. 同步区块可以保护用户手写内容；
10. sync state 可以支持增量同步；
11. 核心模块有测试覆盖；
12. README 说明清楚基础用法和限制。
