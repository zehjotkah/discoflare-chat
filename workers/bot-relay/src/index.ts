import { Env } from './types';
import { DiscordGateway } from './gateway';

// Export Durable Object
export { DiscordGateway };

/**
 * Bot Relay Worker entry point
 * Maintains a singleton Durable Object for Discord Gateway connection
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Use singleton Durable Object for Gateway connection
    const id = env.DISCORD_GATEWAY.idFromName('singleton');
    const stub = env.DISCORD_GATEWAY.get(id);
    
    // Forward request to Durable Object
    return stub.fetch(request);
  },
};
