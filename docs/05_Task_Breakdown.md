# Codex Note Mirror 任务拆解文档

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 文档名称 | 05_Task_Breakdown.md |
| 项目名称 | Codex Note Mirror |
| 文档类型 | Task Breakdown / 开发任务拆解 |
| 当前版本 | v0.1 |
| 对应文档 | 01_PRD.md / 02_Technical_Design.md / 03_Parser_Spec.md / 04_Markdown_Output_Spec.md |
| 目标阶段 | MVP |
| 核心目标 | 将 MVP 拆解为可交付、可验证、可逐步执行的开发任务 |

---

## 2. 任务拆解原则

1. 每个任务只完成一个明确模块；
2. 每个任务都有清晰输入和输出；
3. 每个任务都有验收标准；
4. 每个任务尽量可以独立测试；
5. 不在一个任务中混合太多职责；
6. 优先完成主链路，再补增强功能；
7. 优先保证数据安全，再考虑体验优化；
8. 不提前实现非 MVP 功能。

---

## 3. MVP 主链路

```text
init
  ↓
scan sourcePath
  ↓
parse JSONL
  ↓
build session
  ↓
extract visible messages
  ↓
render Markdown
  ↓
write target file
  ↓
update sync state
  ↓
status / doctor
```

---

## 4. 任务总览

| 编号 | 任务 | 优先级 | 依赖 |
|---|---|---|---|
| T1 | 初始化项目骨架 | P0 | 无 |
| T2 | 实现配置目录与路径工具 | P0 | T1 |
| T3 | 实现 config 读写与校验 | P0 | T2 |
| T4 | 实现 init 命令 | P0 | T3 |
| T5 | 实现 sourcePath 扫描 | P0 | T3 |
| T6 | 实现 JSONL parser | P0 | T5 |
| T7 | 实现 Session Builder | P0 | T6 |
| T8 | 实现 Visible Message Extractor | P0 | T7 |
| T9 | 实现 Markdown Renderer | P0 | T8 |
| T10 | 实现 Target Path Resolver | P0 | T9 |
| T11 | 实现 Sync State | P0 | T5 |
| T12 | 实现 Sync Writer | P0 | T9 / T10 / T11 |
| T13 | 串联 sync 命令 | P0 | T5-T12 |
| T14 | 实现 status 命令 | P1 | T11 / T13 |
| T15 | 实现 doctor 命令 | P1 | T3 / T5 / T11 |
| T16 | 补充测试 fixtures | P0 | T6 / T8 / T9 |
| T17 | 补充单元测试 | P0 | T6-T12 |
| T18 | 补充 README 草稿 | P1 | T13-T15 |

---

## 5. 任务状态约定

```text
TODO
IN_PROGRESS
BLOCKED
DONE
```

任务完成必须满足：代码完成、测试通过、验收标准满足、没有明显破坏性行为。

---

## T1 初始化项目骨架

目标：初始化一个可运行的 TypeScript CLI 项目。

输出：

```text
codex-note-mirror/
  ├── src/cli.ts
  ├── tests/
  ├── docs/
  ├── package.json
  ├── tsconfig.json
  └── README.md
```

验收：依赖安装、dev 可启动、test 可运行、typecheck 通过、CLI 有 help。

禁止：不实现业务逻辑，不扫描真实 Codex 目录，不写入用户目录。

---

## T2 实现配置目录与路径工具

输出函数：

```ts
getAppConfigDir(): string
getConfigFilePath(): string
getStateFilePath(): string
```

默认路径：

```text
~/.codex-note-mirror/config.json
~/.codex-note-mirror/state.json
```

---

## T3 实现 config 读写与校验

输出函数：

```ts
loadConfig(): Promise<Config>
saveConfig(config: Config): Promise<void>
validateConfig(input: unknown): Config
```

Config：

```ts
type Config = {
  sourcePath: string
  targetPath: string
  outputFormat: "markdown"
  syncMode: "view"
}
```

---

## T4 实现 init 命令

```bash
codex-note-mirror init --source <path> --target <path>
```

要求：支持参数和交互式输入；校验 sourcePath；创建 targetPath；保存配置。

---

## T5 实现 sourcePath 扫描

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

要求：递归扫描 `.jsonl`，忽略空文件和隐藏文件，计算 contentHash。

---

## T6 实现 JSONL Parser

输出：

```ts
type ParseJsonlFileResult = {
  events: RawEvent[]
  errors: JsonlParseError[]
}
```

要求：空行跳过；损坏行进入 errors；非对象 JSON 进入 errors；单行失败不终止整个文件解析。

---

## T7 实现 Session Builder

输出：

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

要求：优先使用 `session_id/sessionId/conversation_id`；否则基于 path + hash 生成稳定 id。

---

## T8 实现 Visible Message Extractor

输出：

