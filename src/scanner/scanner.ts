import path from "node:path";
import fg from "fast-glob";
import fs from "fs-extra";
import type { SourceFile } from "../types.js";
import { AppError } from "../utils/errors.js";
import { sha256Hex } from "../utils/hash.js";

export async function scanSourceFiles(sourcePath: string): Promise<SourceFile[]> {
  if (!(await fs.pathExists(sourcePath))) {
    throw new AppError("SOURCE_PATH_NOT_FOUND", `Source path not found: ${sourcePath}`);
  }
  const entries = await fg("**/*.jsonl", {
    cwd: sourcePath,
    absolute: false,
    onlyFiles: true,
    dot: false,
    unique: true,
    ignore: ["**/.*/**", "**/.*"],
  });

  const files: SourceFile[] = [];
  for (const entry of entries.sort()) {
    const fullPath = path.resolve(sourcePath, entry);
    const stat = await fs.stat(fullPath);
    if (stat.size === 0) {
      continue;
    }
    const content = await fs.readFile(fullPath);
    files.push({
      path: fullPath,
      fileName: path.basename(fullPath),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      contentHash: sha256Hex(content),
    });
  }
  return files;
}

