# Codex History Markdown Sync

Status: implemented as a standalone script.

This script exports local Codex chat history into editable Markdown files and can mirror changed files into another local directory that you sync with a personal repository.

It does not start the reader UI, render HTML, create annotations, generate concept cards, or push to a remote Git repository.

By default, it writes a clean human-readable transcript rather than a raw Codex JSONL event dump. Internal `event_msg` records, token counts, lifecycle events, reasoning records, system prompts, and archived sessions are excluded unless you explicitly opt into raw/archived export.

## Command

```bash
npm run sync:codex-history -- --output-dir /path/to/editable-history --sync-dir /path/to/personal-repo/codex-history --once
```

For a first safe trial, cap file count and output size:

```bash
npm run sync:codex-history -- --output-dir /tmp/codex-history-test --once --max-files 3 --max-source-bytes 10485760 --max-total-output-bytes 52428800
```

To preview counts without writing files:

```bash
npm run sync:codex-history -- --output-dir /tmp/codex-history-test --once --stats --max-files 20
```

To inspect the broader event stream, opt in explicitly:

```bash
npm run sync:codex-history -- --output-dir /tmp/codex-history-raw --once --mode raw --include-archived --include-tool-events
```

For periodic checks:

```bash
npm run sync:codex-history -- --output-dir /path/to/editable-history --sync-dir /path/to/personal-repo/codex-history --watch --interval-ms 300000
```

## Inputs

By default the script scans:

- `<HOME>/.codex/sessions/**/rollout-*.jsonl`

By default, it does not scan `<HOME>/.codex/archived_sessions`. Add `--include-archived` when you want archived sessions included.

You can override the source root:

```bash
npm run sync:codex-history -- --source-root /path/to/codex-root --output-dir /path/to/editable-history --once
```

## Outputs

The output directory contains:

- `README.md`: session index;
- `manifest.json`: machine-readable session manifest;
- `sessions/*.md`: one editable Markdown file per Codex session;
- `.codex-history-sync-state.json`: local state for update detection.

Each session file preserves user and Codex Markdown text when available. Source paths are displayed as `<SOURCE_ROOT>/...` so generated files do not depend on absolute local paths.

## Export Modes

- `clean`: default human-readable transcript mode. It renders visible user/Codex messages from `response_item` records and excludes internal event noise.
- `raw`: broader event-message mode. It can include message-like `event_msg` records that Codex Desktop may not show in its main conversation view.

Tool calls and tool results are still excluded unless `--include-tool-events` is provided.

## Sync Behavior

If `--sync-dir` is provided, changed Markdown and manifest files are copied to the mirror directory. The script does not run `git add`, `git commit`, `git push`, `rsync`, or any remote sync command.

When changed files are detected, the script prints a reminder:

```text
Reminder: <target> has updates. Commit/push or sync it to your personal repository when ready.
```

Use `--no-reminder` to suppress that message.

## Options

| Option | Purpose |
| --- | --- |
| `--source-root <path>` | Codex data root. Default: `<HOME>/.codex`. |
| `--output-dir <path>` | Editable Markdown destination. Required unless `CODEX_HISTORY_OUTPUT_DIR` is set. |
| `--sync-dir <path>` | Optional mirror destination. Also supports `CODEX_HISTORY_SYNC_DIR`. |
| `--state-file <path>` | State file. Default: `<output-dir>/.codex-history-sync-state.json`. |
| `--once` | Run one scan/export/sync cycle. |
| `--watch` | Run repeatedly. |
| `--interval-ms <number>` | Watch interval. Default: `300000`. |
| `--max-files <number>` | Limit source files. `0` means all files. |
| `--max-source-bytes <number>` | Skip source files larger than this many bytes. Default: `26214400` (25 MiB). `0` disables the limit. |
| `--max-total-output-bytes <number>` | Stop before writing too much Markdown/manifest output. Default: `262144000` (250 MiB). `0` disables the limit. |
| `--mode <clean\|raw>` | Export mode. Default: `clean`. |
| `--include-archived` | Include `<HOME>/.codex/archived_sessions`. |
| `--include-tool-events` | Include tool call/result blocks. |
| `--stats` | Print source/session/message counts without writing output files. |
| `--no-reminder` | Suppress update reminder. |

## Verification

```bash
npm run test:codex-history-markdown-sync
npm run audit:codex-history-markdown-sync
```
