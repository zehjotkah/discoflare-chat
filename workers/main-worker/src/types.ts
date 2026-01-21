// WebSocket message types
export type ClientMessageType = 'init' | 'message' | 'ping';
export type ServerMessageType = 'ready' | 'message' | 'error' | 'pong' | 'typing';

export interface ClientMessage {
  type: ClientMessageType;
  data: any;
}

export interface InitData {
  name: string;
  email: string;
  page: string;
  turnstileToken: string;
  sessionId?: string; // For reconnection
}

export interface MessageData {
  message: string;
}

export interface ServerMessage {
  type: ServerMessageType;
  data: any;
}

export interface ReadyData {
  message: string;
  sessionId: string;
}

export interface IncomingMessageData {
  message: string;
  author: string;
  timestamp: number;
}

export interface ErrorData {
  message: string;
  code?: string;
}

// Session state
export interface SessionState {
  sessionId: string;
  email: string;
  name: string;
  threadId: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  messageHistory: StoredMessage[];
}

export interface StoredMessage {
  author: string;
  message: string;
  timestamp: number;
}

// Discord types
export interface DiscordThread {
  id: string;
  name: string;
  parent_id: string;
  owner_id?: string;
  archived?: boolean;
  auto_archive_duration?: number;
}

export interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    bot: boolean;
  };
  timestamp: string;
  channel_id: string;
}

export interface DiscordThreadsResponse {
  threads: DiscordThread[];
  members: any[];
  has_more: boolean;
}

// Bot relay types
export interface RelayMessage {
  threadId: string;
  message: string;
  author: string;
  timestamp: number;
}

// Turnstile verification
export interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

// Environment bindings
export interface Env {
  CHAT_SESSION: DurableObjectNamespace;
  DISCORD_BOT_TOKEN: string;
  DISCORD_SUPPORT_CHANNEL_ID: string;
  TURNSTILE_SECRET_KEY: string;
  BOT_RELAY_SECRET: string;
  ALLOWED_ORIGINS: string;
  ENVIRONMENT?: string;
}

// Rate limiting
export interface RateLimitState {
  messageCount: number;
  windowStart: number;
}
