import path from "node:path";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { runDoctorCommand } from "../src/commands/doctorCommand.js";
import { saveConfig } from "../src/config/config.js";
import { createTempDir, muteLogger } from "./helpers/tmp.js";

const originalHome = process.env.CODEX_NOTE_MIRROR_HOME;

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.CODEX_NOTE_MIRROR_HOME;
  } else {
    process.env.CODEX_NOTE_MIRROR_HOME = originalHome;
  }
});

describe("runDoctorCommand", () => {
  it("is read-only and reports a missing target without creating it", async () => {
    const tempDir = await createTempDir();
    const appHome = path.join(tempDir, "app-home");
    const sourcePath = path.join(tempDir, "source");
    const targetPath = path.join(tempDir, "missing-target");
    process.env.CODEX_NOTE_MIRROR_HOME = appHome;
    await fs.ensureDir(sourcePath);
    await saveConfig({ sourcePath, targetPath, outputFormat: "markdown", syncMode: "view" });

    const report = await runDoctorCommand({ logger: muteLogger() });

    expect(await fs.pathExists(targetPath)).toBe(false);
    expect(report.items.some((item) => item.level === "ERROR" && item.message.includes("targetPath missing"))).toBe(
      true,
    );
  });
});
