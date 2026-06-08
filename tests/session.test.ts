import { describe, expect, it } from "vitest";
import { buildSession } from "../src/session/sessionBuilder.js";

describe("buildSession", () => {
  it("uses real Codex session_meta payload id as the stable session id", () => {
    const session = buildSession({
      sourceFile: {
        path: "/tmp/rollout.jsonl",
        fileName: "rollout.jsonl",
        size: 1,
        modifiedAt: "2026-06-08T10:00:00.000Z",
        contentHash: "old-hash",
      },
      rawEvents: [
        {
          type: "session_meta",
          timestamp: "2026-06-08T10:00:00.000Z",
          payload: {
            id: "019ea748-e0bd-74b3-ba02-cc95af5e0f0f",
            timestamp: "2026-06-08T10:00:00.000Z",
          },
        },
      ],
    });

    expect(session.id).toBe("019ea748-e0bd-74b3-ba02-cc95af5e0f0f");
    expect(session.createdAt).toBe("2026-06-08T10:00:00.000Z");
  });

  it("does not use tool event names as Markdown titles", () => {
    const session = buildSession({
      sourceFile: {
        path: "/tmp/session.jsonl",
        fileName: "session.jsonl",
        size: 1,
        modifiedAt: "2026-06-08T10:00:00.000Z",
        contentHash: "abc",
      },
      rawEvents: [
        { type: "message", role: "user", content: "hello", session_id: "session-1" },
        { type: "tool_call", name: "shell", content: "hidden tool" },
      ],
    });

    expect(session.title).toBeUndefined();
  });
});
