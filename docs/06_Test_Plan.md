# Codex Note Mirror 测试计划文档

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 文档名称 | 06_Test_Plan.md |
| 项目名称 | Codex Note Mirror |
| 文档类型 | Test Plan / 测试计划 |
| 当前版本 | v0.1 |
| 对应文档 | 01_PRD.md / 02_Technical_Design.md / 03_Parser_Spec.md / 04_Markdown_Output_Spec.md / 05_Task_Breakdown.md |
| 目标阶段 | MVP |
| 核心目标 | 验证 Codex Note Mirror MVP 是否能稳定、安全地从 Codex JSONL 同步生成 Markdown 笔记 |

---

## 2. 测试目标

MVP 测试需要验证：

1. 工具可以正确初始化配置；
2. 工具可以扫描用户指定的 Codex JSONL 数据目录；
3. 工具可以解析 JSONL 文件；
4. 工具可以从 RawEvent 中提取用户可见消息；
5. 工具可以过滤系统事件、工具事件、调试事件、元数据事件和未知事件；
6. 工具可以生成结构稳定的 Markdown 文件；
7. 工具可以通过 sync state 实现增量同步；
8. 工具可以保护用户在 Markdown 中手写的内容；
9. 工具在异常数据下不会整体崩溃；
10. status 和 doctor 可以提供基础状态查看与诊断能力。

最高优先级：

```text
不丢数据，不误覆盖，不把内部噪声写进用户笔记。
```

---

## 3. 测试范围

范围内：Config 读写、init、扫描、parser、Session Builder、Extractor、Renderer、Target Path、Sync State、Sync Writer、sync、status、doctor、异常处理、用户手写内容保护、CLI 使用流程。

范围外：图形界面、watch、AI 摘要、AI 标题、Notion/飞书/Obsidian、云端同步、多用户、大规模性能压测、Codex 所有历史版本兼容性。

---

## 4. 测试类型

```text
单元测试
集成测试
CLI 手工验收
异常场景测试
数据安全测试
```

---

## 5. 测试环境

| 项目 | 要求 |
|---|---|
| Runtime | Node.js LTS |
| 语言 | TypeScript |
| 测试框架 | Vitest |
| 文件系统 | 本地临时目录 |
| 网络 | 不需要 |
| 外部 API | 不需要 |

测试目录：

```text
tests/
  ├── fixtures/
  ├── unit/
  ├── integration/
  └── helpers/
```

禁止使用真实 Codex 私密会话、真实 token、密钥、真实敏感路径、公司私有代码。

---

## 6. 测试 Fixture 设计

### simple-session.jsonl

```json
{"type":"message","role":"user","content":"你好"}
{"type":"message","role":"assistant","content":"你好，有什么可以帮你？"}
```

### multi-turn-session.jsonl

```json
{"type":"message","role":"user","content":"第一问"}
{"type":"message","role":"assistant","content":"第一答"}
{"type":"message","role":"user","content":"第二问"}
{"type":"message","role":"assistant","content":"第二答"}
```

### broken-line.jsonl

```json
{"type":"message","role":"user","content":"正常消息"}
{"type":"message","role":"assistant","content":"损坏消息"
{"type":"message","role":"assistant","content":"后续正常消息"}
```

### tool-events.jsonl

```json
{"type":"message","role":"user","content":"运行测试"}
{"type":"tool_call","name":"shell","args":{"cmd":"pnpm test"}}
{"type":"tool_result","content":"Tests passed"}
{"type":"message","role":"assistant","content":"测试已经通过。"}
```

### nested-content.jsonl

```json
{"type":"message","role":"assistant","content":{"text":"这是嵌套文本"}}
```

### array-content.jsonl

```json
{"type":"message","role":"assistant","content":[{"type":"text","text":"第一段"},{"type":"text","text":"第二段"}]}
```

### unknown-events.jsonl

```json
{"type":"some_new_event","payload":{"value":"未知内容"}}
{"type":"message","role":"user","content":"正常消息"}
```

### empty-visible-messages.jsonl

```json
{"type":"tool_call","name":"shell","args":{"cmd":"ls"}}
{"type":"tool_result","content":"package.json"}
{"type":"debug_log","content":"trace"}
```

---

## 7. 单元测试计划

### Config

