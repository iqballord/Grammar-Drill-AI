import { Context, MiddlewareFn } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Bot access control middleware
 * Only allows whitelisted Telegram user IDs to use the bot
 *
 * Setup:
 * 1. Add ALLOWED_TELEGRAM_IDS="123456789,987654321" to .env
 * 2. Get your Telegram ID by sending /start (check console logs)
 */
export const whitelistMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  // Get allowed IDs from environment
  const allowedIdsStr = process.env.ALLOWED_TELEGRAM_IDS || '';

  // If no whitelist configured, allow all (development mode)
  if (!allowedIdsStr || allowedIdsStr.trim() === '') {
    console.warn('⚠️  WARNING: No ALLOWED_TELEGRAM_IDS configured. Bot is accessible to everyone!');
    return next();
  }

  // Parse allowed IDs
  const allowedIds = allowedIdsStr
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

  // Check if user is authenticated
  if (!ctx.from) {
    await ctx.reply('❌ Unable to identify user.');
    return;
  }

  const userId = ctx.from.id.toString();
  const username = ctx.from.username || 'Unknown';

  // Check if user is whitelisted
  if (!allowedIds.includes(userId)) {
    console.warn(`🚫 Access denied for user ${userId} (@${username})`);

    await ctx.reply(
      '🔒 <b>Access Denied</b>\n\n' +
      '❌ This bot is in testing mode and only accessible to authorized users.\n\n' +
      `Your Telegram ID: <code>${userId}</code>\n\n` +
      'Please contact the bot administrator for access.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // User is whitelisted, continue
  console.log(`✅ Access granted for user ${userId} (@${username})`);
  return next();
};

/**
 * Get allowed Telegram IDs from environment
 * @returns Array of allowed Telegram user IDs
 */
export function getAllowedTelegramIds(): string[] {
  const allowedIdsStr = process.env.ALLOWED_TELEGRAM_IDS || '';

  if (!allowedIdsStr || allowedIdsStr.trim() === '') {
    return [];
  }

  return allowedIdsStr
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

/**
 * Check if whitelist is configured
 * @returns True if whitelist is configured
 */
export function isWhitelistEnabled(): boolean {
  const allowedIds = getAllowedTelegramIds();
  return allowedIds.length > 0;
}
