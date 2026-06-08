import path from "node:path";
import fs from "fs-extra";
import { z } from "zod";
import type { Config } from "../types.js";
import { AppError } from "../utils/errors.js";
import { resolveUserPath } from "../utils/path.js";
import { getConfigFilePath } from "./paths.js";

const ConfigSchema = z.object({
  sourcePath: z.string().min(1),
  targetPath: z.string().min(1),
  outputFormat: z.literal("markdown").default("markdown"),
  syncMode: z.literal("view").default("view"),
});

export type ConfigOverrides = Partial<Pick<Config, "sourcePath" | "targetPath">>;

export function validateConfig(input: unknown): Config {
  const result = ConfigSchema.safeParse(input);
  if (!result.success) {
    throw new AppError("CONFIG_INVALID", result.error.message);
  }
  return {
    ...result.data,
    sourcePath: resolveUserPath(result.data.sourcePath),
    targetPath: resolveUserPath(result.data.targetPath),
  };
}

export async function loadConfig(configFile = getConfigFilePath()): Promise<Config> {
  if (!(await fs.pathExists(configFile))) {
    throw new AppError("CONFIG_NOT_FOUND", `Config not found: ${configFile}`);
  }
  try {
    const content = await fs.readJson(configFile);
    return validateConfig(content);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("CONFIG_INVALID", `Invalid config: ${configFile}`, { cause: error });
  }
}

export async function loadConfigWithOverrides(
  overrides: ConfigOverrides = {},
  configFile = getConfigFilePath(),
): Promise<Config> {
  let base: Config;
  try {
    base = await loadConfig(configFile);
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === "CONFIG_NOT_FOUND" &&
      overrides.sourcePath &&
      overrides.targetPath
    ) {
      return validateConfig({
        sourcePath: overrides.sourcePath,
        targetPath: overrides.targetPath,
        outputFormat: "markdown",
        syncMode: "view",
      });
    }
    throw error;
  }
  return validateConfig({ ...base, ...overrides });
}

export async function saveConfig(config: Config, configFile = getConfigFilePath()): Promise<void> {
  const normalized = validateConfig(config);
  await fs.ensureDir(path.dirname(configFile));
  await fs.writeJson(configFile, normalized, { spaces: 2 });
}
