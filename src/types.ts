export type Config = {
  sourcePath: string;
  targetPath: string;
  outputFormat: "markdown";
  syncMode: "view";
};

export type SourceFile = {
  path: string;
  fileName: string;
  size: number;
  modifiedAt: string;
  contentHash: string;
};

export type RawEvent = {
  type?: string;
  role?: string;
  content?: unknown;
  text?: unknown;
  message?: unknown;
  timestamp?: string;
  created_at?: string;
  createdAt?: string;
  session_id?: string;
  sessionId?: string;
  conversation_id?: string;
  [key: string]: unknown;
};

export type JsonlParseError = {
  lineNumber: number;
  rawLine: string;
  message: string;
};

export type ParseJsonlFileResult = {
  events: RawEvent[];
  errors: JsonlParseError[];
};

export type Session = {
  id: string;
  sourceFile: string;
  sourceModifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  title?: string;
  rawEvents: RawEvent[];
};

export type VisibleMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type RawEventCategory =
  | "user_message"
  | "assistant_message"
  | "system_event"
  | "tool_event"
  | "debug_event"
  | "metadata_event"
  | "internal_event"
  | "unknown_event";

export type Visibility = "visible" | "hidden" | "unknown";

export type SyncedSession = {
  sourceFile: string;
  targetFile: string;
  sourceModifiedAt: string;
  contentHash: string;
  lastSyncedAt: string;
};

export type SyncState = {
  version: 1;
  lastSyncedAt?: string;
  sessions: Record<string, SyncedSession>;
};

export type DiffSourceFilesResult = {
  newFiles: SourceFile[];
  changedFiles: SourceFile[];
  unchangedFiles: SourceFile[];
  filesToSync: SourceFile[];
};

export type MarkdownWriteConflict =
  | "SYNC_BLOCK_NOT_FOUND"
  | "MULTIPLE_SYNC_BLOCKS"
  | "TARGET_NOT_WRITABLE";

export type WriteMarkdownFileResult = {
  status: "created" | "updated" | "conflict";
  reason?: MarkdownWriteConflict | string;
};

export type AppErrorCode =
  | "CONFIG_NOT_FOUND"
  | "CONFIG_INVALID"
  | "SOURCE_PATH_NOT_FOUND"
  | "TARGET_PATH_NOT_WRITABLE"
  | "FILE_READ_FAILED"
  | "JSONL_PARSE_FAILED"
  | "NO_VISIBLE_MESSAGES"
  | "SYNC_BLOCK_NOT_FOUND"
  | "STATE_INVALID"
  | "UNKNOWN_ERROR";

