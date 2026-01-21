import {
  Env,
  SessionState,
  ClientMessage,
  ServerMessage,
  InitData,
  MessageData,
  StoredMessage,
} from './types';
import { DiscordClient } from './discord';
import { validateTurnstile, getClientIP } from './turnstile';

/**
 * Durable Object for managing chat sessions
 * Each instance handles WebSocket connections and session state
 */
export class ChatSession {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<WebSocket, SessionState>;
  private discord: DiscordClient;
  private rateLimits: Map<string, { count: number; resetAt: number }>;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.discord = new DiscordClient(env);
    this.rateLimits = new Map();
  }
  
  /**
   * Handle incoming HTTP requests (WebSocket upgrades)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle register endpoint (coordinator receives session registrations)
    if (url.pathname === '/register' && request.method === 'POST') {
      try {
        const data = await request.json();
        // Store the mapping: threadId -> DO ID
        await this.state.storage.put(`thread:${data.threadId}`, data.doId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Error in register endpoint:', error);
        return new Response(JSON.stringify({ error: 'Failed to register' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Handle relay message endpoint
    if (url.pathname === '/relay' && request.method === 'POST') {
      try {
        const message = await request.json();
        await this.receiveAgentMessage(
          message.threadId,
          message.message,
          message.author
        );
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Error in relay endpoint:', error);
        return new Response(JSON.stringify({ error: 'Failed to relay message' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }
    
    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    // Accept WebSocket connection
    server.accept();
    
    // Set up event handlers
    server.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(server, event.data as string);
    });
    
    server.addEventListener('close', () => {
      this.handleClose(server);
    });
    
    server.addEventListener('error', () => {
      this.handleClose(server);
    });
    
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(ws: WebSocket, data: string): Promise<void> {
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
  
  /**
   * Handle session initialization
   */
  private async handleInit(ws: WebSocket, data: InitData): Promise<void> {
    try {
      // Validate input
      if (!data.name || !data.email || !data.turnstileToken) {
        this.sendError(ws, 'Missing required fields');
        ws.close();
        return;
      }
      
      // Validate email format
      if (!this.isValidEmail(data.email)) {
        this.sendError(ws, 'Invalid email format');
        ws.close();
        return;
      }
      
      // Validate Turnstile token
      const isValid = await validateTurnstile(data.turnstileToken, this.env);
      if (!isValid) {
        this.sendError(ws, 'Failed to verify CAPTCHA. Please try again.');
        ws.close();
        return;
      }
      
      // Check for session restoration
      if (data.sessionId) {
        const restored = await this.restoreSession(ws, data.sessionId);
        if (restored) {
          return;
        }
      }
      
      // Create new session
      await this.createSession(ws, data);
    } catch (error) {
      console.error('Error in handleInit:', error);
      this.sendError(ws, 'Failed to initialize session');
      ws.close();
    }
  }
  
  /**
   * Create a new chat session
   */
  private async createSession(ws: WebSocket, data: InitData): Promise<void> {
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
    
    // Register this session with the coordinator
    try {
      const coordinatorId = this.env.CHAT_SESSION.idFromName('message-coordinator');
      const coordinator = this.env.CHAT_SESSION.get(coordinatorId);
      
      // Get this DO's ID as a string
      const myId = this.state.id.toString();
      
      await coordinator.fetch(new Request(`https://internal/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, doId: myId }),
      }));
    } catch (error) {
      console.error('Error registering with coordinator:', error);
    }
    
    // Send initial message to Discord
    await this.discord.sendInitialMessage(
      threadId,
      data.name,
      data.email,
      data.page || 'Unknown'
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
  
  /**
   * Restore an existing session
   */
  private async restoreSession(ws: WebSocket, sessionId: string): Promise<boolean> {
    try {
      const session = await this.state.storage.get<SessionState>(`session:${sessionId}`);
      if (!session) {
        return false;
      }
      
      // Check if session is still valid (within 1 hour)
      const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
      if (Date.now() - session.lastActivity > SESSION_TIMEOUT) {
        return false;
      }
      
      // Update session
      session.lastActivity = Date.now();
      this.sessions.set(ws, session);
      await this.state.storage.put(`session:${sessionId}`, session);
      
      // Send ready message
      this.sendMessage(ws, {
        type: 'ready',
        data: {
          message: 'Session restored. Welcome back!',
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
    } catch (error) {
      console.error('Error restoring session:', error);
      return false;
    }
  }
  
  /**
   * Handle user message
   */
  private async handleUserMessage(ws: WebSocket, data: MessageData): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) {
      this.sendError(ws, 'Session not initialized');
      return;
    }
    
    // Validate message
    if (!data.message || typeof data.message !== 'string') {
      this.sendError(ws, 'Invalid message');
      return;
    }
    
    // Check message length
    const MAX_MESSAGE_LENGTH = 2000;
    if (data.message.length > MAX_MESSAGE_LENGTH) {
      this.sendError(ws, `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      return;
    }
    
    // Rate limiting
    if (!this.checkRateLimit(session.sessionId)) {
      this.sendError(ws, 'Rate limit exceeded. Please slow down.');
      return;
    }
    
    try {
      // Send to Discord
      const formattedMessage = `**${session.name}:** ${data.message}`;
      await this.discord.sendMessage(session.threadId, formattedMessage);
      
      // Update session
      session.messageCount++;
      session.lastActivity = Date.now();
      
      // Store in history
      const storedMessage: StoredMessage = {
        author: session.name,
        message: data.message,
        timestamp: Date.now(),
      };
      session.messageHistory.push(storedMessage);
      
      // Keep only last 50 messages in history
      if (session.messageHistory.length > 50) {
        session.messageHistory = session.messageHistory.slice(-50);
      }
      
      await this.state.storage.put(`session:${session.sessionId}`, session);
    } catch (error) {
      console.error('Error sending message:', error);
      this.sendError(ws, 'Failed to send message. Please try again.');
    }
  }
  
  /**
   * Receive message from bot relay (agent response)
   */
  async receiveAgentMessage(threadId: string, message: string, author: string): Promise<void> {
    // Check if this is the coordinator
    const threadMapping = await this.state.storage.get<string>(`thread:${threadId}`);
    
    if (threadMapping) {
      // This is the coordinator - forward to the actual session
      try {
        const sessionId = this.env.CHAT_SESSION.idFromString(threadMapping);
        const sessionStub = this.env.CHAT_SESSION.get(sessionId);
        
        await sessionStub.fetch(new Request(`https://internal/relay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, message, author }),
        }));
      } catch (error) {
        console.error('Error forwarding to session:', error);
      }
      return;
    }
    
    // This is a regular session - deliver the message
    for (const [ws, session] of this.sessions) {
      if (session.threadId === threadId) {
        const messageData = {
          message,
          author,
          timestamp: Date.now(),
        };
        
        this.sendMessage(ws, {
          type: 'message',
          data: messageData,
        });
        
        // Store in history
        session.messageHistory.push(messageData);
        if (session.messageHistory.length > 50) {
          session.messageHistory = session.messageHistory.slice(-50);
        }
        
        session.lastActivity = Date.now();
        await this.state.storage.put(`session:${session.sessionId}`, session);
      }
    }
  }
  
  /**
   * Check rate limit for a session
   */
  private checkRateLimit(sessionId: string): boolean {
    const now = Date.now();
    const limit = this.rateLimits.get(sessionId);
    
    const RATE_LIMIT = 10; // messages
    const RATE_WINDOW = 60 * 1000; // 1 minute
    
    if (!limit || now > limit.resetAt) {
      this.rateLimits.set(sessionId, { count: 1, resetAt: now + RATE_WINDOW });
      return true;
    }
    
    if (limit.count >= RATE_LIMIT) {
      return false;
    }
    
    limit.count++;
    return true;
  }
  
  /**
   * Send message to client
   */
  private sendMessage(ws: WebSocket, message: ServerMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Error sending message to client:', error);
    }
  }
  
  /**
   * Send error message to client
   */
  private sendError(ws: WebSocket, message: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { message },
    });
  }
  
  /**
   * Handle WebSocket close
   */
  private handleClose(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (session) {
      // Keep session in storage for potential reconnection
      // It will be cleaned up after timeout
      this.sessions.delete(ws);
    }
  }
  
  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
