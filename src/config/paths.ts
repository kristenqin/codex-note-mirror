import os from "node:os";
import path from "node:path";

export function getAppConfigDir(): string {
  return process.env.CODEX_NOTE_MIRROR_HOME ?? path.join(os.homedir(), ".codex-note-mirror");
}

export function getConfigFilePath(): string {
  return path.join(getAppConfigDir(), "config.json");
}

export function getStateFilePath(): string {
  return path.join(getAppConfigDir(), "state.json");
}

