#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import readline from "node:readline";

const home = homedir();
const args = parseArgs(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  printHelp();
  process.exit(0);
}

const sourceRoot = String(args.get("--source-root") || join(home, ".codex"));
const outputDir = String(args.get("--output-dir") || process.env.CODEX_HISTORY_OUTPUT_DIR || "");
const syncDir = args.has("--sync-dir")
  ? String(args.get("--sync-dir"))
  : (process.env.CODEX_HISTORY_SYNC_DIR || "");
const stateFile = String(args.get("--state-file") || (outputDir ? join(outputDir, ".codex-history-sync-state.json") : ""));
const maxFiles = Number(args.get("--max-files") ?? 0);
const maxSourceBytes = Number(args.get("--max-source-bytes") ?? 25 * 1024 * 1024);
const maxTotalOutputBytes = Number(args.get("--max-total-output-bytes") ?? 250 * 1024 * 1024);
const intervalMs = Number(args.get("--interval-ms") ?? 300_000);
const mode = String(args.get("--mode") || "clean");
const includeArchived = args.has("--include-archived");
const includeToolEvents = args.has("--include-tool-events");
const statsOnly = args.has("--stats");
const watch = args.has("--watch");
const once = args.has("--once") || !watch;
const reminder = !args.has("--no-reminder");

if (!outputDir) {
  throw new Error("Missing --output-dir. Choose an editable destination or set CODEX_HISTORY_OUTPUT_DIR.");
}
if (!Number.isFinite(maxFiles) || maxFiles < 0) throw new Error("--max-files must be a non-negative number.");
if (!Number.isFinite(maxSourceBytes) || maxSourceBytes < 0) throw new Error("--max-source-bytes must be a non-negative number.");
if (!Number.isFinite(maxTotalOutputBytes) || maxTotalOutputBytes < 0) throw new Error("--max-total-output-bytes must be a non-negative number.");
if (!Number.isFinite(intervalMs) || intervalMs < 1000) throw new Error("--interval-ms must be at least 1000.");
if (!["clean", "raw"].includes(mode)) throw new Error("--mode must be either clean or raw.");

if (once) {
  await runOnce();
} else {
  await runWatch();
}

async function runWatch() {
  console.log(`Watching Codex history every ${intervalMs} ms.`);
  await runOnce();
  setInterval(() => {
    runOnce().catch((error) => {
      console.error(`[codex-history-sync] ${error instanceof Error ? error.message : String(error)}`);
    });
  }, intervalMs);
}

