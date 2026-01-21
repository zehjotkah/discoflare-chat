# Implementation Guide - Cloudflare-Discord Chat Widget

## Implementation Order

This guide outlines the recommended order for implementing the chat widget system, with detailed specifications for each component.

## Phase 1: Foundation Setup

### 1.1 Project Initialization

**Create base project structure**:
```bash
cloudflare-chat/
├── widget/
├── workers/main-worker/
├── workers/bot-relay/
├── examples/
├── docs/
└── scripts/
```

**Initialize package.json** (root):
```json
{
  "name": "cloudflare-discord-chat",
  "version": "1.0.0",
  "description": "Lightweight chat widget using Cloudflare Workers and Discord",
  "scripts": {
    "build:widget": "bash scripts/build-widget.sh",
    "deploy:main": "cd workers/main-worker && npm run deploy",
    "deploy:bot": "cd workers/bot-relay && npm run deploy",
    "deploy:all": "npm run deploy:main && npm run deploy:bot",
    "dev:main": "cd workers/main-worker && npm run dev",
    "dev:bot": "cd workers/bot-relay && npm run dev"
  }
}
```

### 1.2 TypeScript Configuration

**workers/main-worker/tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ES2022",
    "lib": ["ES2021"],
    "types": ["@cloudflare/workers-types"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

### 1.3 Wrangler Configuration

**workers/main-worker/wrangler.toml**:
```toml
name = "cloudflare-chat-main"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "CHAT_SESSION", class_name = "ChatSession" }
]

[[migrations]]
tag = "v1"
new_classes = ["ChatSession"]

[vars]
ENVIRONMENT = "production"

# Secrets (set via: wrangler secret put SECRET_NAME)
# DISCORD_BOT_TOKEN
# DISCORD_SUPPORT_CHANNEL_ID
# TURNSTILE_SECRET_KEY
# BOT_RELAY_SECRET
# ALLOWED_ORIGINS
```

**workers/bot-relay/wrangler.toml**:
```toml
name = "cloudflare-chat-bot-relay"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "DISCORD_GATEWAY", class_name = "DiscordGateway" }
]

[[migrations]]
tag = "v1"
new_classes = ["DiscordGateway"]

# Secrets (set via: wrangler secret put SECRET_NAME)
# DISCORD_BOT_TOKEN
# MAIN_WORKER_URL
# BOT_RELAY_SECRET
```

## Phase 2: Core Types and Interfaces

### 2.1 Shared Type Definitions

**workers/main-worker/src/types.ts**:
```typescript
// WebSocket message types
export type ClientMessageType = 'init' | 'message' | 'ping';
export type ServerMessageType = 'ready' | 'message' | 'error' | 'pong';

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
}

// Bot relay types
export interface RelayMessage {
  threadId: string;
  message: string;
  author: string;
  timestamp: number;
}

// Environment bindings
export interface Env {
  CHAT_SESSION: DurableObjectNamespace;
  DISCORD_BOT_TOKEN: string;
  DISCORD_SUPPORT_CHANNEL_ID: string;
  TURNSTILE_SECRET_KEY: string;
  BOT_RELAY_SECRET: string;
  ALLOWED_ORIGINS: string;
}
```

## Phase 3: Chat Widget Implementation

### 3.1 Widget HTML Structure

**widget/chat-widget.js** (Core structure):
```javascript
(function() {
  'use strict';
  
  // Configuration
  const config = window.CloudflareChat || {};
  const WORKER_URL = config.workerUrl || '';
  const TURNSTILE_SITE_KEY = config.turnstileSiteKey || '';
  const THEME = config.theme || {};
  
  // Constants
  const STORAGE_KEY = 'cloudflare_chat_session';
  const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
  const RECONNECT_INTERVALS = [2000, 4000, 8000, 16000];
  const MAX_MESSAGE_LENGTH = 2000;
  
  // State
  let ws = null;
  let sessionId = null;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let isInitialized = false;
  
  // DOM elements (created dynamically)
  let chatButton = null;
  let chatWindow = null;
  let messageContainer = null;
  let inputField = null;
  let sendButton = null;
  
  // Initialize widget
  function init() {
    if (isInitialized) return;
    isInitialized = true;
    
    injectStyles();
    createChatButton();
    loadTurnstileScript();
    restoreSession();
  }
  
  // ... (continued in next section)
})();
```

### 3.2 Widget Core Functions

Key functions to implement:
1. **createChatButton()** - Render floating button
2. **createChatWindow()** - Build chat interface
3. **connectWebSocket()** - Establish WS connection
4. **sendMessage()** - Send user messages
5. **receiveMessage()** - Handle incoming messages
6. **handleReconnect()** - Automatic reconnection logic
7. **saveSession()** / **restoreSession()** - localStorage persistence
8. **validateTurnstile()** - CAPTCHA verification

### 3.3 Widget Styling

**widget/chat-widget.css**:
```css
/* CSS Variables for theming */
:root {
  --chat-primary-color: #5865F2;
  --chat-bg-color: #ffffff;
  --chat-text-color: #2c2f33;
  --chat-border-radius: 12px;
  --chat-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Chat button */
.cloudflare-chat-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--chat-primary-color);
  border: none;
  cursor: pointer;
  box-shadow: var(--chat-shadow);
  z-index: 9998;
  transition: transform 0.2s;
}

.cloudflare-chat-button:hover {
  transform: scale(1.1);
}

/* Chat window */
.cloudflare-chat-window {
  position: fixed;
  bottom: 90px;
  right: 20px;
  width: 380px;
  height: 600px;
  max-height: calc(100vh - 120px);
  background: var(--chat-bg-color);
  border-radius: var(--chat-border-radius);
  box-shadow: var(--chat-shadow);
  display: flex;
  flex-direction: column;
  z-index: 9999;
  overflow: hidden;
}

/* Responsive design */
@media (max-width: 768px) {
  .cloudflare-chat-window {
    width: calc(100vw - 40px);
    height: calc(100vh - 120px);
    bottom: 10px;
    right: 20px;
  }
}

/* Message styles, input field, etc. */
/* ... (full CSS implementation) */
```

## Phase 4: Main Cloudflare Worker

### 4.1 Worker Entry Point

**workers/main-worker/src/index.ts**:
```typescript
import { Env, ClientMessage, ServerMessage } from './types';
import { ChatSession } from './session';
import { validateTurnstile } from './turnstile';
import { handleRelayMessage } from './relay';

export { ChatSession };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': getAllowedOrigin(request, env),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check
    if (url.pathname === '/health') {
      return new Response('OK', { headers: corsHeaders });
    }
    
    // WebSocket upgrade
    if (url.pathname === '/ws') {
      return handleWebSocket(request, env, corsHeaders);
    }
    
    // Relay endpoint (from bot)
    if (url.pathname === '/relay' && request.method === 'POST') {
      return handleRelayMessage(request, env, corsHeaders);
    }
    
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

async function handleWebSocket(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Validate origin
  const origin = request.headers.get('Origin');
  if (!isOriginAllowed(origin, env)) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // Upgrade to WebSocket
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }
  
  // Create Durable Object ID (use IP-based or random)
  const id = env.CHAT_SESSION.idFromName(crypto.randomUUID());
  const stub = env.CHAT_SESSION.get(id);
  
  // Forward to Durable Object
  return stub.fetch(request);
}

function getAllowedOrigin(request: Request, env: Env): string {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGINS.split(',');
  return allowed.includes(origin) ? origin : allowed[0];
}

function isOriginAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  const allowed = env.ALLOWED_ORIGINS.split(',');
  return allowed.includes(origin);
}
```

### 4.2 Durable Object Implementation

**workers/main-worker/src/session.ts**:
```typescript
import { Env, SessionState, ClientMessage, ServerMessage } from './types';
import { DiscordClient } from './discord';

export class ChatSession {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<WebSocket, SessionState>;
  private discord: DiscordClient;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.discord = new DiscordClient(env);
  }
  
  async fetch(request: Request): Promise<Response> {
    // WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    // Accept WebSocket
    server.accept();
    
    // Set up event handlers
    server.addEventListener('message', (event) => {
      this.handleMessage(server, event.data);
    });
    
    server.addEventListener('close', () => {
      this.handleClose(server);
    });
    
    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleClose(server);
    });
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  private async handleMessage(ws: WebSocket, data: string) {
    try {
      const message: ClientMessage = JSON.parse(data);
      
      switch (message.type) {
        case 'init':
          await this.handleInit(ws, message.data);
          break;
        case 'message':
          await this.handleUserMessage(ws, message.data);
          break;
        case 'ping':
          this.sendMessage(ws, { type: 'pong', data: {} });
          break;
        default:
          this.sendError(ws, 'Unknown message type');
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(ws, 'Invalid message format');
    }
  }
  
  private async handleInit(ws: WebSocket, data: any) {
    // Validate Turnstile token
    const isValid = await this.validateTurnstile(data.turnstileToken);
    if (!isValid) {
      this.sendError(ws, 'Failed to verify CAPTCHA');
      ws.close();
      return;
    }
    
    // Check for session restoration
    if (data.sessionId) {
      const restored = await this.restoreSession(ws, data.sessionId);
      if (restored) return;
    }
    
    // Create new session
    await this.createSession(ws, data);
  }
  
  private async createSession(ws: WebSocket, data: any) {
    const sessionId = crypto.randomUUID();
    
    // Find or create Discord thread
    const threadId = await this.discord.findOrCreateThread(
      data.email,
      data.name
    );
    
    // Create session state
    const session: SessionState = {
      sessionId,
      email: data.email,
      name: data.name,
      threadId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      messageHistory: [],
    };
    
    this.sessions.set(ws, session);
    await this.state.storage.put(`session:${sessionId}`, session);
    
    // Send initial message to Discord
    await this.discord.sendMessage(
      threadId,
      `**New Chat Session**\nName: ${data.name}\nEmail: ${data.email}\nPage: ${data.page}`
    );
    
    // Send ready message to client
    this.sendMessage(ws, {
      type: 'ready',
      data: {
        message: 'Connected to support. An agent will be with you shortly.',
        sessionId,
      },
    });
  }
  
  private async handleUserMessage(ws: WebSocket, data: any) {
    const session = this.sessions.get(ws);
    if (!session) {
      this.sendError(ws, 'Session not initialized');
      return;
    }
    
    // Rate limiting
    if (session.messageCount > 10) {
      this.sendError(ws, 'Rate limit exceeded');
      return;
    }
    
    // Send to Discord
    await this.discord.sendMessage(session.threadId, data.message);
    
    // Update session
    session.messageCount++;
    session.lastActivity = Date.now();
    await this.state.storage.put(`session:${session.sessionId}`, session);
  }
  
  // Receive message from bot relay
  async receiveAgentMessage(threadId: string, message: string, author: string) {
    // Find session by threadId
    for (const [ws, session] of this.sessions) {
      if (session.threadId === threadId) {
        this.sendMessage(ws, {
          type: 'message',
          data: {
            message,
            author,
            timestamp: Date.now(),
          },
        });
        
        // Store in history
        session.messageHistory.push({ author, message, timestamp: Date.now() });
        await this.state.storage.put(`session:${session.sessionId}`, session);
      }
    }
  }
  
  private sendMessage(ws: WebSocket, message: ServerMessage) {
    ws.send(JSON.stringify(message));
  }
  
  private sendError(ws: WebSocket, message: string) {
    this.sendMessage(ws, { type: 'error', data: { message } });
  }
  
  private handleClose(ws: WebSocket) {
    this.sessions.delete(ws);
  }
  
  private async validateTurnstile(token: string): Promise<boolean> {
    // Implementation in separate file
    return true; // Placeholder
  }
  
  private async restoreSession(ws: WebSocket, sessionId: string): Promise<boolean> {
    const session = await this.state.storage.get<SessionState>(`session:${sessionId}`);
    if (!session) return false;
    
    // Check if session is still valid (within 1 hour)
    if (Date.now() - session.lastActivity > 60 * 60 * 1000) {
      return false;
    }
    
    this.sessions.set(ws, session);
    
    // Send ready with history
    this.sendMessage(ws, {
      type: 'ready',
      data: {
        message: 'Session restored',
        sessionId: session.sessionId,
      },
    });
    
    // Send message history
    for (const msg of session.messageHistory) {
      this.sendMessage(ws, {
        type: 'message',
        data: msg,
      });
    }
    
    return true;
  }
}
```

### 4.3 Discord API Client

**workers/main-worker/src/discord.ts**:
```typescript
import { Env, DiscordThread, DiscordMessage } from './types';

export class DiscordClient {
  private env: Env;
  private baseUrl = 'https://discord.com/api/v10';
  
  constructor(env: Env) {
    this.env = env;
  }
  
  async findOrCreateThread(email: string, name: string): Promise<string> {
    // Search for existing thread
    const existingThread = await this.findThreadByEmail(email);
    if (existingThread) {
      return existingThread.id;
    }
    
    // Create new thread
    return await this.createThread(name, email);
  }
  
  private async findThreadByEmail(email: string): Promise<DiscordThread | null> {
    // Get active threads
    const response = await this.request(
      `GET`,
      `/channels/${this.env.DISCORD_SUPPORT_CHANNEL_ID}/threads/active`
    );
    
    const data = await response.json();
    
    // Search for thread with email in name
    for (const thread of data.threads || []) {
      if (thread.name.includes(email)) {
        // Check if thread is less than 90 days old
        const createdAt = this.getSnowflakeTimestamp(thread.id);
        const age = Date.now() - createdAt;
        if (age < 90 * 24 * 60 * 60 * 1000) {
          return thread;
        }
      }
    }
    
    return null;
  }
  
  private async createThread(name: string, email: string): Promise<string> {
    const response = await this.request(
      'POST',
      `/channels/${this.env.DISCORD_SUPPORT_CHANNEL_ID}/threads`,
      {
        name: `Support: ${name} - ${email}`,
        auto_archive_duration: 60,
        type: 11, // Public thread
      }
    );
    
    const thread = await response.json();
    return thread.id;
  }
  
  async sendMessage(threadId: string, content: string): Promise<void> {
    await this.request(
      'POST',
      `/channels/${threadId}/messages`,
      { content }
    );
  }
  
  private async request(method: string, path: string, body?: any): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bot ${this.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${this.baseUrl}${path}`, options);
    
    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${await response.text()}`);
    }
    
    return response;
  }
  
  private getSnowflakeTimestamp(snowflake: string): number {
    const DISCORD_EPOCH = 1420070400000;
    const timestamp = Number(BigInt(snowflake) >> 22n) + DISCORD_EPOCH;
    return timestamp;
  }
}
```

