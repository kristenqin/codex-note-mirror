import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, loadConfigWithOverrides, saveConfig, validateConfig } from "../src/config/config.js";
import { createTempDir } from "./helpers/tmp.js";

describe("config", () => {
  it("validates and normalizes supported MVP config", () => {
    const config = validateConfig({
      sourcePath: ".",
      targetPath: ".",
      outputFormat: "markdown",
      syncMode: "view",
    });

    expect(path.isAbsolute(config.sourcePath)).toBe(true);
    expect(config.outputFormat).toBe("markdown");
    expect(config.syncMode).toBe("view");
  });

  it("saves and loads config JSON", async () => {
    const tempDir = await createTempDir();
    const configFile = path.join(tempDir, "config.json");
    await saveConfig(
      {
        sourcePath: tempDir,
        targetPath: path.join(tempDir, "target"),
        outputFormat: "markdown",
        syncMode: "view",
      },
      configFile,
    );

    const loaded = await loadConfig(configFile);
    expect(loaded.sourcePath).toBe(tempDir);
    expect(loaded.targetPath).toBe(path.join(tempDir, "target"));
  });

  it("allows source and target CLI overrides when config is missing", async () => {
    const tempDir = await createTempDir();
    const config = await loadConfigWithOverrides(
      {
        sourcePath: path.join(tempDir, "source"),
        targetPath: path.join(tempDir, "target"),
      },
      path.join(tempDir, "missing-config.json"),
    );

    expect(config.sourcePath).toBe(path.join(tempDir, "source"));
    expect(config.targetPath).toBe(path.join(tempDir, "target"));
  });

  it("still fails without config when only partial overrides are provided", async () => {
    const tempDir = await createTempDir();
    await expect(
      loadConfigWithOverrides({ sourcePath: path.join(tempDir, "source") }, path.join(tempDir, "missing.json")),
    ).rejects.toMatchObject({ code: "CONFIG_NOT_FOUND" });
  });
});
