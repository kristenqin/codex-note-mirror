import path from "node:path";
import fs from "fs-extra";
import type { MarkdownWriteConflict, WriteMarkdownFileResult } from "../types.js";
import { SYNC_END, SYNC_START } from "../renderer/markdownRenderer.js";

function countMarker(markdown: string, marker: string): number {
  return markdown.split(/\r?\n/).filter((line) => line.trim() === marker).length;
}

function getSyncBlockRange(markdown: string): { start: number; end: number } | { conflict: MarkdownWriteConflict } {
  const startCount = countMarker(markdown, SYNC_START);
  const endCount = countMarker(markdown, SYNC_END);
  if (startCount > 1 || endCount > 1) {
    return { conflict: "MULTIPLE_SYNC_BLOCKS" };
  }
  if (startCount !== 1 || endCount !== 1) {
    return { conflict: "SYNC_BLOCK_NOT_FOUND" };
  }
  const start = markdown.indexOf(SYNC_START);
  const end = markdown.indexOf(SYNC_END, start);
  if (start < 0 || end < start) {
    return { conflict: "SYNC_BLOCK_NOT_FOUND" };
  }
  return { start, end: end + SYNC_END.length };
}

export function replaceSyncBlock(existingMarkdown: string, nextMarkdown: string): string {
  const existingRange = getSyncBlockRange(existingMarkdown);
  if ("conflict" in existingRange) {
    throw new Error(existingRange.conflict);
  }
  const nextRange = getSyncBlockRange(nextMarkdown);
  if ("conflict" in nextRange) {
    throw new Error(nextRange.conflict);
  }
  const nextBlock = nextMarkdown.slice(nextRange.start, nextRange.end);
  return `${existingMarkdown.slice(0, existingRange.start)}${nextBlock}${existingMarkdown.slice(existingRange.end)}`;
}

export async function writeMarkdownFile({
  targetFile,
  markdown,
}: {
  targetFile: string;
  markdown: string;
}): Promise<WriteMarkdownFileResult> {
  try {
    if (!(await fs.pathExists(targetFile))) {
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeFile(targetFile, markdown, "utf8");
      return { status: "created" };
    }

    const existing = await fs.readFile(targetFile, "utf8");
    const existingRange = getSyncBlockRange(existing);
    if ("conflict" in existingRange) {
      return { status: "conflict", reason: existingRange.conflict };
    }
    const nextRange = getSyncBlockRange(markdown);
    if ("conflict" in nextRange) {
      return { status: "conflict", reason: nextRange.conflict };
    }
    await fs.writeFile(targetFile, replaceSyncBlock(existing, markdown), "utf8");
    return { status: "updated" };
  } catch (error) {
    return { status: "conflict", reason: error instanceof Error ? error.message : "TARGET_NOT_WRITABLE" };
  }
}

export function hasExactlyOneSyncBlock(markdown: string): boolean {
  const range = getSyncBlockRange(markdown);
  return !("conflict" in range);
}

