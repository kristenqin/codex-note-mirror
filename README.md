# Codex History Markdown Sync

Standalone CLI for exporting local Codex history JSONL into clean, editable Markdown transcripts.

The default export is optimized for human reading: it keeps visible user/Codex messages and excludes internal event noise such as token counts, lifecycle events, reasoning records, system prompts, and archived sessions.

## Quick Start

```bash
npm run sync:codex-history -- --output-dir /Users/qyx/Desktop/project/codex-history-markdown-export --once --max-files 20 --max-source-bytes 10485760 --max-total-output-bytes 104857600
```

Preview counts without writing files:

```bash
npm run sync:codex-history -- --output-dir /tmp/codex-history-test --once --stats --max-files 20
```

Inspect raw event-like messages explicitly:

```bash
npm run sync:codex-history -- --output-dir /tmp/codex-history-raw --once --mode raw --include-archived --include-tool-events
```

## Project Layout

- `scripts/codex-history-markdown-sync.mjs`: CLI implementation.
- `scripts/test-codex-history-markdown-sync.mjs`: focused behavior tests.
- `scripts/audit-codex-history-markdown-sync.mjs`: documentation and guardrail audit.
- `docs/codex-history-markdown-sync.md`: detailed usage docs.
- `fixtures/redacted/`: synthetic JSONL fixture for tests.
- `.agents/`: spec-first artifacts for maintenance.

## Verify

```bash
npm run verify
```
