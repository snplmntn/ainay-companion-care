// ============================================
// Telegram Integration Service
// ============================================
// Client-side service for managing Telegram notifications

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Get Telegram bot status
 */
export async function getTelegramStatus(): Promise<{
  configured: boolean;
  telegram: {
    configured: boolean;
    polling: boolean;
    botUsername: string;
  };
}> {
  const response = await fetch(`${API_BASE_URL}/api/telegram/status`);
  return response.json();
}

/**
 * Generate a link code for connecting Telegram
 */
export async function generateTelegramLinkCode(userId: string): Promise<{
  success: boolean;
  code?: string;
  deepLink?: string;
  expiresAt?: string;
  expiresInMinutes?: number;
  error?: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/telegram/link-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });
  return response.json();
}

/**
 * Check if user has Telegram linked
 */
export async function checkTelegramLinked(userId: string): Promise<{
  linked: boolean;
  username?: string;
  linkedAt?: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/telegram/check/${userId}`);
  return response.json();
}

/**
 * Unlink Telegram from user account
 */
export async function unlinkTelegram(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/telegram/unlink`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });
  return response.json();
}

/**
 * Send a test Telegram notification
 */
export async function sendTestTelegramNotification(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/telegram/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });
  return response.json();
}


