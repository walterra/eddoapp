/**
 * Chat session types for AI agent sessions stored in CouchDB.
 */

import type { ChatMessage, ContentBlock, ModelProvider, ThinkingLevel } from './chat-messages';

/** Container states for Docker management */
export type ContainerState = 'pending' | 'creating' | 'running' | 'paused' | 'stopped' | 'error';

/** Worktree states for git worktree management */
export type WorktreeState = 'pending' | 'cloning' | 'creating' | 'ready' | 'error';

/** Repository configuration for a chat session */
export interface SessionRepository {
  /** Full repo slug (e.g., "elastic/kibana", "walterra/eddoapp") */
  slug: string;
  /** Git URL for cloning */
  gitUrl: string;
  /** Default branch name */
  defaultBranch: string;
  /** Branch or commit to work on */
  ref?: string;
}

/** Session statistics */
export interface SessionStats {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

/** Chat session metadata (stored in CouchDB) */
export interface ChatSession {
  _id: string;
  _rev?: string;
  version: 'alpha1';
  username: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  repository?: SessionRepository;
  containerState: ContainerState;
  containerId?: string;
  worktreeState: WorktreeState;
  worktreePath?: string;
  provider?: ModelProvider;
  modelId?: string;
  thinkingLevel?: ThinkingLevel;
  stats: SessionStats;
  parentSessionId?: string;
}

/** Session entry types (from pi-coding-agent JSONL format) */
export type SessionEntryType =
  | 'session'
  | 'message'
  | 'model_change'
  | 'thinking_level_change'
  | 'compaction'
  | 'branch_summary'
  | 'custom'
  | 'custom_message'
  | 'label'
  | 'session_info';

/** Base entry structure (all entries except header) */
export interface SessionEntryBase {
  type: SessionEntryType;
  id: string;
  parentId: string | null;
  timestamp: string;
}

/** Session header entry (first line of JSONL) */
export interface SessionHeaderEntry {
  type: 'session';
  version: number;
  id: string;
  timestamp: string;
  cwd: string;
  parentSession?: string;
}

/** Message entry in session */
export interface SessionMessageEntry extends SessionEntryBase {
  type: 'message';
  message: ChatMessage;
}

/** Model change entry */
export interface ModelChangeEntry extends SessionEntryBase {
  type: 'model_change';
  provider: ModelProvider;
  modelId: string;
}

/** Thinking level change entry */
export interface ThinkingLevelChangeEntry extends SessionEntryBase {
  type: 'thinking_level_change';
  thinkingLevel: ThinkingLevel;
}

/** Compaction entry (context summary) */
export interface CompactionEntry extends SessionEntryBase {
  type: 'compaction';
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  details?: Record<string, unknown>;
  fromHook?: boolean;
}

/** Branch summary entry */
export interface BranchSummaryEntry extends SessionEntryBase {
  type: 'branch_summary';
  fromId: string;
  summary: string;
  details?: {
    readFiles?: string[];
    modifiedFiles?: string[];
    [key: string]: unknown;
  };
  fromHook?: boolean;
}

/** Custom entry (extension state, not in LLM context) */
export interface CustomEntry extends SessionEntryBase {
  type: 'custom';
  customType: string;
  data?: Record<string, unknown>;
}

/** Custom message entry (extension message, in LLM context) */
export interface CustomMessageEntry extends SessionEntryBase {
  type: 'custom_message';
  customType: string;
  content: string | ContentBlock[];
  display: boolean;
  details?: Record<string, unknown>;
}

/** Label entry (bookmark) */
export interface LabelEntry extends SessionEntryBase {
  type: 'label';
  targetId: string;
  label?: string;
}

/** Session info entry (display name) */
export interface SessionInfoEntry extends SessionEntryBase {
  type: 'session_info';
  name?: string;
}

/** Union of all session entry types */
export type SessionEntry =
  | SessionHeaderEntry
  | SessionMessageEntry
  | ModelChangeEntry
  | ThinkingLevelChangeEntry
  | CompactionEntry
  | BranchSummaryEntry
  | CustomEntry
  | CustomMessageEntry
  | LabelEntry
  | SessionInfoEntry;

/** Chat message document stored in CouchDB (session entries) */
export interface ChatMessageDoc {
  _id: string;
  _rev?: string;
  sessionId: string;
  entry: SessionEntry;
}

/** Create new session request */
export interface CreateChatSessionRequest {
  name?: string;
  repository?: SessionRepository;
  parentSessionId?: string;
}

/** Update session request */
export interface UpdateChatSessionRequest {
  name?: string;
  containerState?: ContainerState;
  containerId?: string;
  worktreeState?: WorktreeState;
  worktreePath?: string;
  provider?: ModelProvider;
  modelId?: string;
  thinkingLevel?: ThinkingLevel;
  stats?: Partial<SessionStats>;
}

/** Chat session operations interface */
export interface ChatSessionOperations {
  create(request: CreateChatSessionRequest): Promise<ChatSession>;
  get(sessionId: string): Promise<ChatSession | null>;
  list(): Promise<ChatSession[]>;
  update(sessionId: string, updates: UpdateChatSessionRequest): Promise<ChatSession>;
  delete(sessionId: string): Promise<void>;
  appendEntry(sessionId: string, entry: Omit<SessionEntry, 'id' | 'timestamp'>): Promise<string>;
  getEntries(sessionId: string): Promise<SessionEntry[]>;
  getBranch(sessionId: string, fromEntryId?: string): Promise<SessionEntry[]>;
}

/** Default session statistics */
export function createDefaultSessionStats(): SessionStats {
  return {
    messageCount: 0,
    userMessageCount: 0,
    assistantMessageCount: 0,
    toolCallCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0,
  };
}

/** Type guard for ChatSession */
export function isChatSession(value: unknown): value is ChatSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    'version' in value &&
    (value as ChatSession).version === 'alpha1'
  );
}

/** Type guard for SessionMessageEntry */
export function isSessionMessageEntry(entry: SessionEntry): entry is SessionMessageEntry {
  return entry.type === 'message';
}
