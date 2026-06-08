# Codex Execution Prompt

你正在开发一个名为 **Codex Note Mirror** 的本地 CLI 工具。

请先阅读 `docs/` 目录下的全部项目文档：

- `01_PRD.md`
- `02_Technical_Design.md`
- `03_Parser_Spec.md`
- `04_Markdown_Output_Spec.md`
- `05_Task_Breakdown.md`
- `06_Test_Plan.md`
- `07_README_Draft.md`

## MVP 开发目标

实现一个 Node.js + TypeScript CLI 工具，支持：

1. `init`：初始化 sourcePath / targetPath 配置；
2. `sync`：从 Codex 本地 JSONL 中提取可见聊天内容，并生成 Markdown；
3. `status`：查看同步状态；
4. `doctor`：诊断配置、路径、state、同步区块问题；
5. JSONL Parser：逐行解析 RawEvent；
6. Session Builder：一个 JSONL 文件映射一个 Session；
7. Visible Message Extractor：只提取 user / assistant 可见消息；
8. Markdown Renderer：渲染 frontmatter、同步区块和对话内容；
9. Sync State：基于 contentHash 做增量同步；
10. Sync Writer：只替换同步区块，保护用户手写内容。

## 必须遵守

- 不做图形界面；
- 不做 watch 模式；
- 不接入 AI 摘要；
- 不接入 Notion / 飞书 / Obsidian API；
- 不上传任何用户数据；
- 不读取 sourcePath 之外的数据；
- 不写入 targetPath 和配置目录之外的路径；
- 不覆盖同步区块之外的用户内容；
- 不将 unknown event 默认写入笔记；
- 不将 tool event 原样写入笔记。

## 推荐执行顺序

按照 `05_Task_Breakdown.md` 中的 T1 到 T18 顺序执行。

每完成一个任务后，请说明：

1. 修改了哪些文件；
2. 实现了哪些能力；
3. 如何运行测试；
4. 是否存在未完成事项。
