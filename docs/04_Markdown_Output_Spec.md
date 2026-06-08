# Codex Note Mirror Markdown 输出规范

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 文档名称 | 04_Markdown_Output_Spec.md |
| 项目名称 | Codex Note Mirror |
| 文档类型 | Markdown Output Spec / 输出格式规范 |
| 当前版本 | v0.1 |
| 对应文档 | 01_PRD.md / 02_Technical_Design.md / 03_Parser_Spec.md |
| 目标阶段 | MVP |
| 核心目标 | 定义 Codex 会话被同步为 Markdown 笔记时的文件结构、正文格式、同步区块和用户内容保护规则 |

---

## 2. 文档目标

定义：

1. 生成的 Markdown 文件放在哪里；
2. 文件如何命名；
3. Markdown frontmatter 包含哪些字段；
4. 同步区块如何定义；
5. 用户手写内容如何保留；
6. User / Codex 消息如何渲染；
7. 空内容、代码块、多轮消息如何处理；
8. 目标文件已存在时如何更新；
9. 什么情况不能覆盖用户文件。

---

## 3. 输出设计原则

- 稳定优先；
- 可读优先；
- 可同步优先；
- 用户内容安全优先。

自动同步区块：

```md
<!-- CODEX_SYNC_START -->

...

<!-- CODEX_SYNC_END -->
```

---

## 4. 输出目录结构

输出到：

```text
targetPath/YYYY-MM/YYYY-MM-DD_session-{shortId}.md
```

示例：

```text
/Users/yingxin/Notes/Codex/
  └── 2026-06/
      └── 2026-06-08_session-a1b2c3d4.md
```

MVP 默认按月份目录分组，不生成 index.md。

---

## 5. 文件命名规范

格式：

```text
YYYY-MM-DD_session-{shortId}.md
```

字段来源：

| 片段 | 来源 |
|---|---|
| YYYY-MM-DD | session.createdAt |
| shortId | session.id 前 8 位 |
| .md | 固定 Markdown 扩展名 |

日期缺失优先级：

```text
session.createdAt > sourceFile.modifiedAt > now()
```

MVP 不把用户消息或标题直接放入文件名。

---

## 6. Markdown 文件整体结构

```md
---
source: codex
session_id: {{session.id}}
source_file: "{{session.sourceFile}}"
created_at: {{session.createdAt}}
updated_at: {{session.updatedAt}}
sync_hash: {{syncHash}}
sync_mode: view
output_version: 1
parser_version: 1
---

# {{session.title}}

<!-- CODEX_SYNC_START -->

## 对话内容

{{messages}}

<!-- CODEX_SYNC_END -->

## 我的补充
```

---

## 7. Frontmatter 规范

必填字段：

| 字段 | 类型 | 含义 |
|---|---|---|
| source | string | 固定为 `codex` |
| session_id | string | 内部 session id |
| source_file | string | 原始 JSONL 文件路径 |
| created_at | string | 会话创建时间 |
| updated_at | string | 会话更新时间 |
| sync_hash | string | 当前同步内容 hash |
| sync_mode | string | MVP 固定为 `view` |
| output_version | number | 输出格式版本 |
| parser_version | number | 解析器版本 |

路径字段建议加引号。

---

## 8. 标题规范

一级标题：

```md
# Codex Session {shortId}
```

标题优先级：

```text
session.title > Codex Session {shortId}
```

MVP 不做 AI 标题生成。

---

## 9. 同步区块规范

要求：

1. 开始标记必须独占一行；
2. 结束标记必须独占一行；
3. 一个 Markdown 文件只能有一组同步标记；
4. 标记名称固定，不允许用户配置；
5. 同步标记之外的内容不允许被自动覆盖。

同步区块内容：

```md
## 对话内容

### User

...

### Codex

...
```

---

## 10. 用户补充区规范

新建文件时，默认在同步区块后生成：

```md
## 我的补充
```

用户可以在同步区块外自由编辑，工具必须保留所有同步区块外内容。

---

## 11. 消息渲染规范

User：

```md
### User

{{content}}
```

Codex：

```md
### Codex

{{content}}
```

多轮对话按 VisibleMessage 原始顺序渲染。

---

## 12. Content 保留规范

VisibleMessage.content 默认按 Markdown 原样写入，保留列表、表格、代码块、引用、命令、文件路径、Markdown 标题。

换行统一使用 `\n`。渲染前去掉 content 首尾空白，保留内部换行。

---

## 13. 空内容处理

空消息不渲染。

没有任何 VisibleMessage 的 session 不生成 Markdown，sync 结果标记为 skipped，原因是 no visible messages。

---

## 14. 写入策略

### 新文件

创建月份目录，写入完整 Markdown，更新 sync state。

### 已存在文件

只替换同步区块，保留同步区块外全部内容。

### 缺失同步区块

不覆盖文件，不更新 state，标记为 conflict。

### 多个同步区块

不覆盖文件，标记为 conflict，doctor 输出 warning。

---

## 15. replaceSyncBlock 规范

```ts
function replaceSyncBlock(existingMarkdown: string, nextMarkdown: string): string
```

规则：

1. 从 existingMarkdown 中找到旧同步区块；
2. 从 nextMarkdown 中找到新同步区块；
3. 将旧同步区块整体替换为新同步区块；
4. 保留 existingMarkdown 中同步区块外内容；
5. 不使用 nextMarkdown 的用户补充区覆盖 existingMarkdown 的用户补充区。

---

## 16. Frontmatter 更新策略

MVP 阶段目标文件已存在时，只替换同步区块，不更新 frontmatter。

---

## 17. Sync Hash 规范

sync_hash 表示当前生成的同步内容 hash。

hash 计算范围：VisibleMessage[] 序列化后的内容，而不是整个 Markdown 文件。

---

## 18. 输出示例

```md
---
source: codex
session_id: a1b2c3d4e5f6
source_file: "/Users/yingxin/.codex/sessions/abc.jsonl"
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

请帮我修复登录鉴权问题

### Codex

可以，我们先检查 middleware 和 tenant 接口。

<!-- CODEX_SYNC_END -->

## 我的补充
```

---

## 19. 冲突处理

```ts
type MarkdownWriteConflict =
  | "SYNC_BLOCK_NOT_FOUND"
  | "MULTIPLE_SYNC_BLOCKS"
  | "TARGET_NOT_WRITABLE"
```

原则：不覆盖、不删除、不更新 state、记录到 sync 结果、doctor 可见。

---

## 20. MVP 完成标准

1. 可以按月份目录生成 Markdown 文件；
2. 文件名稳定且安全；
3. Markdown 包含 YAML frontmatter；
4. Markdown 包含一级标题；
5. Markdown 包含同步区块；
6. 同步区块内包含对话内容；
7. User 消息渲染为 `### User`；
8. Codex 消息渲染为 `### Codex`；
9. 代码块和 Markdown 内容不被破坏；
10. 空会话不生成文件；
11. 已存在文件只更新同步区块；
12. 同步区块外用户内容被保留；
13. 缺失同步区块时不覆盖文件；
14. 多个同步区块时不覆盖文件；
15. 基础输出逻辑有单元测试覆盖。
