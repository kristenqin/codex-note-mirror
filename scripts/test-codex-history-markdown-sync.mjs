import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const temp = await mkdtemp(join(tmpdir(), "codex-history-sync-"));
const outputDir = join(temp, "out");
const syncDir = join(temp, "mirror");
const fixtureSource = join(root, "fixtures/redacted/importer-source");
const sourceRoot = join(temp, "codex");
const script = join(root, "scripts/codex-history-markdown-sync.mjs");
const failures = [];

function fail(message) {
  failures.push(message);
}

try {
  await cp(fixtureSource, sourceRoot, { recursive: true });
  runSync(["--source-root", sourceRoot, "--output-dir", outputDir, "--sync-dir", syncDir, "--once"]);
  const readme = await readFile(join(outputDir, "README.md"), "utf8");
  const manifest = JSON.parse(await readFile(join(outputDir, "manifest.json"), "utf8"));
  const firstSessionRelative = manifest.sessions[0].outputFile;
  const firstSessionFile = join(outputDir, firstSessionRelative);
  const firstSession = await readFile(firstSessionFile, "utf8");
  const mirroredSession = await readFile(join(syncDir, firstSessionRelative), "utf8");

  if (!readme.includes("# Codex Chat History")) fail("README should contain history title.");
  if (manifest.sessionCount !== 1) fail(`Expected one fixture session, got ${manifest.sessionCount}.`);
  if (manifest.messageCount < 2) fail("Expected at least two messages in fixture export.");
  if (!/### \d+\. User/.test(firstSession)) fail("Session Markdown should include user heading.");
  if (!/### \d+\. Codex/.test(firstSession)) fail("Session Markdown should include Codex heading.");
  if (!firstSession.includes("Synthetic user text must be redacted")) fail("Session Markdown should preserve user Markdown text.");
  if (!firstSession.includes("Synthetic assistant text must be redacted")) fail("Session Markdown should preserve assistant Markdown text.");
  if (firstSession.includes("Synthetic system text must be redacted")) fail("Clean export should exclude system messages.");
  if (firstSession.includes("Synthetic event user noise")) fail("Clean export should exclude event_msg user noise.");
  if (firstSession.includes("Synthetic event assistant noise")) fail("Clean export should exclude event_msg assistant noise.");
  if (/\/Users\/[^/\s]+/.test(firstSession)) fail("Session Markdown should not contain absolute home paths.");
  if (mirroredSession !== firstSession) fail("Mirror session should match output session.");
  if (manifest.mode !== "clean") fail(`Default manifest mode should be clean, got ${manifest.mode}.`);
  if (manifest.includeArchived !== false) fail("Default manifest should exclude archived sessions.");

  const secondRun = runSync(["--source-root", sourceRoot, "--output-dir", outputDir, "--sync-dir", syncDir, "--once"]);
  if (!secondRun.stdout.includes("Changed output files: 0")) fail("Second unchanged run should report zero changed files.");

  const rawOutputDir = join(temp, "raw");
  runSync(["--source-root", sourceRoot, "--output-dir", rawOutputDir, "--once", "--mode", "raw"]);
  const rawManifest = JSON.parse(await readFile(join(rawOutputDir, "manifest.json"), "utf8"));
  const rawSession = await readFile(join(rawOutputDir, rawManifest.sessions[0].outputFile), "utf8");
  if (rawManifest.mode !== "raw") fail(`Raw manifest mode should be raw, got ${rawManifest.mode}.`);
  if (!rawSession.includes("Synthetic event user noise")) fail("Raw export should keep event_msg user text.");
  if (!rawSession.includes("Synthetic event assistant noise")) fail("Raw export should keep event_msg assistant text.");

  const statsRun = runSync(["--source-root", sourceRoot, "--output-dir", join(temp, "stats"), "--once", "--stats"]);
  if (!statsRun.stdout.includes("Codex history Markdown sync stats")) fail("Stats mode should print stats header.");
  if (!statsRun.stdout.includes("Mode: clean")) fail("Stats mode should show clean mode.");

  const staleSession = join(outputDir, "sessions/stale-session.md");
  await writeFile(staleSession, "# stale\n", "utf8");
  const pruneRun = runSync(["--source-root", sourceRoot, "--output-dir", outputDir, "--sync-dir", syncDir, "--once"]);
  if (!pruneRun.stdout.includes("Removed stale session files: 1")) fail("Sync should report stale session file removal.");
  if (await pathExists(staleSession)) fail("Sync should remove stale session Markdown files.");

  const fixtureFile = join(sourceRoot, "sessions/2026/06/rollout-synthetic-hardening.jsonl");
  await writeFile(fixtureFile, `${await readFile(fixtureFile, "utf8")}\n`, "utf8");
  const thirdRun = runSync(["--source-root", sourceRoot, "--output-dir", outputDir, "--sync-dir", syncDir, "--once"]);
  if (!thirdRun.stdout.includes("Changed output files:")) fail("Changed run should report changed output files.");

  const limitedRun = spawnSync(process.execPath, [
    script,
    "--source-root",
    sourceRoot,
    "--output-dir",
    join(temp, "limited"),
    "--once",
    "--max-total-output-bytes",
    "1"
  ], {
    cwd: root,
    encoding: "utf8"
  });
  if (limitedRun.status === 0) fail("Output byte limit should reject oversized output.");
  if (!limitedRun.stderr.includes("--max-total-output-bytes")) fail("Output byte limit failure should mention max-total-output-bytes.");

  const skippedRun = runSync([
    "--source-root",
    sourceRoot,
    "--output-dir",
    join(temp, "skipped"),
    "--once",
    "--max-source-bytes",
    "1"
  ]);
  if (!skippedRun.stdout.includes("Skipped oversized files: 1")) fail("Source byte limit should report skipped oversized files.");
} finally {
  await rm(temp, { recursive: true, force: true });
}

function runSync(args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    fail(`Script failed with status ${result.status}: ${result.stderr || result.stdout}`);
  }
  return result;
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

console.log("Codex history Markdown sync test");
console.log("================================");

if (failures.length > 0) {
  console.error("\nFailures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Codex history Markdown sync passed.");
