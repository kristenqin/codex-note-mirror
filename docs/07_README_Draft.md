# Codex Note Mirror

Codex Note Mirror 是一个本地 CLI 工具，用于从 Codex 本地保存的 JSONL 会话数据中提取用户可见的聊天内容，并将其同步为 Markdown 笔记。

它的目标是把 Codex 中临时、杂乱、机器化的会话日志，转化为用户可阅读、可检索、可维护的个人知识资产。

---

## 1. 项目背景

Codex 在本地会保存用户与模型交互时产生的会话数据，通常是 JSONL 格式。

但这些原始数据并不是面向用户阅读设计的，其中可能包含：

- 系统事件；
- 工具调用；
- 命令执行结果；
- 调试信息；
- 内部状态；
- UI 中不可见的元数据。

用户真正想保存的通常是：

- 自己提出的问题；
- Codex 在聊天界面中展示的回复；
- 一次开发任务的关键上下文；
- 可以继续整理成笔记的 Markdown 内容。

Codex Note Mirror 的作用：

```text
Codex JSONL → 可见聊天内容 → Markdown 笔记
```

---

## 2. 当前 MVP 能力

MVP 支持：

- 配置 Codex 数据目录；
- 配置 Markdown 输出目录；
- 扫描 `.jsonl` 文件；
- 解析 JSONL 会话数据；
- 提取用户消息和 Codex 回复；
- 过滤系统事件、工具事件、调试事件、元数据事件；
- 生成 Markdown 笔记；
- 按月份目录保存笔记；
- 通过 sync state 支持增量同步；
- 保留用户在 Markdown 中手写的补充内容；
- 查看同步状态；
- 诊断配置和同步问题。

---

## 3. MVP 暂不支持

- 图形界面；
- watch 自动监听模式；
- AI 自动摘要；
- AI 自动标题；
- 工具调用摘要；
- 涉及文件列表提取；
- Notion 同步；
- 飞书同步；
- Obsidian 插件；
- 云端同步；
- 多设备同步。

---

## 4. 安装

### 本地开发安装

```bash
git clone <repo-url>
cd codex-note-mirror
npm install
```

### 开发环境运行

```bash
npm run dev -- --help
```

### 构建

```bash
npm run build
```

### 运行测试

```bash
npm run test
```

---

## 5. 快速开始

### 初始化配置

```bash
codex-note-mirror init
```

也可以直接传参：

```bash
codex-note-mirror init \
  --source ~/.codex/sessions \
  --target ~/Notes/Codex
```

配置文件：

```text
~/.codex-note-mirror/config.json
```

示例：

```json
{
  "sourcePath": "/Users/you/.codex/sessions",
  "targetPath": "/Users/you/Notes/Codex",
  "outputFormat": "markdown",
  "syncMode": "view"
}
```

---

## 6. 同步 Codex 会话

```bash
codex-note-mirror sync
```

工具会：

1. 读取配置；
2. 扫描 Codex JSONL 文件；
3. 找出新增或变化的会话；
4. 解析用户可见消息；
5. 生成 Markdown 文件；
6. 更新同步状态。

输出示例：

```text
Codex Note Mirror

Source: /Users/you/.codex/sessions
Target: /Users/you/Notes/Codex

Found JSONL files: 16
New: 2
Changed: 1
Unchanged: 13

Synced: 3
Skipped: 0
Failed: 0
Conflicts: 0

Done.
```

---

## 7. Verbose 模式

```bash
codex-note-mirror sync --verbose
```

---

## 8. 查看同步状态

```bash
codex-note-mirror status
```

`status` 只查看状态，不会修改任何文件。

---

## 9. 诊断问题

```bash
codex-note-mirror doctor
```

doctor 会检查 config、sourcePath、targetPath、state、目标 Markdown 文件同步区块。

`doctor` 不会自动修复问题，也不会修改文件。

---

## 10. 输出目录结构

```text
~/Notes/Codex/
  └── 2026-06/
      ├── 2026-06-08_session-a1b2c3d4.md
      └── 2026-06-08_session-e5f6g7h8.md
```

---

## 11. Markdown 输出示例

```md
---
source: codex
session_id: a1b2c3d4e5f6
source_file: "/Users/you/.codex/sessions/abc.jsonl"
created_at: 2026-06-08T10:00:00+08:00
updated_at: 2026-06-08T10:30:00+08:00
sync_hash: e98adf77b21c
sync_mode: view
output_version: 1
parser_version: 1
---

# Codex Session a1b2c3d4

<!-- CODEX_SYNC_START -->

## 对话内容

### User

请帮我修复登录鉴权问题。

### Codex

可以，我们先检查 middleware 和 tenant 接口。

<!-- CODEX_SYNC_END -->

## 我的补充
```

---

## 12. 用户手写内容保护

再次同步时，工具只会更新同步区块内部内容。

同步区块外的内容会被保留：

```md
## 我的补充

这里是我自己写的笔记。
```

如果目标文件存在，但同步区块被删除，工具不会覆盖该文件，而是返回 conflict。

---

## 13. 增量同步机制

状态文件：

```text
~/.codex-note-mirror/state.json
```

重复执行 `codex-note-mirror sync` 时，工具会跳过未变化的 JSONL 文件，只处理新增或变化的文件。

---

## 14. 隐私说明

Codex Note Mirror 是本地优先工具。

MVP 阶段：

- 不上传任何数据；
- 不调用外部 API；
- 不做遥测；
- 不读取 sourcePath 之外的数据；
- 不写入 targetPath 和配置目录之外的位置；
- 不自动删除用户笔记；
- 不覆盖同步区块之外的用户内容。

---

## 15. 常见问题

### 为什么不直接复制 JSONL？

因为 Codex 原始 JSONL 更像机器日志，而不是用户笔记。

### 为什么 tool event 默认不输出？

MVP 阶段为了保证输出干净，默认过滤 tool event。

### 为什么 unknown event 默认过滤？

为了避免把内部日志写进用户笔记，MVP 采用保守策略：无法确认可见，就不写入笔记。

### 为什么文件名不用会话标题？

MVP 使用稳定文件名：

```text
YYYY-MM-DD_session-{shortId}.md
```

### 如果我修改了生成的 Markdown，会被覆盖吗？

同步区块之外的内容不会被覆盖。

### 如果同步区块被我删了怎么办？

工具不会覆盖文件，会将该文件标记为 conflict，并提示你手动处理。

---

## 16. 开发命令

```json
{
  "scripts": {
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "typecheck": "tsc --noEmit",
    "build": "tsup src/cli.ts --format esm --dts"
  }
}
```

---

## 17. 项目文档

```text
docs/
  ├── 01_PRD.md
  ├── 02_Technical_Design.md
  ├── 03_Parser_Spec.md
  ├── 04_Markdown_Output_Spec.md
  ├── 05_Task_Breakdown.md
  ├── 06_Test_Plan.md
  └── 07_README_Draft.md
```

---

## 18. Roadmap

### v0.1 MVP

本地 CLI、JSONL 解析、可见消息提取、Markdown 输出、增量同步、status、doctor。

### v0.2

watch 模式、更完整的 Codex 真实样本适配、unknown event 诊断报告。

### v0.3

自动标题、简短摘要、标签提取、涉及文件提取、待办事项提取。

### v0.4

Obsidian 适配、index.md、双链、项目目录归类。

### v0.5

多目标输出、静态站数据源、Notion / 飞书同步探索。

---

## 19. 设计原则

```text
本地优先
可见优先
保守过滤
增量同步
不破坏用户内容
```

最重要的是：不覆盖用户手写内容，不把内部噪声写入笔记，不上传用户数据。
