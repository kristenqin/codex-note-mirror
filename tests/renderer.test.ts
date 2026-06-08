import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/renderer/markdownRenderer.js";
import { hasExactlyOneSyncBlock } from "../src/sync/writer.js";
import type { Session, VisibleMessage } from "../src/types.js";

describe("renderMarkdown", () => {
  it("renders frontmatter, sync block, and visible messages", () => {
    const session: Session = {
      id: "a1b2c3d4e5f6",
      sourceFile: "/tmp/session.jsonl",
      createdAt: "2026-06-08T10:00:00+08:00",
      updatedAt: "2026-06-08T10:30:00+08:00",
      rawEvents: [],
    };
    const messages: VisibleMessage[] = [
      { role: "user", content: "请帮我修复登录鉴权问题。" },
      { role: "assistant", content: "```bash\nnpm test\n```" },
    ];

    const markdown = renderMarkdown({ session, visibleMessages: messages, syncHash: "abc123" });
    expect(markdown).toContain("source: codex");
    expect(markdown).toContain("<!-- CODEX_SYNC_START -->");
    expect(markdown).toContain("### User");
    expect(markdown).toContain("### Codex");
    expect(markdown).toContain("```bash\nnpm test\n```");
    expect(markdown).toContain("## 我的补充");
  });

  it("escapes sync markers that appear inside message content", () => {
    const markdown = renderMarkdown({
      session: {
        id: "sync-marker-content",
        sourceFile: "/tmp/session.jsonl",
        createdAt: "2026-06-08T10:00:00+08:00",
        rawEvents: [],
      },
      syncHash: "abc123",
      visibleMessages: [
        {
          role: "user",
          content: "<!-- CODEX_SYNC_START -->\ncontent example\n<!-- CODEX_SYNC_END -->",
        },
      ],
    });

    expect(markdown).toContain("&lt;!-- CODEX_SYNC_START --&gt;");
    expect(markdown).toContain("&lt;!-- CODEX_SYNC_END --&gt;");
    expect(hasExactlyOneSyncBlock(markdown)).toBe(true);
  });
});
