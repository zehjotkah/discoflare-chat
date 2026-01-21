import { Env, TurnstileResponse } from './types';

/**
 * Validate Cloudflare Turnstile token
 */
export async function validateTurnstile(
  token: string,
  env: Env,
  ip?: string
): Promise<boolean> {
  if (!token) {
    return false;
  }
  
  try {
    const formData = new FormData();
    formData.append('secret', env.TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    
    if (ip) {
      formData.append('remoteip', ip);
    }
    
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: formData,
      }
    );
    
    const data: TurnstileResponse = await response.json();
    
    return data.success;
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return false;
  }
}

/**
 * Extract IP address from request
 */
export function getClientIP(request: Request): string | undefined {
  return request.headers.get('CF-Connecting-IP') || undefined;
}
