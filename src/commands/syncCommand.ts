import type { ConfigOverrides } from "../config/config.js";
import { loadConfigWithOverrides } from "../config/config.js";
import type { Logger } from "../logger/logger.js";
import { consoleLogger } from "../logger/logger.js";
import type { Config, SourceFile } from "../types.js";
import { extractVisibleMessages } from "../extractor/visibleMessageExtractor.js";
import { parseJsonlFile } from "../parser/jsonlParser.js";
import { renderMarkdown } from "../renderer/markdownRenderer.js";
import { getTargetPathDisambiguator, resolveTargetPath } from "../renderer/targetPath.js";
import { scanSourceFiles } from "../scanner/scanner.js";
import { buildSession } from "../session/sessionBuilder.js";
import { diffSourceFiles, loadSyncStateWithRepair, markSessionSynced, saveSyncState } from "../sync/state.js";
import { ensureTargetPathWritable } from "../sync/target.js";
import { writeMarkdownFile } from "../sync/writer.js";
import { getErrorMessage } from "../utils/errors.js";
import { hashVisibleMessages } from "../utils/hash.js";
import { nowIso } from "../utils/time.js";

export type SyncFileResult = {
  sourceFile: string;
  status: "synced" | "skipped" | "failed" | "conflict";
  targetFile?: string;
  reason?: string;
};

export type SyncSummary = {
  config: Config;
  sourceFiles: SourceFile[];
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  results: SyncFileResult[];
};

export type SyncCommandOptions = ConfigOverrides & {
  verbose?: boolean;
  logger?: Logger;
};

function cleanOverrides(options: SyncCommandOptions): ConfigOverrides {
  return {
    ...(options.sourcePath ? { sourcePath: options.sourcePath } : {}),
    ...(options.targetPath ? { targetPath: options.targetPath } : {}),
  };
}

function printSyncSummary(summary: SyncSummary, logger: Logger): void {
  const synced = summary.results.filter((result) => result.status === "synced").length;
  const skipped = summary.results.filter((result) => result.status === "skipped").length;
  const failed = summary.results.filter((result) => result.status === "failed").length;
  const conflicts = summary.results.filter((result) => result.status === "conflict").length;

  logger.log("Codex Note Mirror");
  logger.log("");
  logger.log(`Source: ${summary.config.sourcePath}`);
  logger.log(`Target: ${summary.config.targetPath}`);
  logger.log("");
  logger.log(`Found JSONL files: ${summary.sourceFiles.length}`);
  logger.log(`New: ${summary.newCount}`);
  logger.log(`Changed: ${summary.changedCount}`);
  logger.log(`Unchanged: ${summary.unchangedCount}`);
  logger.log("");
  logger.log(`Synced: ${synced}`);
  logger.log(`Skipped: ${skipped}`);
  logger.log(`Failed: ${failed}`);
  logger.log(`Conflicts: ${conflicts}`);
  logger.log("");
  logger.log("Done.");
}

export async function runSyncCommand(options: SyncCommandOptions = {}): Promise<SyncSummary> {
  const logger = options.logger ?? consoleLogger;
  const config = await loadConfigWithOverrides(cleanOverrides(options));
  await ensureTargetPathWritable(config.targetPath);
  const sourceFiles = await scanSourceFiles(config.sourcePath);
  const stateLoad = await loadSyncStateWithRepair();
  for (const warning of stateLoad.warnings) {
    logger.log(`Warning: ${warning}`);
  }
  let syncState = stateLoad.state;
  const diff = diffSourceFiles(sourceFiles, syncState);
  const results: SyncFileResult[] = [];
  let stateChanged = false;
  const targetOwners = new Map(
    Object.entries(syncState.sessions).map(([sessionId, record]) => [record.targetFile, sessionId] as const),
  );

  for (const sourceFile of diff.filesToSync) {
    try {
      const parseResult = await parseJsonlFile(sourceFile.path);
      const session = buildSession({ sourceFile, rawEvents: parseResult.events });
      const visibleMessages = extractVisibleMessages(session);

      if (visibleMessages.length === 0) {
        results.push({ sourceFile: sourceFile.path, status: "skipped", reason: "no visible messages" });
        continue;
      }

      const syncHash = hashVisibleMessages(visibleMessages);
      const markdown = renderMarkdown({ session, visibleMessages, syncHash });
      const existingTargetFile = syncState.sessions[session.id]?.targetFile;
      let targetFile = existingTargetFile ?? resolveTargetPath({ session, targetRoot: config.targetPath });
      const targetOwner = targetOwners.get(targetFile);
      if (!existingTargetFile && targetOwner && targetOwner !== session.id) {
        targetFile = resolveTargetPath({
          session,
          targetRoot: config.targetPath,
          disambiguator: getTargetPathDisambiguator(session),
        });
      }
      targetOwners.set(targetFile, session.id);
      const writeResult = await writeMarkdownFile({ targetFile, markdown });

      if (writeResult.status === "conflict") {
        results.push({
          sourceFile: sourceFile.path,
          targetFile,
          status: "conflict",
          reason: writeResult.reason,
        });
        continue;
      }

      syncState = markSessionSynced(syncState, session.id, {
        sourceFile: sourceFile.path,
        targetFile,
        sourceModifiedAt: sourceFile.modifiedAt,
        contentHash: sourceFile.contentHash,
        lastSyncedAt: nowIso(),
      });
      stateChanged = true;
      results.push({ sourceFile: sourceFile.path, targetFile, status: "synced" });

      if (options.verbose && parseResult.errors.length > 0) {
        logger.log(`Warning: ${sourceFile.path} had ${parseResult.errors.length} JSONL parse error(s).`);
      }
    } catch (error) {
      results.push({ sourceFile: sourceFile.path, status: "failed", reason: getErrorMessage(error) });
    }
  }

  if (stateChanged) {
    await saveSyncState(syncState);
  }

  const summary = {
    config,
    sourceFiles,
    newCount: diff.newFiles.length,
    changedCount: diff.changedFiles.length,
    unchangedCount: diff.unchangedFiles.length,
    results,
  };
  printSyncSummary(summary, logger);
  return summary;
}
