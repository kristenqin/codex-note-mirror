# Codex Note Mirror 技术方案文档

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 文档名称 | 02_Technical_Design.md |
| 项目名称 | Codex Note Mirror |
| 文档类型 | 技术方案 |
| 当前版本 | v0.1 |
| 对应 PRD | 01_PRD.md |
| 目标阶段 | MVP |
| 推荐技术栈 | Node.js + TypeScript |
| 核心目标 | 从 Codex 本地 JSONL 会话数据中提取可见聊天内容，并增量同步为 Markdown 笔记 |

---

## 2. 技术目标

实现稳定、可维护、可扩展的数据处理管道：

```text
Codex JSONL
    ↓
SourceFile
    ↓
RawEvent
    ↓
Session
    ↓
VisibleMessage
    ↓
Markdown
    ↓
TargetFile + SyncState
```

要求：

1. 读取用户指定目录下的 Codex JSONL 文件；
2. 容忍部分 JSONL 行解析失败；
3. 将一个 JSONL 文件识别为一个 Codex 会话；
4. 从原始事件中提取用户可见消息；
5. 过滤系统事件、调试事件、工具调用细节等非笔记内容；
6. 渲染为结构稳定的 Markdown 文件；
7. 记录同步状态；
8. 支持增量同步；
9. 保护用户在 Markdown 中手写的内容；
10. 通过 status 和 doctor 命令查看状态与诊断问题。

---

## 3. 技术原则

### 3.1 本地优先

- 不上传数据；
- 不调用外部 API；
- 不启用 telemetry；
- 不访问 sourcePath 之外的 Codex 数据；
- 不写入 targetPath 和工具配置目录之外的位置。

### 3.2 管道分层

```text
scanner → parser → session builder → extractor → renderer → sync writer
```

### 3.3 中间模型隔离

```text
RawEvent → Session → VisibleMessage
```

不要让 Markdown 渲染器直接依赖 Codex 原始 JSONL 结构。

### 3.4 容错优先

- 单行 JSON 解析失败不能导致整个文件失败；
- 单个文件失败不能导致整个同步任务失败；
- 无法识别的事件类型默认跳过；
- 错误需要记录；
- sync state 损坏时需要备份并重建。

### 3.5 不覆盖用户内容

- 工具只能更新同步区块；
- 同步区块之外的内容必须保留；
- 如果目标文件缺失同步区块，不允许暴力覆盖。

---

## 4. 推荐技术栈

Runtime：Node.js + TypeScript。

依赖：

| 依赖 | 用途 | MVP 是否必需 |
|---|---|---|
| commander | CLI 命令注册 | 必需 |
| prompts | init 交互式输入 | 推荐 |
| fast-glob | 扫描 JSONL 文件 | 推荐 |
| fs-extra | 文件读写与目录创建 | 推荐 |
| zod | 配置与数据校验 | 推荐 |
| gray-matter | Markdown frontmatter 处理 | 推荐 |
| vitest | 单元测试 | 推荐 |
| tsup | 打包 CLI | 推荐 |
| chokidar | watch 模式 | 非 MVP |

---

## 5. 总体架构

```text
CLI Commands
  ↓
Config Layer
  ↓
Scanner
  ↓
Parser
  ↓
Session Builder
  ↓
Extractor
  ↓
Renderer
  ↓
Sync Writer
```

目录结构：

```text
codex-note-mirror/
  ├── src/
  │   ├── cli.ts
  │   ├── commands/
  │   │   ├── initCommand.ts
  │   │   ├── syncCommand.ts
  │   │   ├── statusCommand.ts
  │   │   └── doctorCommand.ts
  │   ├── config/
  │   ├── scanner/
  │   ├── parser/
  │   ├── session/
  │   ├── renderer/
  │   ├── sync/
  │   ├── doctor/
  │   ├── logger/
  │   └── utils/
  ├── tests/
  ├── package.json
  ├── tsconfig.json
  ├── README.md
  └── docs/
```

---

## 6. 核心数据流

```text
syncCommand
    ↓
loadConfig
    ↓
scanSourceFiles
    ↓
loadSyncState
    ↓
diffSourceFiles
    ↓
parseJsonlFile
    ↓
buildSession
    ↓
extractVisibleMessages
    ↓
renderMarkdown
    ↓
writeMarkdownFile
    ↓
saveSyncState
```

sync 伪代码：

