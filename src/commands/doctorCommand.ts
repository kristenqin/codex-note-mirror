import fg from "fast-glob";
import fs from "fs-extra";
import { loadConfig } from "../config/config.js";
import { getConfigFilePath, getStateFilePath } from "../config/paths.js";
import type { Logger } from "../logger/logger.js";
import { consoleLogger } from "../logger/logger.js";
import { hasExactlyOneSyncBlock } from "../sync/writer.js";
import { validateSyncState } from "../sync/state.js";
import { getErrorMessage } from "../utils/errors.js";

export type DoctorItem = {
  level: "PASS" | "WARNING" | "ERROR";
  message: string;
};

export type DoctorReport = {
  items: DoctorItem[];
};

function printItem(item: DoctorItem, logger: Logger): void {
  logger.log(`${item.level}: ${item.message}`);
}

async function checkTargetMarkdown(targetPath: string, items: DoctorItem[]): Promise<void> {
  if (!(await fs.pathExists(targetPath))) {
    items.push({ level: "ERROR", message: `targetPath does not exist: ${targetPath}` });
    return;
  }
  const files = await fg("**/*.md", { cwd: targetPath, absolute: true, onlyFiles: true, dot: false });
  for (const file of files) {
    const markdown = await fs.readFile(file, "utf8");
    if (!hasExactlyOneSyncBlock(markdown)) {
      items.push({ level: "WARNING", message: `sync block issue: ${file}` });
    }
  }
}

export async function runDoctorCommand({ logger = consoleLogger }: { logger?: Logger } = {}): Promise<DoctorReport> {
  const items: DoctorItem[] = [];
  const configFile = getConfigFilePath();
  const stateFile = getStateFilePath();

  if (await fs.pathExists(configFile)) {
    items.push({ level: "PASS", message: `config exists: ${configFile}` });
  } else {
    items.push({ level: "ERROR", message: `config missing: ${configFile}` });
  }

  try {
    const config = await loadConfig();
    items.push({ level: "PASS", message: "config is valid" });

    if (await fs.pathExists(config.sourcePath)) {
      items.push({ level: "PASS", message: `sourcePath exists: ${config.sourcePath}` });
    } else {
      items.push({ level: "ERROR", message: `sourcePath missing: ${config.sourcePath}` });
    }

    try {
      if (!(await fs.pathExists(config.targetPath))) {
        items.push({ level: "ERROR", message: `targetPath missing: ${config.targetPath}` });
      } else {
        await fs.access(config.targetPath, fs.constants.W_OK);
        items.push({ level: "PASS", message: `targetPath writable: ${config.targetPath}` });
      }
    } catch (error) {
      items.push({ level: "ERROR", message: `targetPath not writable: ${getErrorMessage(error)}` });
    }

    await checkTargetMarkdown(config.targetPath, items);
  } catch (error) {
    items.push({ level: "ERROR", message: `config invalid: ${getErrorMessage(error)}` });
  }

  if (await fs.pathExists(stateFile)) {
    try {
      validateSyncState(await fs.readJson(stateFile));
      items.push({ level: "PASS", message: `state is valid: ${stateFile}` });
    } catch (error) {
      items.push({ level: "ERROR", message: `state invalid: ${getErrorMessage(error)}` });
    }
  } else {
    items.push({ level: "WARNING", message: `state not created yet: ${stateFile}` });
  }

  logger.log("Codex Note Mirror Doctor");
  logger.log("");
  for (const item of items) {
    printItem(item, logger);
  }

  return { items };
}
