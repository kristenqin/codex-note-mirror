import type { ConfigOverrides } from "../config/config.js";
import { loadConfigWithOverrides } from "../config/config.js";
import type { Logger } from "../logger/logger.js";
import { consoleLogger } from "../logger/logger.js";
import { scanSourceFiles } from "../scanner/scanner.js";
import { diffSourceFiles, readSyncState } from "../sync/state.js";

export type StatusCommandOptions = ConfigOverrides & {
  logger?: Logger;
};

export async function runStatusCommand(options: StatusCommandOptions = {}): Promise<void> {
  const logger = options.logger ?? consoleLogger;
  const config = await loadConfigWithOverrides({
    ...(options.sourcePath ? { sourcePath: options.sourcePath } : {}),
    ...(options.targetPath ? { targetPath: options.targetPath } : {}),
  });
  const sourceFiles = await scanSourceFiles(config.sourcePath);
  const syncState = await readSyncState();
  const diff = diffSourceFiles(sourceFiles, syncState);

  logger.log("Codex Note Mirror Status");
  logger.log("");
  logger.log(`Source: ${config.sourcePath}`);
  logger.log(`Target: ${config.targetPath}`);
  logger.log(`Synced sessions: ${Object.keys(syncState.sessions).length}`);
  logger.log(`New files: ${diff.newFiles.length}`);
  logger.log(`Changed files: ${diff.changedFiles.length}`);
  logger.log(`Unchanged files: ${diff.unchangedFiles.length}`);
  logger.log(`Last synced at: ${syncState.lastSyncedAt ?? "never"}`);
}
