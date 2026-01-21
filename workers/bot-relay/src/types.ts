// Discord Gateway opcodes
export enum GatewayOpcode {
  DISPATCH = 0,
  HEARTBEAT = 1,
  IDENTIFY = 2,
  PRESENCE_UPDATE = 3,
  VOICE_STATE_UPDATE = 4,
  RESUME = 6,
  RECONNECT = 7,
  REQUEST_GUILD_MEMBERS = 8,
  INVALID_SESSION = 9,
  HELLO = 10,
  HEARTBEAT_ACK = 11,
}

// Discord Gateway intents
export enum GatewayIntent {
  GUILDS = 1 << 0,
  GUILD_MEMBERS = 1 << 1,
  GUILD_MESSAGES = 1 << 9,
  MESSAGE_CONTENT = 1 << 15,
}

// Gateway payload
export interface GatewayPayload {
  op: GatewayOpcode;
  d: any;
  s?: number | null;
  t?: string | null;
}

// Discord message
export interface DiscordMessage {
  id: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    bot?: boolean;
  };
  content: string;
  timestamp: string;
  edited_timestamp?: string | null;
  tts: boolean;
  mention_everyone: boolean;
  mentions: any[];
  mention_roles: any[];
  attachments: any[];
  embeds: any[];
  reactions?: any[];
  nonce?: string | number;
  pinned: boolean;
  webhook_id?: string;
  type: number;
  activity?: any;
  application?: any;
  message_reference?: any;
  flags?: number;
}

// Environment bindings
export interface Env {
  DISCORD_GATEWAY: DurableObjectNamespace;
  DISCORD_BOT_TOKEN: string;
  MAIN_WORKER_URL: string;
  BOT_RELAY_SECRET: string;
  ENVIRONMENT?: string;
}

// Relay message to main worker
export interface RelayMessage {
  threadId: string;
  message: string;
  author: string;
  timestamp: number;
}