```ts
async function syncCommand(options: SyncOptions) {
  const config = await loadConfigWithOverrides(options)
  const sourceFiles = await scanSourceFiles(config.sourcePath)
  const syncState = await loadSyncState()
  const diffResult = await diffSourceFiles(sourceFiles, syncState)
  const results = []

  for (const sourceFile of diffResult.filesToSync) {
    try {
      const parseResult = await parseJsonlFile(sourceFile.path)
      const session = buildSession({ sourceFile, rawEvents: parseResult.events })
      const visibleMessages = extractVisibleMessages(session)
      if (visibleMessages.length === 0) {
        results.push({ sourceFile: sourceFile.path, status: "skipped", reason: "no visible messages" })
        continue
      }
      const syncHash = hashVisibleMessages(visibleMessages)
      const markdown = renderMarkdown({ session, visibleMessages, syncHash }).markdown
      const targetFile = resolveTargetPath({ session, targetRoot: config.targetPath })
      const writeResult = await writeMarkdownFile({ targetFile, markdown })
      if (writeResult.status === "conflict") {
        results.push({ sourceFile: sourceFile.path, status: "conflict", reason: writeResult.reason })
        continue
      }
      syncState.sessions[session.id] = {
        sourceFile: sourceFile.path,
        targetFile,
        sourceModifiedAt: sourceFile.modifiedAt,
        contentHash: sourceFile.contentHash,
        lastSyncedAt: now(),
      }
      results.push({ sourceFile: sourceFile.path, status: "synced" })
    } catch (error) {
      results.push({ sourceFile: sourceFile.path, status: "failed", error })
    }
  }
  syncState.lastSyncedAt = now()
  await saveSyncState(syncState)
  printSyncSummary(results)
}
```

---

## 7. 配置设计

默认路径：

```text
~/.codex-note-mirror/config.json
~/.codex-note-mirror/state.json
```

Config：

```ts
export type Config = {
  sourcePath: string
  targetPath: string
  outputFormat: "markdown"
  syncMode: "view"
}
```

配置优先级：CLI 参数 > config.json > 默认值。

---

## 8. 模块设计

### Scanner

输出：

```ts
type SourceFile = {
  path: string
  fileName: string
  size: number
  modifiedAt: string
  contentHash: string
}
```

只负责从 sourcePath 找出候选 JSONL 文件。

### Parser

输出：

```ts
type ParseJsonlFileResult = {
  events: RawEvent[]
  errors: JsonlParseError[]
}
```

Parser 不判断事件是否可见。

### Session Builder

MVP：一个 JSONL 文件 = 一个 Session。

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

### Visible Message Extractor

```ts
type VisibleMessage = {
  role: "user" | "assistant"
  content: string
  createdAt?: string
}
```

默认过滤：system、tool、debug、internal、metadata、empty、unknown。

### Markdown Renderer

输出包含 frontmatter、一级标题、同步区块、对话内容、用户补充区。

### Sync State

```ts
export type SyncState = {
  version: 1
  lastSyncedAt?: string
  sessions: Record<string, SyncedSession>
}
```

### Sync Writer

目标文件不存在：创建完整 Markdown。

目标文件存在且包含同步区块：只替换同步区块。

目标文件存在但缺失同步区块：不覆盖，返回 conflict。

---

## 9. CLI 命令设计

```bash
codex-note-mirror init
codex-note-mirror sync
codex-note-mirror status
codex-note-mirror doctor
```

---

## 10. 错误处理设计

```ts
type AppErrorCode =
  | "CONFIG_NOT_FOUND"
  | "CONFIG_INVALID"
  | "SOURCE_PATH_NOT_FOUND"
  | "TARGET_PATH_NOT_WRITABLE"
  | "FILE_READ_FAILED"
  | "JSONL_PARSE_FAILED"
  | "NO_VISIBLE_MESSAGES"
  | "SYNC_BLOCK_NOT_FOUND"
  | "STATE_INVALID"
  | "UNKNOWN_ERROR"
```

state 损坏时备份旧文件，并创建新的空 state。

---

## 11. 测试策略

单元测试覆盖：

- parseJsonlFile；
- buildSession；
- extractVisibleMessages；
- renderMarkdown；
- replaceSyncBlock；
- diffSourceFiles；
- resolveTargetPath。

---

## 12. MVP 完成标准

1. `init` 可以生成有效配置；
2. `sync` 可以从 sourcePath 读取 JSONL；
3. `sync` 可以生成 Markdown 文件；
4. Markdown 中包含 frontmatter；
5. Markdown 中包含同步区块；
6. Markdown 中包含用户消息和 Codex 回复；
7. 系统事件和工具事件不会直接出现在 Markdown；
8. 第二次 sync 不会重复生成文件；
9. 源文件变化后可以更新目标文件；
10. 用户在同步区块外写入内容后不会被覆盖；
11. `status` 可以展示同步状态；
12. `doctor` 可以检查基础配置和路径问题；
13. 单行 JSONL 损坏不会导致整体同步失败；
14. 所有核心模块有基础测试覆盖。
