import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseJsonlFile } from "../src/parser/jsonlParser.js";

const fixtures = path.resolve("tests/fixtures");

describe("parseJsonlFile", () => {
  it("parses normal JSONL events", async () => {
    const result = await parseJsonlFile(path.join(fixtures, "simple-session.jsonl"));
    expect(result.errors).toHaveLength(0);
    expect(result.events).toHaveLength(2);
  });

  it("records broken lines without stopping later lines", async () => {
    const result = await parseJsonlFile(path.join(fixtures, "broken-line.jsonl"));
    expect(result.errors).toHaveLength(1);
    expect(result.events).toHaveLength(2);
    expect(result.events.at(-1)?.content).toBe("后续正常消息");
  });
});

