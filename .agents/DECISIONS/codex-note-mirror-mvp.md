# Codex Note Mirror MVP Decisions

## Canonical Scope
The current `docs/` MVP package is the canonical product definition. Implementation follows those files instead of adding new product behavior.

## Implementation Approach
Use a straightforward TypeScript module layout matching `docs/02_Technical_Design.md`: CLI commands, config, scanner, parser, session, extractor, renderer, sync, doctor, logger, and utilities.

## Dependency Approach
Use the documented Node.js + TypeScript stack. Keep dependencies limited to MVP needs: CLI registration, optional prompts, glob scanning, filesystem helpers, validation, frontmatter support, tests, and build tooling.

## Safety Defaults
Prefer false negatives over unsafe output. Unknown events, tool events, empty messages, and ambiguous content remain hidden unless the parser spec explicitly marks them visible.

## Write Strategy
The sync writer is conservative: create missing files, replace exactly one existing sync block, and return conflict for missing or multiple sync blocks.

## Deferred Work
Watch mode, AI summaries, titles, tags, external integrations, and project categorization remain outside this MVP.
