import { bot, BOT_CONFIG } from './config';
import { handleStart, handleHelp } from './handlers/start.handler';
import { handleStudy } from './handlers/study.handler';
import { handleStats } from './handlers/stats.handler';
import { handleCallbackQuery, handleTextMessage } from './handlers/answer.handler';
import { handleQuiz, handleCancelQuiz } from './handlers/quiz.handler';
import { handleSessionCallbackQuery, handleSessionTextMessage } from './handlers/session-answer.handler';
import { hasActiveSession } from './services/session.service';

/**
 * Register all bot command handlers
 */
export function registerHandlers() {
  // Command handlers
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('study', handleStudy);
  bot.command('stats', handleStats);
  bot.command('quiz', handleQuiz);
  bot.command('cancel', handleCancelQuiz);

  // Callback query handler (for inline keyboard buttons)
  // Route to session handler if user has active session
  bot.on('callback_query', async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }

    const { getOrCreateUser } = await import('./services/user.service');
    const user = await getOrCreateUser(ctx.from);

    if (hasActiveSession(user.id)) {
      return handleSessionCallbackQuery(ctx);
    } else {
      return handleCallbackQuery(ctx);
    }
  });

  // Text message handler (for fill-in-the-blank answers)
  // Route to session handler if user has active session
  bot.on('text', async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }

    const { getOrCreateUser } = await import('./services/user.service');
    const user = await getOrCreateUser(ctx.from);

    if (hasActiveSession(user.id)) {
      return handleSessionTextMessage(ctx);
    } else {
      return handleTextMessage(ctx);
    }
  });

  // Error handling
  bot.catch((err, ctx) => {
    console.error(`❌ Bot error for ${ctx.updateType}:`, err);
    ctx.reply('⚠️ An error occurred. Please try again.');
  });

  console.log('✅ Bot handlers registered');
}

/**
 * Start the bot (polling mode for development)
 */
export async function startBot() {
  try {
    registerHandlers();

    if (BOT_CONFIG.useWebhook) {
      // Webhook mode (for production)
      console.log('🔗 Starting bot in webhook mode...');
      console.log('⚠️  Webhook mode not fully implemented yet. Use polling for development.');
      console.log('💡 Set USE_WEBHOOK=false in .env to use polling mode.');
    } else {
      // Polling mode (for development)
      console.log('🤖 Starting bot in polling mode...');
      await bot.launch();
      console.log('✅ Bot is running! Send /start to begin.');
    }

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    throw error;
  }
}

/**
 * Stop the bot gracefully
 */
export async function stopBot() {
  await bot.stop();
  console.log('👋 Bot stopped');
}