| 编号 | 场景 | 预期 |
|---|---|---|
| CFG-001 | 保存合法配置 | config.json 被正确写入 |
| CFG-002 | 读取合法配置 | 返回 Config 对象 |
| CFG-003 | 配置文件不存在 | 抛出 CONFIG_NOT_FOUND |
| CFG-004 | 配置 JSON 损坏 | 抛出 CONFIG_INVALID |

### Scanner

| 编号 | 场景 | 预期 |
|---|---|---|
| SCAN-001 | 目录中有 JSONL 文件 | 返回 SourceFile |
| SCAN-002 | 子目录中有 JSONL 文件 | 可以递归扫描 |
| SCAN-003 | 目录中有非 JSONL 文件 | 不返回 |
| SCAN-004 | 空 JSONL 文件 | 不返回 |
| SCAN-005 | 隐藏文件 | 不返回 |
| SCAN-006 | sourcePath 不存在 | 抛出 SOURCE_PATH_NOT_FOUND |
| SCAN-007 | 文件内容相同 | contentHash 相同 |
| SCAN-008 | 文件内容变化 | contentHash 变化 |

### Parser

| 编号 | 场景 | 预期 |
|---|---|---|
| PARSE-001 | 正常 JSONL | events 数量正确 |
| PARSE-002 | 空行 | 空行被跳过 |
| PARSE-003 | 损坏 JSON 行 | 进入 errors |
| PARSE-004 | 损坏行后有正常行 | 后续行继续解析 |
| PARSE-005 | 非对象 JSON | 进入 errors |
| PARSE-006 | 空文件 | events 为空 |
| PARSE-007 | 文件不存在 | 抛出文件读取错误 |

### Extractor

| 编号 | 场景 | 预期 |
|---|---|---|
| EXT-001 | role=user | 分类为 user_message |
| EXT-002 | role=assistant | 分类为 assistant_message |
| EXT-003 | role=system | 分类为 system_event |
| EXT-004 | type=tool_call | 分类为 tool_event |
| EXT-005 | type=tool_result | 分类为 tool_event |
| EXT-006 | type=debug_log | 分类为 debug_event |
| EXT-007 | type=session_metadata | 分类为 metadata_event |
| EXT-008 | type=heartbeat | 分类为 internal_event |
| EXT-009 | 未知 type | 分类为 unknown_event |
| EXT-010 | user message | 输出 VisibleMessage |
| EXT-011 | assistant message | 输出 VisibleMessage |
| EXT-012 | tool event | 不输出 |
| EXT-013 | system event | 不输出 |
| EXT-014 | debug event | 不输出 |
| EXT-015 | unknown event | 不输出 |
| EXT-016 | content 为 string | 正常提取 |
| EXT-017 | content 为 object | 提取 text/content/message/value |
| EXT-018 | content 为 array | 拼接文本 |
| EXT-019 | message.content | 正常提取 |
| EXT-020 | 空 content | 不输出 |
| EXT-021 | 相邻重复消息 | 去重 |
| EXT-022 | 多轮消息 | 顺序不变 |

### Renderer

| 编号 | 场景 | 预期 |
|---|---|---|
| RENDER-001 | 基础 session | 生成 frontmatter |
| RENDER-002 | 基础 session | 生成一级标题 |
| RENDER-003 | 基础 session | 包含 CODEX_SYNC_START |
| RENDER-004 | 基础 session | 包含 CODEX_SYNC_END |
| RENDER-005 | user 消息 | 渲染为 ### User |
| RENDER-006 | assistant 消息 | 渲染为 ### Codex |
| RENDER-007 | 多轮消息 | 顺序正确 |
| RENDER-008 | content 中有代码块 | 代码块不被破坏 |

### Sync Writer

| 编号 | 场景 | 预期 |
|---|---|---|
| WRITE-001 | 目标文件不存在 | 创建新文件 |
| WRITE-002 | 目标文件存在且有同步区块 | 只替换同步区块 |
| WRITE-003 | 同步区块前有用户内容 | 保留 |
| WRITE-004 | 同步区块后有用户内容 | 保留 |
| WRITE-005 | 缺少同步区块 | 返回 conflict |
| WRITE-006 | 多个同步区块 | 返回 conflict |
| WRITE-007 | 新 Markdown 缺少同步区块 | 返回错误 |
| WRITE-008 | 目标目录不存在 | 自动创建目录 |
| WRITE-009 | conflict | 不写文件 |
| WRITE-010 | conflict | 不更新 state |