async function runOnce() {
  const startedAt = new Date().toISOString();
  const state = await readState(stateFile);
  const { files: sourceFiles, skipped: skippedSourceFiles } = await collectCodexHistoryFiles(sourceRoot, {
    maxFiles,
    maxSourceBytes,
    includeArchived
  });
  const sessions = [];

  for (const sourceFile of sourceFiles) {
    sessions.push(await parseCodexJsonlSession(sourceFile, sourceRoot));
  }

  if (statsOnly) {
    printStats({ sourceFiles, skippedSourceFiles, sessions });
    return;
  }

  await mkdir(join(outputDir, "sessions"), { recursive: true });
  const changedFiles = [];
  const sessionEntries = [];
  let totalOutputBytes = 0;

  for (const session of sessions) {
    const markdown = renderSessionMarkdown(session);
    totalOutputBytes += Buffer.byteLength(markdown, "utf8");
    assertOutputBudget(totalOutputBytes, maxTotalOutputBytes);
    const outputFile = join(outputDir, "sessions", `${session.fileId}.md`);
    const changed = await writeIfChanged(outputFile, markdown);
    if (changed) changedFiles.push(outputFile);
    const sourceStat = await stat(session.sourceFile);
    const relativeOutputFile = `sessions/${basename(outputFile)}`;
    sessionEntries.push({
      id: session.id,
      title: session.title,
      sourcePath: session.sourcePath,
      outputFile: relativeOutputFile,
      messageCount: session.messages.length,
      eventCount: session.events.length,
      rawRecordCount: session.rawRecordCount,
      mtimeMs: sourceStat.mtimeMs,
      size: sourceStat.size,
      sourceHash: await hashFile(session.sourceFile)
    });
  }

  const activeSessionFiles = new Set(sessionEntries.map((session) => session.outputFile));
  const removedFiles = await pruneStaleSessionFiles(outputDir, activeSessionFiles);

  const generatedAt = new Date(Math.max(0, ...sessionEntries.map((session) => session.mtimeMs))).toISOString();
  const manifest = {
    schemaVersion: "codex-history-markdown-sync/0.1.0",
    generatedAt,
    sourceRoot: homeRedactedPath(sourceRoot),
    outputDir: homeRedactedPath(outputDir),
    syncDir: syncDir ? homeRedactedPath(syncDir) : null,
    mode,
    includeArchived,
    limits: {
      maxFiles,
      maxSourceBytes,
      maxTotalOutputBytes
    },
    sessionCount: sessionEntries.length,
    messageCount: sessionEntries.reduce((sum, session) => sum + session.messageCount, 0),
    skippedSourceFiles,
    sessions: sessionEntries.sort((left, right) => {
      if (right.mtimeMs !== left.mtimeMs) return right.mtimeMs - left.mtimeMs;
      return left.sourcePath.localeCompare(right.sourcePath);
    })
  };

  totalOutputBytes += Buffer.byteLength(JSON.stringify(manifest, null, 2), "utf8");
  assertOutputBudget(totalOutputBytes, maxTotalOutputBytes);
  if (await writeIfChanged(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)) {
    changedFiles.push(join(outputDir, "manifest.json"));
  }
  const indexMarkdown = renderIndexMarkdown(manifest);
  totalOutputBytes += Buffer.byteLength(indexMarkdown, "utf8");
  assertOutputBudget(totalOutputBytes, maxTotalOutputBytes);
  if (await writeIfChanged(join(outputDir, "README.md"), indexMarkdown)) {
    changedFiles.push(join(outputDir, "README.md"));
  }

  const syncedFiles = syncDir ? await mirrorChangedFiles(changedFiles, outputDir, syncDir) : [];
  const removedSyncedFiles = syncDir ? await pruneStaleSessionFiles(syncDir, activeSessionFiles) : [];
  const nextState = {
    schemaVersion: "codex-history-markdown-sync-state/0.1.0",
    updatedAt: startedAt,
    sourceRoot: homeRedactedPath(sourceRoot),
    outputDir: homeRedactedPath(outputDir),
    syncDir: syncDir ? homeRedactedPath(syncDir) : null,
    mode,
    includeArchived,
    lastChangedCount: changedFiles.length,
    lastSyncedCount: syncedFiles.length,
    lastRemovedCount: removedFiles.length,
    lastRemovedSyncedCount: removedSyncedFiles.length,
    skippedSourceFiles,
    sessions: Object.fromEntries(sessionEntries.map((session) => [session.sourcePath, session]))
  };
  await writeFile(stateFile, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");

  const previousSessionKeys = new Set(Object.keys(state.sessions ?? {}));
  const currentSessionKeys = new Set(sessionEntries.map((session) => session.sourcePath));
  const newSessionCount = [...currentSessionKeys].filter((key) => !previousSessionKeys.has(key)).length;

  console.log("Codex history Markdown sync");
  console.log("===========================");
  console.log(`Source files: ${sourceFiles.length}`);
  if (skippedSourceFiles.length > 0) console.log(`Skipped oversized files: ${skippedSourceFiles.length}`);
  console.log(`Sessions exported: ${sessionEntries.length}`);
  console.log(`Changed output files: ${changedFiles.length}`);
  if (removedFiles.length > 0) console.log(`Removed stale session files: ${removedFiles.length}`);
  if (syncDir) console.log(`Synced files: ${syncedFiles.length}`);
  if (syncDir && removedSyncedFiles.length > 0) console.log(`Removed stale synced files: ${removedSyncedFiles.length}`);
  if (newSessionCount > 0) console.log(`New sessions: ${newSessionCount}`);
  if ((changedFiles.length > 0 || removedFiles.length > 0 || removedSyncedFiles.length > 0) && reminder) {
    const target = syncDir || outputDir;
    console.log(`Reminder: ${homeRedactedPath(target)} has updates. Commit/push or sync it to your personal repository when ready.`);
  }
}

function parseArgs(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--") && arg !== "-h") continue;
    if (arg === "-h") {
      parsed.set("-h", true);
      continue;
    }
    parsed.set(arg, argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true);
  }
  return parsed;
}

