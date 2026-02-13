import { Context } from 'telegraf';
import { getOrCreateUser } from '../services/user.service';
import { MESSAGES } from '../config';

/**
 * Handle /start command
 * Welcomes the user and shows available commands
 */
export async function handleStart(ctx: Context) {
  try {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    // Get or create user in database
    await getOrCreateUser(ctx.from);

    // Send welcome message
    await ctx.reply(MESSAGES.WELCOME, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in /start command:', error);
    await ctx.reply(MESSAGES.ERROR);
  }
}

/**
 * Handle /help command
 * Shows help information
 */
export async function handleHelp(ctx: Context) {
  try {
    await ctx.reply(MESSAGES.HELP, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in /help command:', error);
    await ctx.reply(MESSAGES.ERROR);
  }
}
