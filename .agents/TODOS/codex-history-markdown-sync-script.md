# Codex History Markdown Sync Script TODO

- [x] Inspect existing local fulltext importer and Codex JSONL parsing logic.
  Verify: `rg -n "local-fulltext|rollout-.*jsonl|textFromContent" scripts src docs`

- [x] Create spec-first artifacts for the standalone sync script.
  Verify: `.agents/SPECS/codex-history-markdown-sync-script.md`, `.agents/TODOS/codex-history-markdown-sync-script.md`, and `.agents/DECISIONS/codex-history-markdown-sync-script.md`

- [x] Implement Markdown export, manifest/state, watch mode, and optional mirror sync.
  Verify: `npm run test:codex-history-markdown-sync`

- [x] Add usage docs and package scripts.
  Verify: `npm run audit:codex-history-markdown-sync`

- [x] Run final focused verification.
  Verify: `npm run test:codex-history-markdown-sync && npm run audit:codex-history-markdown-sync && git diff --check`

- [x] Add clean transcript mode and explicit raw/archived escape hatches.
  Verify: `npm run test:codex-history-markdown-sync && npm run audit:codex-history-markdown-sync && git diff --check`
