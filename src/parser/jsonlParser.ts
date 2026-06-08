import fs from "fs-extra";
import type { ParseJsonlFileResult, RawEvent } from "../types.js";
import { AppError } from "../utils/errors.js";

function isRecord(value: unknown): value is RawEvent {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function parseJsonlFile(filePath: string): Promise<ParseJsonlFileResult> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new AppError("FILE_READ_FAILED", `Unable to read JSONL file: ${filePath}`, { cause: error });
  }

  const events: RawEvent[] = [];
  const errors: ParseJsonlFileResult["errors"] = [];
  const lines = raw.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!isRecord(parsed)) {
        errors.push({
          lineNumber: index + 1,
          rawLine: line,
          message: "JSONL line must be a JSON object.",
        });
        return;
      }
      events.push(parsed);
    } catch (error) {
      errors.push({
        lineNumber: index + 1,
        rawLine: line,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return { events, errors };
}

