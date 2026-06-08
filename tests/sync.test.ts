import path from "node:path";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { saveConfig } from "../src/config/config.js";
import { diffSourceFiles } from "../src/sync/state.js";
import { replaceSyncBlock, writeMarkdownFile } from "../src/sync/writer.js";
import { runSyncCommand } from "../src/commands/syncCommand.js";
import type { SourceFile, SyncState } from "../src/types.js";
import { captureLogger, createTempDir, muteLogger } from "./helpers/tmp.js";

const originalHome = process.env.CODEX_NOTE_MIRROR_HOME;

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.CODEX_NOTE_MIRROR_HOME;
  } else {
    process.env.CODEX_NOTE_MIRROR_HOME = originalHome;
  }
});

describe("sync state and writer", () => {
  it("diffs new, changed, and unchanged files by source content hash", () => {
    const files: SourceFile[] = [
      { path: "/a.jsonl", fileName: "a.jsonl", size: 1, modifiedAt: "now", contentHash: "a" },
      { path: "/b.jsonl", fileName: "b.jsonl", size: 1, modifiedAt: "now", contentHash: "b2" },
      { path: "/c.jsonl", fileName: "c.jsonl", size: 1, modifiedAt: "now", contentHash: "c" },
    ];
    const state: SyncState = {
      version: 1,
      sessions: {
        oldA: { sourceFile: "/a.jsonl", targetFile: "/a.md", sourceModifiedAt: "old", contentHash: "a", lastSyncedAt: "old" },
        oldB: { sourceFile: "/b.jsonl", targetFile: "/b.md", sourceModifiedAt: "old", contentHash: "b1", lastSyncedAt: "old" },
      },
    };

    const diff = diffSourceFiles(files, state);
    expect(diff.unchangedFiles.map((file) => file.path)).toEqual(["/a.jsonl"]);
    expect(diff.changedFiles.map((file) => file.path)).toEqual(["/b.jsonl"]);
    expect(diff.newFiles.map((file) => file.path)).toEqual(["/c.jsonl"]);
  });

  it("replaces only the sync block and preserves user content", async () => {
    const existing = "Intro\n<!-- CODEX_SYNC_START -->\nold\n<!-- CODEX_SYNC_END -->\nUser note\n";
    const next = "Ignored\n<!-- CODEX_SYNC_START -->\nnew\n<!-- CODEX_SYNC_END -->\nIgnored note\n";
    expect(replaceSyncBlock(existing, next)).toBe(
      "Intro\n<!-- CODEX_SYNC_START -->\nnew\n<!-- CODEX_SYNC_END -->\nUser note\n",
    );
  });

  it("returns conflict when target file is missing sync block", async () => {
    const tempDir = await createTempDir();
    const targetFile = path.join(tempDir, "note.md");
    await fs.writeFile(targetFile, "manual note only", "utf8");

    const result = await writeMarkdownFile({
      targetFile,
      markdown: "<!-- CODEX_SYNC_START -->\nnew\n<!-- CODEX_SYNC_END -->\n",
    });

    expect(result.status).toBe("conflict");
    expect(await fs.readFile(targetFile, "utf8")).toBe("manual note only");
  });

  it("backs up invalid state, rebuilds empty state, warns, and continues syncing", async () => {
    const tempDir = await createTempDir();
    const appHome = path.join(tempDir, "app-home");
    const sourcePath = path.join(tempDir, "source");
    const targetPath = path.join(tempDir, "target");
    process.env.CODEX_NOTE_MIRROR_HOME = appHome;
    await fs.ensureDir(sourcePath);
    await fs.ensureDir(appHome);
    await fs.writeFile(path.join(appHome, "state.json"), "{ broken", "utf8");
    await fs.writeFile(
      path.join(sourcePath, "session.jsonl"),
      '{"type":"message","role":"user","content":"恢复状态后继续"}\n',
      "utf8",
    );
    await saveConfig({ sourcePath, targetPath, outputFormat: "markdown", syncMode: "view" });
    const { logger, logs } = captureLogger();

    const result = await runSyncCommand({ logger });

    expect(result.results[0]?.status).toBe("synced");
    expect(logs.join("\n")).toContain("Warning: State was invalid.");
    expect(await fs.pathExists(path.join(appHome, "state.json"))).toBe(true);
    expect((await fs.readdir(appHome)).some((entry) => entry.startsWith("state.json.invalid-"))).toBe(true);
  });
});