async function collectCodexHistoryFiles(root, { maxFiles: limit, maxSourceBytes: sourceByteLimit, includeArchived: archived }) {
  const groups = [
    { root: join(root, "sessions"), prefix: "rollout-", extension: ".jsonl" }
  ];
  if (archived) {
    groups.push({ root: join(root, "archived_sessions"), prefix: "rollout-", extension: ".jsonl" });
  }
  const files = [];
  for (const group of groups) files.push(...(await listFiles(group.root, group)));
  const unique = [...new Set(files)];
  const candidates = [];
  for (const file of unique) candidates.push({ file, fileStat: await stat(file) });
  candidates.sort((left, right) => {
    if (right.fileStat.mtimeMs !== left.fileStat.mtimeMs) return right.fileStat.mtimeMs - left.fileStat.mtimeMs;
    return homeRedactedPath(left.file).localeCompare(homeRedactedPath(right.file));
  });
  const boundedFiles = [];
  const skipped = [];
  for (const { file, fileStat } of candidates) {
    if (sourceByteLimit > 0 && fileStat.size > sourceByteLimit) {
      skipped.push({
        sourcePath: sourceDisplayPath(file, root),
        size: fileStat.size,
        reason: `larger than --max-source-bytes (${sourceByteLimit})`
      });
      continue;
    }
    boundedFiles.push(file);
    if (limit > 0 && boundedFiles.length >= limit) break;
  }
  return { files: boundedFiles, skipped };
}

async function listFiles(current, group) {
  try {
    const currentStat = await stat(current);
    if (currentStat.isFile()) return [current];
    if (!currentStat.isDirectory()) return [];
  } catch {
    return [];
  }

  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute, group)));
    } else if (entry.isFile() && entry.name.startsWith(group.prefix) && entry.name.endsWith(group.extension)) {
      files.push(absolute);
    }
  }
  return files;
}

