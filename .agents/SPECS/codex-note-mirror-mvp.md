# Codex Note Mirror MVP Spec

## Purpose
Implement the Codex Note Mirror MVP exactly as defined by the project documents. The tool is a local Node.js + TypeScript CLI that extracts user-visible Codex chat messages from JSONL session files and mirrors them into Markdown notes.

## Source Documents
- `docs/00_Codex_Execution_Prompt.md`
- `docs/01_PRD.md`
- `docs/02_Technical_Design.md`
- `docs/03_Parser_Spec.md`
- `docs/04_Markdown_Output_Spec.md`
- `docs/05_Task_Breakdown.md`
- `docs/06_Test_Plan.md`
- `docs/07_README_Draft.md`

## Non-Goals
- No GUI.
- No watch mode.
- No AI summaries, AI titles, tags, or file extraction.
- No Notion, Feishu, Obsidian, cloud, or multi-device sync.
- No full Codex session replay.
- No network calls or telemetry.

## Interfaces
- CLI commands: `init`, `sync`, `status`, `doctor`.
- Config path: `~/.codex-note-mirror/config.json`.
- State path: `~/.codex-note-mirror/state.json`.
- Input: recursive `.jsonl` files under configured `sourcePath`.
- Output: `targetPath/YYYY-MM/YYYY-MM-DD_session-{shortId}.md`.
- Markdown sync markers: `<!-- CODEX_SYNC_START -->` and `<!-- CODEX_SYNC_END -->`.

## Key Decisions
- One JSONL file maps to one session.
- Parser only validates JSONL lines and returns `RawEvent[]` plus parse errors.
- Extractor decides visibility and defaults unknown events to hidden.
- Markdown writer only replaces the sync block in existing files.
- Sync state uses source content hashes to determine new, changed, and unchanged files.
- Existing project docs are the canonical spec; implementation must not expand MVP scope.

## Edge Cases and Failure Modes
- Broken JSONL lines are reported without aborting the file.
- Non-object JSON lines are parse errors.
- Empty visible sessions are skipped and do not create Markdown.
- Existing Markdown missing sync markers is a conflict and must not be overwritten.
- Multiple sync marker pairs are a conflict and must not be overwritten.
- Invalid state is backed up and replaced with an empty state.
- `status` and `doctor` are read-only.

## Acceptance Criteria
- `init` writes a valid config from flags or prompts.
- `sync` scans, parses, extracts visible messages, renders Markdown, writes notes, and updates state.
- Repeat `sync` skips unchanged files.
- Changed source files update only the sync block.
- System, tool, debug, metadata, internal, unknown, and empty events do not appear as visible messages.
- User edits outside sync markers survive future syncs.
- Tests cover the core parser, extractor, renderer, path, state, and writer behavior from `docs/06_Test_Plan.md`.

## Test Plan
- Unit tests for parser, extractor, renderer, path resolver, sync state diff, and sync writer.
- Fixtures matching `docs/06_Test_Plan.md`.
- Integration-level sync behavior covered through temporary directories where practical.
- Verification commands: `npm run typecheck`, `npm run test`, `npm run build`, `npm run docs:check`.
