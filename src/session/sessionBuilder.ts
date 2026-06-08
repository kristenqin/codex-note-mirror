import type { RawEvent, Session, SourceFile } from "../types.js";
import { shortHash } from "../utils/hash.js";

type BuildSessionInput = {
  sourceFile: SourceFile;
  rawEvents: RawEvent[];
};

function firstString(values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function extractEventTimestamp(event: RawEvent): string | undefined {
  const payload = getRecord(event.payload);
  return firstString([event.timestamp, event.created_at, event.createdAt, event.time, event.date, payload?.timestamp]);
}

export function buildSession({ sourceFile, rawEvents }: BuildSessionInput): Session {
  const sessionId =
    firstString(
      rawEvents.flatMap((event) => {
        const payload = getRecord(event.payload);
        return [event.session_id, event.sessionId, event.conversation_id, payload?.id, payload?.session_id, payload?.sessionId];
      }),
    ) ??
    shortHash(`${sourceFile.path}:${sourceFile.contentHash}`, 16);
  const timestamps = rawEvents.map(extractEventTimestamp).filter((value): value is string => Boolean(value));
  const title = firstString(rawEvents.map((event) => event.title));

  return {
    id: sessionId,
    sourceFile: sourceFile.path,
    sourceModifiedAt: sourceFile.modifiedAt,
    createdAt: timestamps[0] ?? sourceFile.modifiedAt,
    updatedAt: timestamps.at(-1) ?? sourceFile.modifiedAt,
    title,
    rawEvents,
  };
}