async function parseCodexJsonlSession(sourceFile, root) {
  const records = [];
  const messages = [];
  const events = [];
  let title = "";
  let sessionId = "";
  let lineIndex = 0;
  let rawRecordCount = 0;

  const reader = readline.createInterface({
    input: createReadStream(sourceFile, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  for await (const line of reader) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      events.push({ lineIndex, type: "parse_error", text: "" });
      lineIndex += 1;
      continue;
    }
    records.push(record);
    rawRecordCount += 1;
    const payload = payloadOf(record);
    if (record.type === "session_meta" && typeof payload.id === "string") sessionId = payload.id;
    if (!title && typeof payload.title === "string") title = payload.title;
    if (!title && typeof payload.thread_name === "string") title = payload.thread_name;

    const normalized = normalizeType(record);
    const event = { lineIndex, type: normalized, sourceType: record.type || "unknown", payloadType: payloadType(record), text: "" };
    if (normalized === "message") {
      const role = inferRole(payload);
      const text = textFromContent(payload) || payload.text || "";
      if (!isExportableMessage(role, text)) {
        lineIndex += 1;
        continue;
      }
      messages.push({ role, text, lineIndex, timestamp: record.timestamp || "" });
      event.role = role;
      event.text = text;
    } else if (includeToolEvents && normalized === "tool_call") {
      event.text = renderJson(payload.arguments ?? payload.input ?? "");
      event.toolName = payload.name || "unknown_tool";
    } else if (includeToolEvents && normalized === "tool_result") {
      event.text = renderJson(payload.output ?? "");
      event.toolName = payload.name || payload.call_id || "tool_result";
    } else {
      lineIndex += 1;
      continue;
    }
    events.push(event);
    lineIndex += 1;
  }

  const fallbackTitle = basename(sourceFile, ".jsonl");
  return {
    id: sessionId || stableId(relative(root, sourceFile)),
    fileId: stableId(`${sessionId || relative(root, sourceFile)}`),
    title: title || fallbackTitle,
    sourceFile,
    sourcePath: sourceDisplayPath(sourceFile, root),
    messages,
    events,
    rawRecordCount
  };
}

function renderSessionMarkdown(session) {
  const lines = [
    "---",
    `id: ${yamlString(session.id)}`,
    `title: ${yamlString(session.title)}`,
    `source_path: ${yamlString(session.sourcePath)}`,
    `message_count: ${session.messages.length}`,
    "---",
    "",
    `# ${escapeMarkdownHeading(session.title)}`,
    "",
    `Source: \`${session.sourcePath}\``,
    "",
    "## Messages",
    ""
  ];

  let messageNumber = 1;
  for (const event of session.events) {
    if (event.type === "message") {
      lines.push(`### ${messageNumber}. ${roleLabel(event.role)}`);
      if (event.text.trim()) lines.push("", event.text.trim(), "");
      else lines.push("", "_Empty message._", "");
      messageNumber += 1;
    } else if (includeToolEvents && event.type === "tool_call") {
      lines.push(`### Tool Call: ${event.toolName}`, "", "```json", event.text, "```", "");
    } else if (includeToolEvents && event.type === "tool_result") {
      lines.push(`### Tool Result: ${event.toolName}`, "", "```text", event.text, "```", "");
    }
  }

  if (messageNumber === 1) lines.push("_No message events found._", "");
  return `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim()}\n`;
}

function renderIndexMarkdown(manifest) {
  const lines = [
    "# Codex Chat History",
    "",
    `Generated: ${manifest.generatedAt}`,
    "",
    `Source root: \`${manifest.sourceRoot}\``,
    `Mode: \`${manifest.mode}\``,
    `Archived sessions: \`${manifest.includeArchived ? "included" : "excluded"}\``,
    `Sessions: ${manifest.sessionCount}`,
    `Messages: ${manifest.messageCount}`,
    "",
    "## Sessions",
    ""
  ];
  for (const session of manifest.sessions) {
    lines.push(`- [${escapeMarkdownLinkText(session.title)}](${session.outputFile}) - ${session.messageCount} messages`);
  }
  return `${lines.join("\n")}\n`;
}

function printStats({ sourceFiles, skippedSourceFiles, sessions }) {
  const messageCount = sessions.reduce((sum, session) => sum + session.messages.length, 0);
  const renderedEventCount = sessions.reduce((sum, session) => sum + session.events.length, 0);
  const rawRecordCount = sessions.reduce((sum, session) => sum + session.rawRecordCount, 0);
  console.log("Codex history Markdown sync stats");
  console.log("=================================");
  console.log(`Mode: ${mode}`);
  console.log(`Archived sessions: ${includeArchived ? "included" : "excluded"}`);
  console.log(`Source files: ${sourceFiles.length}`);
  if (skippedSourceFiles.length > 0) console.log(`Skipped oversized files: ${skippedSourceFiles.length}`);
  console.log(`Sessions detected: ${sessions.length}`);
  console.log(`Messages exportable: ${messageCount}`);
  console.log(`Rendered events: ${renderedEventCount}`);
  console.log(`Raw records scanned: ${rawRecordCount}`);
}

async function mirrorChangedFiles(files, fromRoot, toRoot) {
  const synced = [];
  for (const file of files) {
    const relativeFile = relative(fromRoot, file);
    const target = join(toRoot, relativeFile);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(file, target);
    synced.push(target);
  }
  return synced;
}

async function pruneStaleSessionFiles(root, activeRelativeFiles) {
  const sessionsDir = join(root, "sessions");
  let entries = [];
  try {
    entries = await readdir(sessionsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const removed = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const relativeFile = `sessions/${entry.name}`;
    if (activeRelativeFiles.has(relativeFile)) continue;
    const absolute = join(sessionsDir, entry.name);
    await rm(absolute, { force: true });
    removed.push(absolute);
  }
  return removed;
}

async function writeIfChanged(path, content) {
  let previous = null;
  try {
    previous = await readFile(path, "utf8");
  } catch {
    // file does not exist yet
  }
  if (previous === content) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return true;
}

async function readState(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return { sessions: {} };
  }
}

async function hashFile(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function payloadOf(record) {
  return record?.payload && typeof record.payload === "object" && !Array.isArray(record.payload) ? record.payload : {};
}

function payloadType(record) {
  const payload = payloadOf(record);
  if (typeof payload.type === "string") return payload.type;
  if (typeof record?.type === "string") return record.type;
  return "unknown";
}

function normalizeType(record) {
  const sourceType = typeof record?.type === "string" ? record.type : "unknown";
  const type = payloadType(record);
  if (sourceType === "session_meta" || sourceType === "turn_context") return "metadata";
  if (sourceType === "compacted") return "compaction";
  if (mode === "clean" && sourceType !== "response_item") return "unknown";
  if (["message", "user_message", "agent_message"].includes(type)) return "message";
  if (["function_call", "custom_tool_call"].includes(type)) return "tool_call";
  if (["function_call_output", "custom_tool_call_output"].includes(type)) return "tool_result";
  if (type === "reasoning") return "reasoning";
  return "unknown";
}

function inferRole(payload) {
  if (payload.type === "user_message") return "user";
  if (payload.type === "agent_message") return "assistant";
  if (["user", "assistant", "system", "agent"].includes(payload.role)) return payload.role;
  return "unknown";
}

function isExportableMessage(role, text) {
  if (mode === "raw") return Boolean(text.trim());
  if (!["user", "assistant", "agent"].includes(role)) return false;
  return Boolean(text.trim());
}

function textFromContent(payload) {
  if (!Array.isArray(payload.content)) return "";
  const parts = [];
  for (const item of payload.content) {
    if (item?.type === "text" && typeof item.text === "string") parts.push(item.text);
    else if (item?.type === "input_text" && typeof item.text === "string") parts.push(item.text);
    else if (item?.type === "output_text" && typeof item.text === "string") parts.push(item.text);
  }
  return parts.join("\n\n");
}

function renderJson(value) {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  return JSON.stringify(value, null, 2);
}

function homeRedactedPath(path) {
  if (path.startsWith(home)) return `<HOME>${path.slice(home.length)}`;
  return path;
}

function assertOutputBudget(bytes, limit) {
  if (limit > 0 && bytes > limit) {
    throw new Error(`Codex history Markdown output exceeded --max-total-output-bytes (${limit}). Increase the limit or reduce --max-files.`);
  }
}

function sourceDisplayPath(path, root) {
  const relativePath = relative(root, path);
  if (relativePath && !relativePath.startsWith("..")) return `<SOURCE_ROOT>/${relativePath}`;
  return homeRedactedPath(path);
}

function stableId(value) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function roleLabel(role) {
  if (role === "user") return "User";
  if (role === "assistant" || role === "agent") return "Codex";
  if (role === "system") return "System";
  return "Unknown";
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function escapeMarkdownHeading(value) {
  return String(value).replace(/^#+\s*/, "").trim() || "Untitled Session";
}

function escapeMarkdownLinkText(value) {
  return String(value).replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function printHelp() {
  console.log(`Usage:
  node scripts/codex-history-markdown-sync.mjs --output-dir <dir> [options]

Options:
  --source-root <path>       Codex root, default <HOME>/.codex
  --output-dir <path>        Editable Markdown destination
  --sync-dir <path>          Optional mirror destination
  --state-file <path>        State file, default <output-dir>/.codex-history-sync-state.json
  --once                     Run one scan/export/sync cycle
  --watch                    Run repeatedly
  --interval-ms <number>     Watch interval, default 300000
  --max-files <number>       Limit files; 0 means all
  --max-source-bytes <number> Skip source files above this size; default 26214400, 0 disables
  --max-total-output-bytes <number>
                              Stop before writing too much output; default 262144000, 0 disables
  --mode <clean|raw>         Export mode; default clean
  --include-archived         Include archived Codex sessions
  --include-tool-events      Include tool call/result blocks
  --stats                    Print counts without writing output files
  --no-reminder              Suppress sync reminder output
`);
}
