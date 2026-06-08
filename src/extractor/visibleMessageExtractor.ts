import type { RawEvent, RawEventCategory, Session, Visibility, VisibleMessage } from "../types.js";

function lower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function getNestedRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getResponsePayload(event: RawEvent): Record<string, unknown> | undefined {
  return lower(event.type) === "response_item" ? getNestedRecord(event.payload) : undefined;
}

function fieldString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function classifyRawEvent(event: RawEvent): RawEventCategory {
  const type = lower(event.type);
  const payload = getResponsePayload(event);
  const payloadType = lower(payload?.type);
  const payloadRole = lower(payload?.role);
  const role = lower(event.role);
  const name = lower(event.name);
  const level = lower(event.level);

  if (
    role === "system" ||
    payloadRole === "system" ||
    payloadRole === "developer" ||
    ["system", "system_event", "instruction", "developer_message", "session_meta"].includes(type)
  ) {
    return "system_event";
  }
  if (
    type.includes("tool") ||
    payloadType.includes("tool") ||
    ["function_call", "function_result", "function_call_output", "command", "command_result", "shell", "patch", "apply_patch", "custom_tool_call", "custom_tool_call_output"].includes(payloadType) ||
    ["function_call", "function_result", "command", "command_result", "shell", "patch", "apply_patch"].includes(type) ||
    ["apply_patch", "shell"].includes(name)
  ) {
    return "tool_event";
  }
  if (type.includes("debug") || type.includes("trace") || type.includes("log") || ["debug", "trace"].includes(level)) {
    return "debug_event";
  }
  if (
    type.includes("metadata") ||
    ["session_metadata", "conversation_metadata", "state", "checkpoint", "snapshot"].includes(type)
  ) {
    return "metadata_event";
  }
  if (
    type.includes("internal") ||
    type.includes("lifecycle") ||
    ["start", "end", "heartbeat", "status", "progress"].includes(type)
  ) {
    return "internal_event";
  }
  if (type === "response_item" && payloadType !== "message") {
    return "internal_event";
  }
  if (
    role === "user" ||
    role === "human" ||
    payloadRole === "user" ||
    payloadRole === "human" ||
    type === "user_message" ||
    ((type === "message" || type === "input" || type === "turn") && (role === "user" || role === "human"))
  ) {
    return "user_message";
  }
  if (
    ["assistant", "ai", "model", "codex"].includes(role) ||
    ["assistant", "ai", "model", "codex"].includes(payloadRole) ||
    type === "assistant_message" ||
    ((type === "message" || type === "output" || type === "turn") &&
      ["assistant", "ai", "model", "codex"].includes(role))
  ) {
    return "assistant_message";
  }
  return "unknown_event";
}

export function getEventVisibility(category: RawEventCategory): Visibility {
  if (category === "user_message" || category === "assistant_message") {
    return "visible";
  }
  if (category === "unknown_event") {
    return "unknown";
  }
  return "hidden";
}

export function extractRole(event: RawEvent): "user" | "assistant" | undefined {
  const payload = getResponsePayload(event);
  const message = getNestedRecord(event.message);
  const author = getNestedRecord(event.author);
  const candidates = [event.role, payload?.role, message?.role, author?.role, event.type].map(lower);
  if (candidates.some((value) => value === "user" || value === "human" || value === "user_message")) {
    return "user";
  }
  if (candidates.some((value) => ["assistant", "ai", "model", "codex", "assistant_message"].includes(value))) {
    return "assistant";
  }
  const category = classifyRawEvent(event);
  if (category === "user_message") {
    return "user";
  }
  if (category === "assistant_message") {
    return "assistant";
  }
  return undefined;
}

function extractTextValue(value: unknown, depth: number): string {
  if (depth > 3 || value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => extractTextValue(item, depth + 1))
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }
  const record = getNestedRecord(value);
  if (!record) {
    return "";
  }
  for (const key of ["text", "content", "message", "value", "body"]) {
    const extracted = extractTextValue(record[key], depth + 1);
    if (extracted) {
      return extracted;
    }
  }
  return "";
}

export function extractContent(event: RawEvent): string {
  const payload = getResponsePayload(event);
  if (payload) {
    for (const key of ["content", "text", "message", "body", "value"] as const) {
      const extracted = extractTextValue(payload[key], 0);
      if (extracted) {
        return extracted;
      }
    }
  }
  for (const key of ["content", "text", "message", "body", "value"] as const) {
    const extracted = extractTextValue(event[key], 0);
    if (extracted) {
      return extracted;
    }
  }
  return "";
}

export function extractTimestamp(event: RawEvent): string | undefined {
  return fieldString(event.timestamp) ?? fieldString(event.created_at) ?? fieldString(event.createdAt) ?? fieldString(event.time) ?? fieldString(event.date);
}

export function extractVisibleMessages(session: Session): VisibleMessage[] {
  const messages: VisibleMessage[] = [];

  for (const event of session.rawEvents) {
    const category = classifyRawEvent(event);
    if (getEventVisibility(category) !== "visible") {
      continue;
    }
    const role = extractRole(event);
    const content = extractContent(event).trim();
    if (!role || !content) {
      continue;
    }
    const previous = messages.at(-1);
    if (previous && previous.role === role && previous.content === content) {
      continue;
    }
    messages.push({
      role,
      content,
      createdAt: extractTimestamp(event),
    });
  }

  return messages;
}