---

## 8. 集成测试计划

- INT-001 首次同步：生成月份目录、Markdown、state。
- INT-002 重复同步：第二次不重复创建。
- INT-003 源文件变化：识别 changed，更新同步区块。
- INT-004 用户手写内容保护：同步区块外内容保留。
- INT-005 缺失同步区块：返回 conflict，不覆盖。
- INT-006 Tool Event 过滤：Markdown 不包含 tool_call/tool_result。
- INT-007 损坏 JSONL 行：sync 不崩溃。
- INT-008 无可见消息：不生成 Markdown，标记 skipped。

---

## 9. CLI 手工验收计划

```bash
codex-note-mirror init --source ./tmp/source --target ./tmp/target
codex-note-mirror sync
codex-note-mirror sync --verbose
codex-note-mirror status
codex-note-mirror doctor
```

每个命令都应有明确输出，且 status/doctor 不修改文件。

---

## 10. 异常场景测试

| 编号 | 场景 | 预期 |
|---|---|---|
| ERR-001 | 配置不存在 | sync 终止，提示 init，不创建目标文件 |
| ERR-002 | sourcePath 不存在 | sync 终止，输出 SOURCE_PATH_NOT_FOUND |
| ERR-003 | targetPath 不可写 | 输出 TARGET_PATH_NOT_WRITABLE，不更新 state |
| ERR-004 | state.json 损坏 | 备份原 state，新建空 state，继续 sync，输出 warning |
| ERR-005 | 目标文件缺少同步区块 | 返回 conflict，不覆盖目标文件，不更新 state |
| ERR-006 | 目标文件存在多个同步区块 | 返回 conflict，doctor 输出 warning |

---

## 11. 数据安全测试

| 编号 | 验证点 | 预期 |
|---|---|---|
| SEC-001 | 不上传数据 | MVP 不产生任何网络请求 |
| SEC-002 | 不读取 sourcePath 之外的数据 | 只扫描 sourcePath 内部文件 |
| SEC-003 | 不写入 targetPath 和配置目录之外的位置 | 只写入 targetPath 与配置目录 |
| SEC-004 | 不覆盖用户手写内容 | 同步区块外内容完整保留 |
| SEC-005 | 不将 tool event 原样输出 | Markdown 中不包含 tool_call/tool_result/args/command_result |

---

## 12. MVP 验收清单

功能：init、sync、status、doctor、解析、过滤、Markdown、state、重复同步、变更更新、手写内容保护。

输出：frontmatter、一级标题、CODEX_SYNC_START、CODEX_SYNC_END、`### User`、`### Codex`、代码块保留、文件名稳定、按月份目录生成。

安全：不上传、不调用 API、不读取 sourcePath 外、不写 targetPath/配置目录外、不覆盖手写内容、不写 unknown/tool event。

---

## 13. 测试通过标准

1. 所有 P0 单元测试通过；
2. 所有 P0 集成测试通过；
3. init / sync / status / doctor 手工验收通过；
4. 数据安全测试通过；
5. 用户手写内容保护测试通过；
6. 没有会导致数据覆盖的已知 bug；
7. 没有会导致 sync 整体崩溃的常见解析错误；
8. README 中记录 MVP 限制。

---

## 14. 手工测试脚本示例

```bash
mkdir -p ./tmp/source
mkdir -p ./tmp/target

cat > ./tmp/source/simple-session.jsonl <<'EOF'
{"type":"message","role":"user","content":"你好"}
{"type":"message","role":"assistant","content":"你好，有什么可以帮你？"}
EOF

codex-note-mirror init --source ./tmp/source --target ./tmp/target
codex-note-mirror sync --verbose
find ./tmp/target -type f
cat ./tmp/target/*/*.md
codex-note-mirror sync --verbose
```

用户内容保护：

```bash
echo "\n这是我的补充内容。" >> ./tmp/target/*/*.md
codex-note-mirror sync --verbose
cat ./tmp/target/*/*.md
```

---

## 15. 测试命令建议

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "typecheck": "tsc --noEmit",
    "build": "tsup src/cli.ts --format esm --dts"
  }
}
```

发布前：

```bash
npm run typecheck
npm run test
npm run build
```