## Phase 5: Discord Bot Relay

### 5.1 Bot Relay Worker

**workers/bot-relay/src/index.ts**:
```typescript
import { DiscordGateway } from './gateway';

export { DiscordGateway };

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Get Durable Object
    const id = env.DISCORD_GATEWAY.idFromName('singleton');
    const stub = env.DISCORD_GATEWAY.get(id);
    
    return stub.fetch(request);
  },
};
```

### 5.2 Discord Gateway Handler

**workers/bot-relay/src/gateway.ts**:
```typescript
export class DiscordGateway {
  private state: DurableObjectState;
  private env: any;
  private ws: WebSocket | null = null;
  private heartbeatInterval: number | null = null;
  private sessionId: string | null = null;
  private sequenceNumber: number | null = null;
  
  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.connect();
  }
  
  async fetch(request: Request): Promise<Response> {
    return new Response('Bot Relay Active', { status: 200 });
  }
  
  private async connect() {
    const gatewayUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
    this.ws = new WebSocket(gatewayUrl);
    
    this.ws.addEventListener('open', () => {
      console.log('Connected to Discord Gateway');
      this.identify();
    });
    
    this.ws.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });
    
    this.ws.addEventListener('close', () => {
      console.log('Disconnected from Discord Gateway');
      setTimeout(() => this.connect(), 5000);
    });
  }
  
  private identify() {
    this.send({
      op: 2,
      d: {
        token: this.env.DISCORD_BOT_TOKEN,
        intents: 1 << 9 | 1 << 15, // GUILD_MESSAGES | MESSAGE_CONTENT
        properties: {
          os: 'linux',
          browser: 'cloudflare-workers',
          device: 'cloudflare-workers',
        },
      },
    });
  }
  
  private async handleMessage(data: string) {
    const payload = JSON.parse(data);
    
    // Update sequence number
    if (payload.s) {
      this.sequenceNumber = payload.s;
    }
    
    switch (payload.op) {
      case 10: // Hello
        this.startHeartbeat(payload.d.heartbeat_interval);
        break;
      case 0: // Dispatch
        await this.handleDispatch(payload);
        break;
      case 11: // Heartbeat ACK
        // Heartbeat acknowledged
        break;
    }
  }
  
  private async handleDispatch(payload: any) {
    switch (payload.t) {
      case 'READY':
        this.sessionId = payload.d.session_id;
        console.log('Bot ready');
        break;
      case 'MESSAGE_CREATE':
        await this.handleMessageCreate(payload.d);
        break;
    }
  }
  
  private async handleMessageCreate(message: any) {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if message is in a support thread
    if (!message.channel_id) return;
    
    // Forward to main worker
    await fetch(`${this.env.MAIN_WORKER_URL}/relay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.BOT_RELAY_SECRET}`,
      },
      body: JSON.stringify({
        threadId: message.channel_id,
        message: message.content,
        author: message.author.username,
        timestamp: Date.now(),
      }),
    });
  }
  
  private startHeartbeat(interval: number) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      this.send({
        op: 1,
        d: this.sequenceNumber,
      });
    }, interval) as any;
  }
  
  private send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}
```

