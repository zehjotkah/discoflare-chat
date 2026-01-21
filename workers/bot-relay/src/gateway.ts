import {
  Env,
  GatewayOpcode,
  GatewayIntent,
  GatewayPayload,
  DiscordMessage,
  RelayMessage,
} from './types';

/**
 * Durable Object for maintaining Discord Gateway connection
 * Runs as a singleton to maintain persistent WebSocket connection to Discord
 */
export class DiscordGateway {
  private state: DurableObjectState;
  private env: Env;
  private ws: WebSocket | null = null;
  private heartbeatInterval: number | null = null;
  private sessionId: string | null = null;
  private sequenceNumber: number | null = null;
  private reconnectAttempts: number = 0;
  private isReconnecting: boolean = false;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Start connection on initialization
    this.state.blockConcurrencyWhile(async () => {
      await this.connect();
    });
  }
  
  /**
   * Handle HTTP requests (for status checks)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/status') {
      return new Response(
        JSON.stringify({
          connected: this.ws?.readyState === WebSocket.OPEN,
          sessionId: this.sessionId,
          sequenceNumber: this.sequenceNumber,
          reconnectAttempts: this.reconnectAttempts,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return new Response('Discord Bot Relay Active', { status: 200 });
  }
  
  /**
   * Connect to Discord Gateway
   */
  private async connect(): Promise<void> {
    if (this.isReconnecting) return;
    
    try {
      const gatewayUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
      this.ws = new WebSocket(gatewayUrl);
      
      this.ws.addEventListener('open', () => {
        console.log('Connected to Discord Gateway');
        this.reconnectAttempts = 0;
      });
      
      this.ws.addEventListener('message', (event: MessageEvent) => {
        this.handleMessage(event.data as string);
      });
      
      this.ws.addEventListener('close', (event: CloseEvent) => {
        console.log('Disconnected from Discord Gateway:', event.code, event.reason);
        this.cleanup();
        this.scheduleReconnect();
      });
      
      this.ws.addEventListener('error', () => {
        console.error('Discord Gateway WebSocket error');
      });
    } catch (error) {
      console.error('Error connecting to Discord Gateway:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle incoming Gateway messages
   */
  private async handleMessage(data: string): Promise<void> {
    try {
      const payload: GatewayPayload = JSON.parse(data);
      
      // Update sequence number
      if (payload.s !== null && payload.s !== undefined) {
        this.sequenceNumber = payload.s;
      }
      
      switch (payload.op) {
        case GatewayOpcode.HELLO:
          await this.handleHello(payload.d);
          break;
        case GatewayOpcode.DISPATCH:
          await this.handleDispatch(payload);
          break;
        case GatewayOpcode.HEARTBEAT_ACK:
          // Heartbeat acknowledged
          break;
        case GatewayOpcode.RECONNECT:
          console.log('Discord requested reconnect');
          this.reconnect();
          break;
        case GatewayOpcode.INVALID_SESSION:
          console.log('Invalid session, reconnecting...');
          this.sessionId = null;
          this.sequenceNumber = null;
          setTimeout(() => this.reconnect(), 5000);
          break;
      }
    } catch (error) {
      console.error('Error handling Gateway message:', error);
    }
  }
  
  /**
   * Handle HELLO opcode
   */
  private async handleHello(data: any): Promise<void> {
    const heartbeatInterval = data.heartbeat_interval;
    
    // Start heartbeat
    this.startHeartbeat(heartbeatInterval);
    
    // Identify or resume
    if (this.sessionId && this.sequenceNumber !== null) {
      await this.resume();
    } else {
      await this.identify();
    }
  }
  
  /**
   * Send IDENTIFY payload
   */
  private async identify(): Promise<void> {
    const payload: GatewayPayload = {
      op: GatewayOpcode.IDENTIFY,
      d: {
        token: this.env.DISCORD_BOT_TOKEN,
        intents:
          GatewayIntent.GUILDS |
          GatewayIntent.GUILD_MESSAGES |
          GatewayIntent.MESSAGE_CONTENT,
        properties: {
          os: 'linux',
          browser: 'cloudflare-workers',
          device: 'cloudflare-workers',
        },
      },
    };
    
    this.send(payload);
  }
  
  /**
   * Send RESUME payload
   */
  private async resume(): Promise<void> {
    const payload: GatewayPayload = {
      op: GatewayOpcode.RESUME,
      d: {
        token: this.env.DISCORD_BOT_TOKEN,
        session_id: this.sessionId,
        seq: this.sequenceNumber,
      },
    };
    
    this.send(payload);
  }
  
  /**
   * Handle DISPATCH events
   */
  private async handleDispatch(payload: GatewayPayload): Promise<void> {
    switch (payload.t) {
      case 'READY':
        this.sessionId = payload.d.session_id;
        console.log('Bot ready, session ID:', this.sessionId);
        break;
      case 'RESUMED':
        console.log('Session resumed');
        break;
      case 'MESSAGE_CREATE':
        await this.handleMessageCreate(payload.d);
        break;
    }
  }
  
  /**
   * Handle MESSAGE_CREATE event
   */
  private async handleMessageCreate(message: DiscordMessage): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Ignore empty messages
    if (!message.content) return;
    
    // Forward to main worker
    try {
      const relayMessage: RelayMessage = {
        threadId: message.channel_id,
        message: message.content,
        author: message.author.username,
        timestamp: Date.now(),
      };
      
      const response = await fetch(`${this.env.MAIN_WORKER_URL}/relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.BOT_RELAY_SECRET}`,
        },
        body: JSON.stringify(relayMessage),
      });
      
      if (!response.ok) {
        console.error('Failed to relay message:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error relaying message to main worker:', error);
    }
  }
  
  /**
   * Start heartbeat interval
   */
  private startHeartbeat(interval: number): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      const payload: GatewayPayload = {
        op: GatewayOpcode.HEARTBEAT,
        d: this.sequenceNumber,
      };
      this.send(payload);
    }, interval) as any;
  }
  
  /**
   * Send payload to Gateway
   */
  private send(payload: GatewayPayload): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
  
  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    
    this.reconnectAttempts++;
    const delay = Math.min(5000 * this.reconnectAttempts, 60000); // Max 60 seconds
    
    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.reconnect();
    }, delay);
  }
  
  /**
   * Reconnect to Gateway
   */
  private async reconnect(): Promise<void> {
    this.isReconnecting = true;
    this.cleanup();
    
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        // Ignore close errors
      }
      this.ws = null;
    }
    
    await this.connect();
    this.isReconnecting = false;
  }
}
