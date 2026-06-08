# Codex History Markdown Sync Script Decisions

## Decision: Build A Standalone CLI

Decision: package this as `scripts/codex-history-markdown-sync.mjs`, not as a reader feature.

Reason: the user paused product development and wants a simple transport/export tool for personal repository workflows. A standalone CLI avoids UI, permissions, and reader state complexity.

## Decision: Export Markdown Directly From Codex JSONL

Decision: parse Codex JSONL records and write Markdown files directly.

Reason: Codex assistant/user content is already Markdown-like text. Rendering into HTML or reader blocks would add unnecessary conversion layers for a personal editable archive.

## Decision: Mirror To A Directory, Do Not Push Git

Decision: support `--sync-dir` directory mirroring and reminder output, but do not run `git push` or remote sync.

Reason: syncing to a personal repository should remain under the user's control. The script can prepare updated files and remind the user to commit/push.

## Decision: Preserve Full Local Text For Explicit User-Run Export

Decision: this script preserves message/tool text by default because its purpose is personal knowledge archive export.

Reason: unlike committed project fixtures, this output is intentionally written to user-selected local destinations. The script still home-redacts source paths and does not commit outputs.

## Decision: Default To Clean Transcript Export

Decision: the default export mode is `clean`, which only renders visible user/Codex transcript records from `response_item` payloads and excludes `event_msg`, token counts, lifecycle events, reasoning, system prompts, and archived sessions.

Reason: Codex Desktop renders a curated conversation view, while the local JSONL files are an internal event stream. The user's editable knowledge archive should optimize for human reading; raw event export remains available through `--mode raw`, `--include-archived`, and `--include-tool-events`.

## Rejected Options

- Web renderer export: rejected because the user asked for a script and no extra presentation.
- Redacted-only output: rejected because the user needs useful personal reading material.
- Automatic Git push: rejected because remote synchronization needs user-owned repository policy.
