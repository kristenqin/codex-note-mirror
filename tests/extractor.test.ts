import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractVisibleMessages } from "../src/extractor/visibleMessageExtractor.js";
import { parseJsonlFile } from "../src/parser/jsonlParser.js";
import type { Session } from "../src/types.js";

const fixtures = path.resolve("tests/fixtures");

async function fixtureSession(name: string): Promise<Session> {
  const result = await parseJsonlFile(path.join(fixtures, name));
  return {
    id: name,
    sourceFile: name,
    rawEvents: result.events,
  };
}

describe("extractVisibleMessages", () => {
  it("extracts user and assistant messages in order", async () => {
    const messages = extractVisibleMessages(await fixtureSession("multi-turn-session.jsonl"));
    expect(messages.map((message) => `${message.role}:${message.content}`)).toEqual([
      "user:第一问",
      "assistant:第一答",
      "user:第二问",
      "assistant:第二答",
    ]);
  });

  it("filters tool events and unknown events", async () => {
    const toolMessages = extractVisibleMessages(await fixtureSession("tool-events.jsonl"));
    expect(toolMessages.map((message) => message.content)).toEqual(["运行测试", "测试已经通过。"]);

    const unknownMessages = extractVisibleMessages(await fixtureSession("unknown-events.jsonl"));
    expect(unknownMessages.map((message) => message.content)).toEqual(["正常消息"]);
  });

  it("extracts nested and array content", async () => {
    const nested = extractVisibleMessages(await fixtureSession("nested-content.jsonl"));
    expect(nested[0]?.content).toBe("这是嵌套文本");

    const array = extractVisibleMessages(await fixtureSession("array-content.jsonl"));
    expect(array[0]?.content).toBe("第一段\n\n第二段");
  });

  it("skips sessions with no visible messages", async () => {
    const messages = extractVisibleMessages(await fixtureSession("empty-visible-messages.jsonl"));
    expect(messages).toHaveLength(0);
  });

  it("extracts visible messages from real Codex response_item payloads", () => {
    const messages = extractVisibleMessages({
      id: "real-shape",
      sourceFile: "real-shape.jsonl",
      rawEvents: [
        {
          type: "session_meta",
          timestamp: "2026-06-08T10:00:00.000Z",
        },
        {
          type: "response_item",
          timestamp: "2026-06-08T10:00:01.000Z",
          payload: {
            type: "message",
            role: "developer",
            content: [{ type: "input_text", text: "hidden developer instruction" }],
          },
        },
        {
          type: "response_item",
          timestamp: "2026-06-08T10:00:02.000Z",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "真实用户消息" }],
          },
        },
        {
          type: "response_item",
          timestamp: "2026-06-08T10:00:03.000Z",
          payload: {
            type: "function_call",
            name: "shell",
            arguments: "{\"cmd\":\"cat .env\"}",
          },
        },
        {
          type: "response_item",
          timestamp: "2026-06-08T10:00:04.000Z",
          payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "真实助手回复" }],
          },
        },
      ],
    });

    expect(messages).toEqual([
      { role: "user", content: "真实用户消息", createdAt: "2026-06-08T10:00:02.000Z" },
      { role: "assistant", content: "真实助手回复", createdAt: "2026-06-08T10:00:04.000Z" },
    ]);
  });
});