```ts
type VisibleMessage = {
  role: "user" | "assistant"
  content: string
  createdAt?: string
}
```

函数：

```ts
classifyRawEvent(event: RawEvent): RawEventCategory
getEventVisibility(category: RawEventCategory): Visibility
extractRole(event: RawEvent): "user" | "assistant" | undefined
extractContent(event: RawEvent): string
extractTimestamp(event: RawEvent): string | undefined
extractVisibleMessages(session: Session): VisibleMessage[]
```

要求：识别 user/assistant；过滤 system/tool/debug/metadata/internal/unknown；支持 string/object/array/message.content；相邻去重；保留顺序。

---

## T9 实现 Markdown Renderer

要求：生成 YAML frontmatter、一级标题、同步区块、`## 对话内容`、`### User`、`### Codex`；保留 Markdown 和代码块。

---

## T10 实现 Target Path Resolver

输出格式：

```text
targetRoot/YYYY-MM/YYYY-MM-DD_session-{shortId}.md
```

---

## T11 实现 Sync State

输出：

```ts
type DiffSourceFilesResult = {
  newFiles: SourceFile[]
  changedFiles: SourceFile[]
  unchangedFiles: SourceFile[]
  filesToSync: SourceFile[]
}
```

基于 contentHash 判断 new/changed/unchanged。

---

## T12 实现 Sync Writer

输出：

```ts
type WriteMarkdownFileResult = {
  status: "created" | "updated" | "conflict"
  reason?: string
}
```

要求：目标文件不存在则创建；存在则只替换同步区块；缺失或多个同步区块返回 conflict，不写文件。

---

## T13 串联 sync 命令

流程：

```text
load config → scan → load state → diff → parse → build session → extract → render → resolve path → write → update state → summary
```

验收：首次 sync 可生成 Markdown；重复 sync 不重复；源文件变化可更新；冲突保护用户文件。

---

## T14 实现 status 命令

展示 Source、Target、Synced sessions、New files、Changed files、Unchanged files、Last synced at。

status 不修改任何文件。

---

## T15 实现 doctor 命令

检查 config、sourcePath、targetPath、state、目标 Markdown 文件同步区块。

输出 PASS / WARNING / ERROR。doctor 不修改任何文件。

---

## T16 补充测试 Fixtures

```text
tests/fixtures/
  ├── simple-session.jsonl
  ├── multi-turn-session.jsonl
  ├── broken-line.jsonl
  ├── tool-events.jsonl
  ├── nested-content.jsonl
  ├── array-content.jsonl
  ├── unknown-events.jsonl
  └── empty-visible-messages.jsonl
```

禁止使用真实私密会话、token、密钥、公司项目私有代码。

---

## T17 补充单元测试

测试文件：

```text
tests/parser.test.ts
tests/extractor.test.ts
tests/renderer.test.ts
tests/sync.test.ts
tests/path.test.ts
```

---

## T18 补充 README 草稿

包含项目简介、安装、init/sync/status/doctor、输出目录示例、Markdown 示例、隐私说明、MVP 限制。

---

## 6. 推荐执行顺序

```text
第一阶段：项目可运行
T1 → T2 → T3 → T4

第二阶段：数据管道可跑通
T5 → T6 → T7 → T8 → T9 → T10

第三阶段：同步闭环
T11 → T12 → T13

第四阶段：状态与诊断
T14 → T15

第五阶段：测试与文档
T16 → T17 → T18
```

---

## 7. Agent 执行任务模板

```md
# Task: T{number} {title}

## Context

请阅读以下文档：

- docs/01_PRD.md
- docs/02_Technical_Design.md
- docs/03_Parser_Spec.md
- docs/04_Markdown_Output_Spec.md
- docs/05_Task_Breakdown.md

## Goal

实现 T{number} 中定义的目标。

## Scope

只允许修改 T{number} 中列出的修改范围。

## Requirements

按照 T{number} 的实现要求完成。

## Acceptance Criteria

必须满足 T{number} 的验收标准。

## Forbidden

不得违反 T{number} 的禁止事项。

## Output

完成后说明：

1. 修改了哪些文件；
2. 实现了哪些能力；
3. 如何运行测试；
4. 是否存在未完成事项。
```

---

## 8. MVP 开发禁止事项总表

1. 不做图形界面；
2. 不做 watch 模式；
3. 不接入 AI 摘要；
4. 不接入 Notion / 飞书 / Obsidian API；
5. 不上传任何用户数据；
6. 不读取 sourcePath 之外的 Codex 数据；
7. 不写入 targetPath 和配置目录之外的路径；
8. 不覆盖用户同步区块之外的内容；
9. 不在解析失败时直接终止整个同步；
10. 不将 unknown event 默认写入笔记；
11. 不将 tool event 原样写入笔记；
12. 不使用真实用户隐私数据作为测试 fixture。
