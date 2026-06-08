# Codex Note Mirror MVP TODO

- [x] T1-T4: scaffold TypeScript CLI, config paths, config validation, and `init`.
  Verify: `npm run typecheck && npm run test -- --run tests/config.test.ts`

- [x] T5-T8: implement scanner, JSONL parser, session builder, and visible message extractor.
  Verify: `npm run test -- --run tests/parser.test.ts tests/extractor.test.ts`

- [x] T9-T12: implement Markdown renderer, target path resolver, sync state, and sync writer.
  Verify: `npm run test -- --run tests/renderer.test.ts tests/path.test.ts tests/sync.test.ts`

- [x] T13-T15: wire `sync`, `status`, and `doctor` commands.
  Verify: `npm run typecheck && npm run test`

- [x] T16-T18: add fixtures, tests, and align README/package scripts.
  Verify: `npm run build && npm run docs:check`

- [x] Final verification.
  Verify: `npm run verify && npm run typecheck && npm run test && npm run build`
