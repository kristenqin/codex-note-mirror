# Codex Note Mirror 解析规则文档

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 文档名称 | 03_Parser_Spec.md |
| 项目名称 | Codex Note Mirror |
| 文档类型 | Parser Spec / 解析规则文档 |
| 当前版本 | v0.1 |
| 对应文档 | 01_PRD.md / 02_Technical_Design.md |
| 目标阶段 | MVP |
| 核心目标 | 定义 Codex JSONL 原始事件如何被解析、过滤，并转换为用户可见消息 |

---

## 2. 文档目标

定义：

1. JSONL 文件如何被读取；
2. 单行 JSON 如何被解析为 RawEvent；
3. RawEvent 如何被分类；
4. 哪些事件应该进入最终笔记；
5. 哪些事件应该被过滤；
6. content 字段如何提取文本；
7. unknown event 如何处理；
8. 解析失败如何记录；
9. 用哪些 fixture 验证解析规则。

---

## 3. Parser 与 Extractor 边界

Parser 负责：读取 `.jsonl`、按行解析 JSON、输出 RawEvent、记录损坏行、不主动丢弃合法事件。

Extractor 负责：判断事件类型、判断可见性、提取消息文本、过滤不可见事件、生成 VisibleMessage。

原则：

```text
Parser 只回答：这一行是不是合法 JSON？
Extractor 才回答：这个事件要不要进入笔记？
```

---

## 4. 输入数据定义

MVP 只处理 `.jsonl` 文件。

```json
{"type":"message","role":"user","content":"请帮我修复登录问题"}
{"type":"message","role":"assistant","content":"可以，先检查鉴权中间件。"}
```

读取规则：UTF-8；支持 `\n` 和 `\r\n`；空行跳过；每行独立解析；单行解析失败不影响其他行。

---

## 5. RawEvent 定义

```ts
export type RawEvent = {
  type?: string
  role?: string
  content?: unknown
  text?: unknown
  message?: unknown
  timestamp?: string
  created_at?: string
  session_id?: string
  sessionId?: string
  conversation_id?: string
  [key: string]: unknown
}
```

---

## 6. Parser 输出定义

```ts
export type ParseJsonlFileResult = {
  events: RawEvent[]
  errors: JsonlParseError[]
}

export type JsonlParseError = {
  lineNumber: number
  rawLine: string
  message: string
}
```

---

## 7. Parser 解析规则

- 正常 JSON 对象进入 events；
- 空行跳过；
- 损坏 JSON 行进入 errors；
- 非对象 JSON 进入 errors；
- 单行损坏不终止整个文件解析。

---

## 8. 事件分类

```ts
export type RawEventCategory =
  | "user_message"
  | "assistant_message"
  | "system_event"
  | "tool_event"
  | "debug_event"
  | "metadata_event"
  | "internal_event"
  | "unknown_event"
```

可见性：

```ts
export type Visibility = "visible" | "hidden" | "unknown"
```

MVP 保守策略：无法确定是否可见时，默认不进入笔记。

---

## 9. User Message 识别规则

满足任一条件：

```ts
event.role === "user"
event.type === "user_message"
event.type === "message" && event.role === "user"
event.type === "input" && event.role === "user"
event.type === "turn" && event.role === "user"
```

过滤：content 为空、无法提取文本、相邻重复。

---

## 10. Assistant Message 识别规则

满足任一条件：

```ts
event.role === "assistant"
event.type === "assistant_message"
event.type === "message" && event.role === "assistant"
event.type === "output" && event.role === "assistant"
event.type === "turn" && event.role === "assistant"
```

过滤：content 为空、工具调用参数、命令执行原始结果、相邻重复。

---

## 11. Hidden Event 识别规则

### System Event

```ts
event.role === "system"
event.type === "system"
event.type === "system_event"
event.type === "instruction"
event.type === "developer_message"
```

### Tool Event

```ts
event.type?.includes("tool")
event.type === "function_call"
event.type === "function_result"
event.type === "command"
event.type === "command_result"
event.type === "shell"
event.type === "patch"
event.type === "apply_patch"
event.name === "apply_patch"
event.name === "shell"
```

