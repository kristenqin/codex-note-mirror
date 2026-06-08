# Codex History Markdown Sync Script Spec

## Purpose

Create a standalone script that exports local Codex chat history into editable Markdown files and optionally keeps a second storage location synchronized. The script should reuse the project knowledge about Codex JSONL history shape without depending on the reader UI.

## Non-Goals

- Do not continue reader product development.
- Do not render a Web UI, HTML app, annotation UI, concept cards, or search UI.
- Do not commit exported private chat history.
- Do not require an approved import plan for this explicit user-run personal export script.
- Do not push to a remote Git repository automatically.

## Interfaces

- Script: `scripts/codex-history-markdown-sync.mjs`
- Test script: `scripts/test-codex-history-markdown-sync.mjs`
- Audit script: `scripts/audit-codex-history-markdown-sync.mjs`
- Docs: `docs/codex-history-markdown-sync.md`
- Package scripts:
  - `npm run sync:codex-history`
  - `npm run test:codex-history-markdown-sync`
  - `npm run audit:codex-history-markdown-sync`

## CLI Requirements

- `--source-root <path>`: Codex data root, default `<HOME>/.codex`.
- `--output-dir <path>`: editable Markdown destination, required unless `CODEX_HISTORY_OUTPUT_DIR` is set.
- `--sync-dir <path>`: optional mirror destination, also configurable through `CODEX_HISTORY_SYNC_DIR`.
- `--state-file <path>`: optional state file, default `<output-dir>/.codex-history-sync-state.json`.
- `--once`: run one scan/export/sync cycle.
- `--watch`: repeat scans.
- `--interval-ms <number>`: watch interval, default 300000.
- `--max-files <number>`: optional cap for testing or bounded personal export; `0` means all files.
- `--mode <clean|raw>`: export mode, default `clean`; `clean` keeps visible user/Codex transcript text, `raw` keeps broader JSONL message-like events.
- `--include-archived`: include `<HOME>/.codex/archived_sessions`.
- `--include-tool-events`: include tool call/result blocks in Markdown.
- `--stats`: print a non-writing preview with source/session/message counts.
- `--no-reminder`: suppress reminder output.

## Output Requirements

- Generate one Markdown file per session under `<output-dir>/sessions/`.
- Generate an index file at `<output-dir>/README.md`.
- Generate a manifest at `<output-dir>/manifest.json`.
- Default to a clean transcript export that ignores `event_msg` records, token counts, task lifecycle events, metadata, system prompts, reasoning, and archived sessions.
- Keep raw/event-level export available only through explicit CLI options.
- Preserve message Markdown text as-is when available.
- Include source path as `<HOME>/...` only, never absolute home paths.
- Use deterministic filenames.
- Update only changed files where content differs.
- Keep state with source file path, mtime, size, hash, output file, and last sync time.
- Copy changed output files to `--sync-dir` when configured.
- Print a reminder when output changes so the user can sync the destination to a personal repository.

## Acceptance Criteria

- The script exports committed synthetic Codex JSONL fixtures to Markdown.
- A second unchanged run reports no changed Markdown files.
- Changing source input produces changed Markdown and updates the mirror directory.
- The generated Markdown keeps user and assistant message bodies.
- The default clean export excludes internal `event_msg` noise and system-only records.
- The generated Markdown does not contain an absolute home path.
- The script supports `--once`, `--watch`, `--interval-ms`, `--output-dir`, `--sync-dir`, `--max-files`, `--mode`, `--include-archived`, and `--stats`.
- The audit validates script, test, docs, package scripts, and privacy guardrails.

## Test Plan

- Run `npm run test:codex-history-markdown-sync`.
- Run `npm run audit:codex-history-markdown-sync`.
- Run `git diff --check`.