## Phase 6: Integration and Testing

### 6.1 Example Integration

**examples/basic.html**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Widget Demo</title>
</head>
<body>
  <h1>Cloudflare-Discord Chat Widget Demo</h1>
  <p>Click the chat button in the bottom-right corner to start a conversation.</p>
  
  <!-- Load Cloudflare Turnstile -->
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  
  <!-- Load Chat Widget -->
  <script src="../widget/chat-widget.min.js"></script>
  <script>
    window.CloudflareChat = {
      workerUrl: 'https://your-worker.workers.dev',
      turnstileSiteKey: 'your-turnstile-site-key',
      theme: {
        primaryColor: '#5865F2',
        position: 'bottom-right'
      }
    };
  </script>
</body>
</html>
```

### 6.2 Build Script

**scripts/build-widget.sh**:
```bash
#!/bin/bash

# Minify JavaScript
npx terser widget/chat-widget.js \
  --compress \
  --mangle \
  --output widget/chat-widget.min.js

# Minify CSS
npx csso widget/chat-widget.css \
  --output widget/chat-widget.min.css

echo "Widget built successfully!"
```

### 6.3 Deployment Script

**scripts/deploy.sh**:
```bash
#!/bin/bash

echo "Deploying Cloudflare-Discord Chat Widget..."