### Debug Event

```ts
event.type?.includes("debug")
event.type?.includes("trace")
event.type?.includes("log")
event.level === "debug"
event.level === "trace"
```

### Metadata Event

```ts
event.type?.includes("metadata")
event.type === "session_metadata"
event.type === "conversation_metadata"
event.type === "state"
event.type === "checkpoint"
event.type === "snapshot"
```

### Internal Event

```ts
event.type?.includes("internal")
event.type?.includes("lifecycle")
event.type === "start"
event.type === "end"
event.type === "heartbeat"
event.type === "status"
event.type === "progress"
```

Hidden event 不进入 Markdown 正文。

---

## 12. Unknown Event 处理规则

无法分类的 RawEvent 视为 unknown_event。

MVP 默认不进入 Markdown，但记录诊断信息：

```ts
type UnknownEventLog = {
  sourceFile: string
  sessionId: string
  eventIndex: number
  eventType?: string
  keys: string[]
}
```

---

## 13. Content 提取规则

字段优先级：

```text
content
text
message
body
value
```

content 是字符串：直接返回。

content 是数组：遍历元素，提取 `text/content/message/value`，用两个换行拼接。

content 是对象：尝试读取 `content.text/content.content/content.message/content.value/content.body`。

message 是对象：支持 `message.content/message.text/message.role`。

最大递归深度：3。

---

## 14. Role 提取规则

优先级：

```text
event.role
event.message.role
event.author.role
event.type 推断
```

映射：

| 原始 role | 标准 role |
|---|---|
| user | user |
| human | user |
| assistant | assistant |
| ai | assistant |
| model | assistant |
| codex | assistant |

---

## 15. 时间字段提取规则

候选字段：

```text
timestamp
created_at
createdAt
time
date
```

MVP 不强制格式化时间。

---

## 16. 去重规则

只做相邻消息去重：

```text
如果当前消息和上一条消息 role 相同，并且 content 完全相同，则跳过当前消息。
```

---

## 17. Extractor 输出定义

```ts
export type VisibleMessage = {
  role: "user" | "assistant"
  content: string
  createdAt?: string
}
```

---

## 18. 完整转换示例

输入：

```json
{"type":"session_metadata","session_id":"abc123","created_at":"2026-06-08T10:00:00+08:00"}
{"type":"message","role":"user","content":"请帮我修复登录鉴权问题"}
{"type":"tool_call","name":"shell","args":{"cmd":"ls"}}
{"type":"tool_result","content":"src\npackage.json"}
{"type":"message","role":"assistant","content":"可以，我们先检查 middleware 和 tenant 接口。"}
{"type":"debug_log","content":"internal trace..."}
```

输出：

```ts
[
  { role: "user", content: "请帮我修复登录鉴权问题" },
  { role: "assistant", content: "可以，我们先检查 middleware 和 tenant 接口。" }
]
```

---

## 19. Fixture 设计

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

---

## 20. 推荐函数拆分

```ts
function classifyRawEvent(event: RawEvent): RawEventCategory
function getEventVisibility(category: RawEventCategory): Visibility
function extractRole(event: RawEvent): "user" | "assistant" | undefined
function extractContent(event: RawEvent): string
function extractTimestamp(event: RawEvent): string | undefined
function extractVisibleMessages(session: Session): VisibleMessage[]
```

---

## 21. MVP 解析完成标准

1. 可以解析正常 JSONL；
2. 可以跳过空行；
3. 可以记录损坏 JSON 行；
4. 可以过滤非对象 JSON；
5. 可以识别 user message；
6. 可以识别 assistant message；
7. 可以过滤 system event；
8. 可以过滤 tool event；
9. 可以过滤 debug event；
10. 可以过滤 metadata event；
11. 可以过滤 internal event；
12. 可以默认过滤 unknown event；
13. 可以从 string/object/array/message.content 中提取文本；
14. 可以保留消息原始顺序；
15. 可以做相邻重复消息过滤；
16. 所有规则有 fixture 测试覆盖。
