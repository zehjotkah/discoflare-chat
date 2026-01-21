import { Env, DiscordThread, DiscordThreadsResponse } from './types';

/**
 * Discord API client for managing threads and messages
 */
export class DiscordClient {
  private env: Env;
  private baseUrl = 'https://discord.com/api/v10';
  
  constructor(env: Env) {
    this.env = env;
  }
  
  /**
   * Find existing thread by email or create a new one
   */
  async findOrCreateThread(email: string, name: string): Promise<string> {
    // Search for existing thread
    const existingThread = await this.findThreadByEmail(email);
    if (existingThread) {
      // Unarchive if needed
      if (existingThread.archived) {
        await this.unarchiveThread(existingThread.id);
      }
      return existingThread.id;
    }
    
    // Create new thread
    return await this.createThread(name, email);
  }
  
  /**
   * Search for existing thread by email in thread name
   */
  private async findThreadByEmail(email: string): Promise<DiscordThread | null> {
    try {
      // Get active threads
      const activeResponse = await this.request<DiscordThreadsResponse>(
        'GET',
        `/channels/${this.env.DISCORD_SUPPORT_CHANNEL_ID}/threads/active`
      );
      
      // Search in active threads
      for (const thread of activeResponse.threads || []) {
        if (thread.name.includes(email)) {
          if (this.isThreadRecent(thread.id)) {
            return thread;
          }
        }
      }
      
      // Get archived threads
      const archivedResponse = await this.request<DiscordThreadsResponse>(
        'GET',
        `/channels/${this.env.DISCORD_SUPPORT_CHANNEL_ID}/threads/archived/public`
      );
      
      // Search in archived threads (within 90 days)
      for (const thread of archivedResponse.threads || []) {
        if (thread.name.includes(email)) {
          if (this.isThreadRecent(thread.id, 90)) {
            return thread;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding thread:', error);
      return null;
    }
  }
  
  /**
   * Create a new support thread
   */
  private async createThread(name: string, email: string): Promise<string> {
    const response = await this.request<DiscordThread>(
      'POST',
      `/channels/${this.env.DISCORD_SUPPORT_CHANNEL_ID}/threads`,
      {
        name: `Support: ${name} - ${email}`,
        auto_archive_duration: 60, // Archive after 60 minutes of inactivity
        type: 11, // Public thread
      }
    );
    
    return response.id;
  }
  
  /**
   * Unarchive a thread
   */
  private async unarchiveThread(threadId: string): Promise<void> {
    await this.request(
      'PATCH',
      `/channels/${threadId}`,
      {
        archived: false,
      }
    );
  }
  
  /**
   * Send a message to a Discord thread
   */
  async sendMessage(threadId: string, content: string): Promise<void> {
    await this.request(
      'POST',
      `/channels/${threadId}/messages`,
      { content }
    );
  }
  
  /**
   * Send a formatted initial message to Discord
   */
  async sendInitialMessage(threadId: string, name: string, email: string, page: string): Promise<void> {
    const content = `**New Chat Session**\n` +
      `👤 **Name:** ${name}\n` +
      `📧 **Email:** ${email}\n` +
      `📄 **Page:** ${page}\n` +
      `⏰ **Time:** ${new Date().toISOString()}\n` +
      `\n*Waiting for visitor's first message...*`;
    
    await this.sendMessage(threadId, content);
  }
  
  /**
   * Make a request to Discord API
   */
  private async request<T = any>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bot ${this.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CloudflareChat/1.0',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${this.baseUrl}${path}`, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord API error: ${response.status} ${errorText}`);
    }
    
    // Some endpoints return 204 No Content
    if (response.status === 204) {
      return {} as T;
    }
    
    return await response.json() as T;
  }
  
  /**
   * Check if thread is recent (within specified days)
   */
  private isThreadRecent(threadId: string, maxDays: number = 90): boolean {
    const DISCORD_EPOCH = 1420070400000;
    const timestamp = Number(BigInt(threadId) >> 22n) + DISCORD_EPOCH;
    const age = Date.now() - timestamp;
    const maxAge = maxDays * 24 * 60 * 60 * 1000;
    return age < maxAge;
  }
  
  /**
   * Get snowflake timestamp
   */
  getSnowflakeTimestamp(snowflake: string): number {
    const DISCORD_EPOCH = 1420070400000;
    return Number(BigInt(snowflake) >> 22n) + DISCORD_EPOCH;
  }
}
