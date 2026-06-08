import { createHash } from "node:crypto";
import type { VisibleMessage } from "../types.js";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function shortHash(input: string | Buffer, length = 12): string {
  return sha256Hex(input).slice(0, length);
}

export function hashVisibleMessages(messages: VisibleMessage[]): string {
  return shortHash(JSON.stringify(messages), 12);
}

