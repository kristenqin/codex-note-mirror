import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

export async function createTempDir(prefix = "codex-note-mirror-"): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export function muteLogger() {
  return {
    log: () => undefined,
    error: () => undefined,
  };
}

export function captureLogger() {
  const logs: string[] = [];
  return {
    logger: {
      log: (message = "") => {
        logs.push(message);
      },
      error: (message = "") => {
        logs.push(message);
      },
    },
    logs,
  };
}
