import fs from "fs-extra";
import prompts from "prompts";
import type { Config } from "../types.js";
import { saveConfig, validateConfig } from "../config/config.js";
import { getConfigFilePath } from "../config/paths.js";
import type { Logger } from "../logger/logger.js";
import { consoleLogger } from "../logger/logger.js";
import { AppError } from "../utils/errors.js";
import { resolveUserPath } from "../utils/path.js";

export type InitCommandOptions = {
  sourcePath?: string;
  targetPath?: string;
  logger?: Logger;
};

async function promptForMissing(options: InitCommandOptions): Promise<Required<Pick<Config, "sourcePath" | "targetPath">>> {
  const response = await prompts([
    {
      type: options.sourcePath ? null : "text",
      name: "sourcePath",
      message: "Codex JSONL source directory",
      initial: "~/.codex/sessions",
    },
    {
      type: options.targetPath ? null : "text",
      name: "targetPath",
      message: "Markdown target directory",
      initial: "~/Notes/Codex",
    },
  ]);
  return {
    sourcePath: options.sourcePath ?? response.sourcePath,
    targetPath: options.targetPath ?? response.targetPath,
  };
}

export async function runInitCommand(options: InitCommandOptions = {}): Promise<Config> {
  const logger = options.logger ?? consoleLogger;
  const paths = await promptForMissing(options);
  const sourcePath = resolveUserPath(paths.sourcePath);
  const targetPath = resolveUserPath(paths.targetPath);

  if (!(await fs.pathExists(sourcePath))) {
    throw new AppError("SOURCE_PATH_NOT_FOUND", `Source path not found: ${sourcePath}`);
  }
  await fs.ensureDir(targetPath);

  const config = validateConfig({
    sourcePath,
    targetPath,
    outputFormat: "markdown",
    syncMode: "view",
  });
  await saveConfig(config);
  logger.log(`Config saved: ${getConfigFilePath()}`);
  return config;
}

