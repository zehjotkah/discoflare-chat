import { Env, RelayMessage } from './types';
import { ChatSession } from './session';

// Export Durable Object
export { ChatSession };

/**
 * Main Worker entry point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = getCorsHeaders(request, env);
    
    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: Date.now() }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    // WebSocket upgrade endpoint
    if (url.pathname === '/ws') {
      return handleWebSocket(request, env, corsHeaders);
    }
    
    // Relay endpoint (from bot)
    if (url.pathname === '/relay' && request.method === 'POST') {
      return handleRelayMessage(request, env, corsHeaders);
    }
    
    // Default 404
    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders,
    });
  },
};

/**
 * Handle WebSocket upgrade requests
 */
async function handleWebSocket(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Validate origin
  const origin = request.headers.get('Origin');
  if (!isOriginAllowed(origin, env)) {
    return new Response('Forbidden: Origin not allowed', {
      status: 403,
      headers: corsHeaders,
    });
  }
  
  // Check for WebSocket upgrade
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', {
      status: 426,
      headers: corsHeaders,
    });
  }
  
  // Create or get Durable Object
  // Use a random ID for each connection
  const id = env.CHAT_SESSION.idFromName(crypto.randomUUID());
  const stub = env.CHAT_SESSION.get(id);
  
  // Forward request to Durable Object
  return stub.fetch(request);
}

/**
 * Handle relay messages from Discord bot
 */
async function handleRelayMessage(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.BOT_RELAY_SECRET}`) {
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders,
      });
    }
    
    // Parse message
    const message: RelayMessage = await request.json();
    
    if (!message.threadId || !message.message || !message.author) {
      return new Response('Invalid message format', {
        status: 400,
        headers: corsHeaders,
      });
    }
    
    // Find the Durable Object handling this thread
    // Note: In production, you'd need a way to map threadId to Durable Object ID
    // For now, we'll broadcast to all active sessions (simplified approach)
    // A better approach would be to store threadId -> DO ID mapping in KV
    
    // For this implementation, we'll use a singleton DO for relay coordination
    const id = env.CHAT_SESSION.idFromName('relay-coordinator');
    const stub = env.CHAT_SESSION.get(id);
    
    // Call the receiveAgentMessage method
    await stub.receiveAgentMessage(
      message.threadId,
      message.message,
      message.author
    );
    
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error handling relay message:', error);
    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Get CORS headers based on request origin
 */
function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  
  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || '*';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  
  // Allow if origin is in the list or if wildcard is set
  return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
}