# Build widget
npm run build:widget

# Deploy main worker
echo "Deploying main worker..."
cd workers/main-worker
npm install
npm run deploy
cd ../..

# Deploy bot relay
echo "Deploying bot relay..."
cd workers/bot-relay
npm install
npm run deploy
cd ../..

echo "Deployment complete!"
echo "Don't forget to set your secrets:"
echo "  wrangler secret put DISCORD_BOT_TOKEN"
echo "  wrangler secret put DISCORD_SUPPORT_CHANNEL_ID"
echo "  wrangler secret put TURNSTILE_SECRET_KEY"
echo "  wrangler secret put BOT_RELAY_SECRET"
echo "  wrangler secret put ALLOWED_ORIGINS"
```

## Phase 7: Documentation

### 7.1 Setup Guides

Create comprehensive documentation:
- **docs/setup-discord.md** - Discord bot creation and configuration
- **docs/deploy-cloudflare.md** - Cloudflare Workers deployment
- **docs/configuration.md** - Configuration options and customization
- **docs/api-reference.md** - API documentation for developers

### 7.2 README

Create a comprehensive README with:
- Project overview
- Features list
- Quick start guide
- Architecture diagram
- Configuration examples
- Troubleshooting section
- Contributing guidelines

## Implementation Checklist

- [ ] Set up project structure
- [ ] Configure TypeScript and Wrangler
- [ ] Implement type definitions
- [ ] Build chat widget (JavaScript/CSS)
- [ ] Implement main Cloudflare Worker
- [ ] Create Durable Object for session management
- [ ] Build Discord API client
- [ ] Implement bot relay Worker
- [ ] Create Discord Gateway handler
- [ ] Add Turnstile integration
- [ ] Implement reconnection logic
- [ ] Create example integrations
- [ ] Write deployment scripts
- [ ] Create documentation
- [ ] Test end-to-end flow
- [ ] Optimize performance
- [ ] Deploy to production

## Next Steps

Once the implementation plan is approved, the development can proceed in the order outlined above, with each phase building upon the previous one. The modular architecture allows for parallel development of the widget and Workers once the type definitions are established.
