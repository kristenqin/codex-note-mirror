import path from "node:path";
import fs from "fs-extra";
import type { DiffSourceFilesResult, SourceFile, SyncState } from "../types.js";
import { AppError } from "../utils/errors.js";
import { nowIso } from "../utils/time.js";
import { getStateFilePath } from "../config/paths.js";

export function createEmptySyncState(): SyncState {
  return {
    version: 1,
    sessions: {},
  };
}

export function validateSyncState(input: unknown): SyncState {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    (input as { version?: unknown }).version !== 1 ||
    typeof (input as { sessions?: unknown }).sessions !== "object" ||
    (input as { sessions?: unknown }).sessions === null
  ) {
    throw new AppError("STATE_INVALID", "Invalid sync state.");
  }
  return input as SyncState;
}

export type LoadSyncStateResult = {
  state: SyncState;
  warnings: string[];
};

export async function readSyncState(stateFile = getStateFilePath()): Promise<SyncState> {
  if (!(await fs.pathExists(stateFile))) {
    return createEmptySyncState();
  }
  return validateSyncState(await fs.readJson(stateFile));
}

export async function loadSyncStateWithRepair(stateFile = getStateFilePath()): Promise<LoadSyncStateResult> {
  const warnings: string[] = [];
  if (!(await fs.pathExists(stateFile))) {
    return { state: createEmptySyncState(), warnings };
  }
  try {
    return { state: validateSyncState(await fs.readJson(stateFile)), warnings };
  } catch (error) {
    const backupFile = `${stateFile}.invalid-${Date.now()}.bak`;
    const state = createEmptySyncState();
    await fs.ensureDir(path.dirname(stateFile));
    await fs.copy(stateFile, backupFile);
    await fs.writeJson(stateFile, state, { spaces: 2 });
    warnings.push(`State was invalid. Backed up to ${backupFile} and rebuilt empty state.`);
    return { state, warnings };
  }
}

export async function loadSyncState(stateFile = getStateFilePath()): Promise<SyncState> {
  return (await loadSyncStateWithRepair(stateFile)).state;
}

export async function saveSyncState(state: SyncState, stateFile = getStateFilePath()): Promise<void> {
  await fs.ensureDir(path.dirname(stateFile));
  await fs.writeJson(stateFile, state, { spaces: 2 });
}

export function diffSourceFiles(sourceFiles: SourceFile[], syncState: SyncState): DiffSourceFilesResult {
  const recordsBySource = new Map(
    Object.values(syncState.sessions).map((session) => [session.sourceFile, session] as const),
  );
  const newFiles: SourceFile[] = [];
  const changedFiles: SourceFile[] = [];
  const unchangedFiles: SourceFile[] = [];

  for (const sourceFile of sourceFiles) {
    const record = recordsBySource.get(sourceFile.path);
    if (!record) {
      newFiles.push(sourceFile);
    } else if (record.contentHash !== sourceFile.contentHash) {
      changedFiles.push(sourceFile);
    } else {
      unchangedFiles.push(sourceFile);
    }
  }

  return {
    newFiles,
    changedFiles,
    unchangedFiles,
    filesToSync: [...newFiles, ...changedFiles],
  };
}

export function markSessionSynced(
  state: SyncState,
  sessionId: string,
  record: SyncState["sessions"][string],
): SyncState {
  return {
    ...state,
    lastSyncedAt: nowIso(),
    sessions: {
      ...state.sessions,
      [sessionId]: record,
    },
  };
}
