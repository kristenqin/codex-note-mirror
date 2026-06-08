import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

async function read(path) {
  return readFile(join(root, path), "utf8");
}

async function pathExists(path) {
  try {
    return (await stat(join(root, path))).isFile();
  } catch {
    return false;
  }
}

const requiredFiles = [
  ".agents/SPECS/codex-history-markdown-sync-script.md",
  ".agents/TODOS/codex-history-markdown-sync-script.md",
  ".agents/DECISIONS/codex-history-markdown-sync-script.md",
  "scripts/codex-history-markdown-sync.mjs",
  "scripts/test-codex-history-markdown-sync.mjs",
  "scripts/audit-codex-history-markdown-sync.mjs",
  "docs/codex-history-markdown-sync.md"
];

for (const file of requiredFiles) {
  if (!(await pathExists(file))) fail(`Missing required file: ${file}`);
}

const packageJson = JSON.parse(await read("package.json"));
const spec = await read(".agents/SPECS/codex-history-markdown-sync-script.md");
const todo = await read(".agents/TODOS/codex-history-markdown-sync-script.md");
const decision = await read(".agents/DECISIONS/codex-history-markdown-sync-script.md");
const script = await read("scripts/codex-history-markdown-sync.mjs");
const test = await read("scripts/test-codex-history-markdown-sync.mjs");
const docs = await read("docs/codex-history-markdown-sync.md");

for (const phrase of [
  "Create a standalone script",
  "--output-dir <path>",
  "--sync-dir <path>",
  "--watch",
  "Generate one Markdown file per session",
  "Default to a clean transcript export",
  "Print a reminder when output changes",
  "Do not push to a remote Git repository automatically"
]) {
  if (!spec.includes(phrase)) fail(`Spec missing phrase: ${phrase}`);
}

for (const phrase of [
  "Implement Markdown export, manifest/state, watch mode, and optional mirror sync",
  "Add usage docs and package scripts",
  "Run final focused verification"
]) {
  if (!todo.includes(phrase)) fail(`Todo missing phrase: ${phrase}`);
}

for (const phrase of [
  "Decision: Build A Standalone CLI",
  "Decision: Export Markdown Directly From Codex JSONL",
  "Decision: Mirror To A Directory, Do Not Push Git",
  "Decision: Preserve Full Local Text For Explicit User-Run Export"
]) {
  if (!decision.includes(phrase)) fail(`Decision missing phrase: ${phrase}`);
}

for (const phrase of [
  "collectCodexHistoryFiles",
  "parseCodexJsonlSession",
  "renderSessionMarkdown",
  "renderIndexMarkdown",
  "mirrorChangedFiles",
  "assertOutputBudget",
  "maxSourceBytes",
  "maxTotalOutputBytes",
  "mode",
  "includeArchived",
  "statsOnly",
  "isExportableMessage",
  "pruneStaleSessionFiles",
  "Removed stale session files",
  "Reminder:",
  "--watch",
  "--interval-ms",
  "--sync-dir",
  "--mode",
  "--include-archived",
  "--stats",
  "includeToolEvents"
]) {
  if (!script.includes(phrase)) fail(`Script missing phrase: ${phrase}`);
}

for (const forbidden of ["git push", "git commit", "execFile(", "spawnSync(\"git\"", "rsync"]) {
  if (script.includes(forbidden)) fail(`Script should not invoke remote/repository sync command: ${forbidden}`);
}

for (const phrase of [
  "fixtures/redacted/importer-source",
  "Synthetic user text must be redacted",
  "Synthetic assistant text must be redacted",
  "Second unchanged run should report zero changed files",
  "Output byte limit should reject oversized output",
  "Source byte limit should report skipped oversized files",
  "Clean export should exclude event_msg user noise",
  "Raw export should keep event_msg user text",
  "Stats mode should print stats header",
  "Sync should remove stale session Markdown files",
  "Mirror session should match output session"
]) {
  if (!test.includes(phrase)) fail(`Test missing phrase: ${phrase}`);
}

for (const phrase of [
  "Codex History Markdown Sync",
  "exports local Codex chat history into editable Markdown files",
  "does not run `git add`, `git commit`, `git push`, `rsync`, or any remote sync command",
  "<HOME>/.codex/sessions/**/rollout-*.jsonl",
  "By default, it does not scan `<HOME>/.codex/archived_sessions`",
  "`clean`: default human-readable transcript mode",
  "`raw`: broader event-message mode",
  "`README.md`: session index",
  "`sessions/*.md`: one editable Markdown file per Codex session",
  "--watch --interval-ms 300000",
  "--mode raw --include-archived",
  "--stats",
  "--max-source-bytes",
  "--max-total-output-bytes",
  "npm run test:codex-history-markdown-sync"
]) {
  if (!docs.includes(phrase)) fail(`Docs missing phrase: ${phrase}`);
}

if (packageJson.scripts?.["sync:codex-history"] !== "node scripts/codex-history-markdown-sync.mjs") {
  fail("package.json missing sync:codex-history script.");
}
if (packageJson.scripts?.["test:codex-history-markdown-sync"] !== "node scripts/test-codex-history-markdown-sync.mjs") {
  fail("package.json missing test:codex-history-markdown-sync script.");
}
if (packageJson.scripts?.["audit:codex-history-markdown-sync"] !== "node scripts/audit-codex-history-markdown-sync.mjs") {
  fail("package.json missing audit:codex-history-markdown-sync script.");
}

console.log("Codex history Markdown sync audit");
console.log("=================================");

if (failures.length > 0) {
  console.error("\nFailures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Codex history Markdown sync passed.");
