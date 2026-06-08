import type { Session, VisibleMessage } from "../types.js";

export const SYNC_START = "<!-- CODEX_SYNC_START -->";
export const SYNC_END = "<!-- CODEX_SYNC_END -->";

export type RenderMarkdownInput = {
  session: Session;
  visibleMessages: VisibleMessage[];
  syncHash: string;
};

function yamlString(value: string | undefined): string {
  return JSON.stringify(value ?? "");
}

export function escapeSyncMarkers(content: string): string {
  return content
    .replaceAll(SYNC_START, "&lt;!-- CODEX_SYNC_START --&gt;")
    .replaceAll(SYNC_END, "&lt;!-- CODEX_SYNC_END --&gt;");
}

function renderMessage(message: VisibleMessage): string {
  const heading = message.role === "user" ? "User" : "Codex";
  return `### ${heading}\n\n${escapeSyncMarkers(message.content.trim())}`;
}

export function renderSyncBlock(visibleMessages: VisibleMessage[]): string {
  const messages = visibleMessages.map(renderMessage).join("\n\n");
  return `${SYNC_START}\n\n## 对话内容\n\n${messages}\n\n${SYNC_END}`;
}

export function renderMarkdown({ session, visibleMessages, syncHash }: RenderMarkdownInput): string {
  const shortId = session.id.slice(0, 8);
  const title = session.title?.trim() || `Codex Session ${shortId}`;
  const frontmatter = [
    "---",
    "source: codex",
    `session_id: ${yamlString(session.id)}`,
    `source_file: ${yamlString(session.sourceFile)}`,
    `created_at: ${yamlString(session.createdAt)}`,
    `updated_at: ${yamlString(session.updatedAt)}`,
    `sync_hash: ${yamlString(syncHash)}`,
    "sync_mode: view",
    "output_version: 1",
    "parser_version: 1",
    "---",
  ].join("\n");

  return `${frontmatter}\n\n# ${title}\n\n${renderSyncBlock(visibleMessages)}\n\n## 我的补充\n`;
}
