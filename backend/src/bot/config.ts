import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in .env file');
}

/**
 * Telegraf Bot Instance
 */
export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Bot Configuration
 */
export const BOT_CONFIG = {
  useWebhook: process.env.USE_WEBHOOK === 'true',
  webhookDomain: process.env.WEBHOOK_URL || '',
  port: parseInt(process.env.PORT || '3000'),
  commandTimeout: 30000, // 30 seconds
  maxRetries: 3,
};

/**
 * Welcome message constants
 */
export const MESSAGES = {
  WELCOME: `👋 Welcome to **Grammar Learning Bot**!

I'll help you master English grammar based on Raymond Murphy's "Essential Grammar in Use 4th Edition".

📚 **Available Commands:**
/start - Show this welcome message
/study [unit] - Practice a specific unit (1-115)
/stats - View your learning statistics
/help - Get help

💡 **How to use:**
Simply type \`/study 5\` to practice Unit 5, and I'll generate a question for you!

Let's improve your English together! 🚀`,

  HELP: `📖 **How to Use Grammar Learning Bot**

**Commands:**
• \`/study [unit_number]\` - Practice a specific unit
  Example: \`/study 12\` for Unit 12

• \`/stats\` - View your progress and accuracy

• \`/help\` - Show this help message

**Question Types:**
1. **Multiple Choice** - Select the correct answer from 4 options
2. **True/False** - Choose True or False
3. **Fill in the Blank** - Type your answer

**Units Available:** 1-115 covering all essential grammar topics

Good luck with your learning! 📝`,

  INVALID_UNIT: '❌ Please provide a valid unit number between 1 and 115.\n\nExample: `/study 5`',

  GENERATING_QUESTION: '⏳ Generating your question...',

  ERROR: '❌ Something went wrong. Please try again later.',

  CORRECT: '✅ **Correct!**',

  INCORRECT: '❌ **Incorrect**',
};