describe("runSyncCommand", () => {
  it("syncs visible messages, updates changed sources, and preserves manual notes", async () => {
    const tempDir = await createTempDir();
    const appHome = path.join(tempDir, "app-home");
    const sourcePath = path.join(tempDir, "source");
    const targetPath = path.join(tempDir, "target");
    process.env.CODEX_NOTE_MIRROR_HOME = appHome;

    await fs.ensureDir(sourcePath);
    await fs.writeFile(
      path.join(sourcePath, "session.jsonl"),
      [
        '{"type":"session_metadata","session_id":"stable-session","created_at":"2026-06-08T10:00:00+08:00"}',
        '{"type":"message","role":"user","content":"你好","session_id":"stable-session"}',
        '{"type":"tool_call","name":"shell","args":{"cmd":"ls"}}',
        '{"type":"message","role":"assistant","content":"你好，有什么可以帮你？","session_id":"stable-session"}',
      ].join("\n"),
      "utf8",
    );
    await saveConfig({ sourcePath, targetPath, outputFormat: "markdown", syncMode: "view" });

    const first = await runSyncCommand({ logger: muteLogger() });
    expect(first.results).toHaveLength(1);
    expect(first.results[0]?.status).toBe("synced");

    const targetFile = first.results[0]?.targetFile;
    expect(targetFile).toBeTruthy();
    await fs.appendFile(targetFile!, "\n我的手写补充\n", "utf8");

    await fs.writeFile(
      path.join(sourcePath, "session.jsonl"),
      [
        '{"type":"session_metadata","session_id":"stable-session","created_at":"2026-06-08T10:00:00+08:00"}',
        '{"type":"message","role":"user","content":"你好","session_id":"stable-session"}',
        '{"type":"message","role":"assistant","content":"已更新回复","session_id":"stable-session"}',
      ].join("\n"),
      "utf8",
    );

    const second = await runSyncCommand({ logger: muteLogger() });
    expect(second.changedCount).toBe(1);
    const markdown = await fs.readFile(targetFile!, "utf8");
    expect(markdown).toContain("已更新回复");
    expect(markdown).toContain("我的手写补充");
    expect(markdown).not.toContain("tool_call");
  });

  it("does not overwrite sessions whose first 8 id characters collide", async () => {
    const tempDir = await createTempDir();
    const appHome = path.join(tempDir, "app-home");
    const sourcePath = path.join(tempDir, "source");
    const targetPath = path.join(tempDir, "target");
    process.env.CODEX_NOTE_MIRROR_HOME = appHome;

    await fs.ensureDir(sourcePath);
    await fs.writeFile(
      path.join(sourcePath, "a.jsonl"),
      [
        '{"type":"session_metadata","session_id":"demo-session-001","created_at":"2026-06-08T10:00:00+08:00"}',
        '{"type":"message","role":"user","content":"第一份","session_id":"demo-session-001"}',
      ].join("\n"),
      "utf8",
    );
    await fs.writeFile(
      path.join(sourcePath, "b.jsonl"),
      [
        '{"type":"session_metadata","session_id":"demo-session-002","created_at":"2026-06-08T10:00:00+08:00"}',
        '{"type":"message","role":"user","content":"第二份","session_id":"demo-session-002"}',
      ].join("\n"),
      "utf8",
    );
    await saveConfig({ sourcePath, targetPath, outputFormat: "markdown", syncMode: "view" });

    const result = await runSyncCommand({ logger: muteLogger() });
    const targetFiles = result.results.map((item) => item.targetFile).filter((item): item is string => Boolean(item));

    expect(new Set(targetFiles).size).toBe(2);
    expect(targetFiles.some((file) => /session-demo-ses-[a-f0-9]{6}\.md$/.test(file))).toBe(true);
    const markdownContents = await Promise.all(targetFiles.map((file) => fs.readFile(file, "utf8")));
    expect(markdownContents.join("\n")).toContain("第一份");
    expect(markdownContents.join("\n")).toContain("第二份");
  });
});
