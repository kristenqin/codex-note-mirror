import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTargetPathDisambiguator, resolveTargetPath } from "../src/renderer/targetPath.js";

describe("resolveTargetPath", () => {
  it("uses month directory and stable short session id", () => {
    const target = resolveTargetPath({
      targetRoot: "/notes",
      session: {
        id: "a1b2c3d4e5f6",
        sourceFile: "/tmp/session.jsonl",
        sourceModifiedAt: "2026-06-08T12:00:00.000Z",
        createdAt: "2026-06-08T10:00:00+08:00",
        rawEvents: [],
      },
    });

    expect(target).toBe(path.join("/notes", "2026-06", "2026-06-08_session-a1b2c3d4.md"));
  });

  it("can add a stable disambiguator when short ids collide", () => {
    const session = {
      id: "demo-session-001",
      sourceFile: "/tmp/session.jsonl",
      sourceModifiedAt: "2026-06-08T12:00:00.000Z",
      createdAt: "2026-06-08T10:00:00+08:00",
      rawEvents: [],
    };
    const target = resolveTargetPath({
      targetRoot: "/notes",
      session,
      disambiguator: getTargetPathDisambiguator(session),
    });

    expect(target).toMatch(/2026-06-08_session-demo-ses-[a-f0-9]{6}\.md$/);
  });
});
