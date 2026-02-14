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
/quiz [unit] - Start a quiz session (single unit)
/exam - Mixed units exam (NEW! 🎓)
/study [unit] - Practice single questions
/stats - View your learning statistics
/help - Get help

💡 **Quick Start:**
• \`/quiz 5\` - 10-question quiz on Unit 5
• \`/quiz 5 15\` - 15-question quiz on Unit 5
• \`/exam 1,2,3\` - Mixed exam from units 1, 2, 3
• \`/exam 1,2,3 50\` - 50 questions from units 1-3
• \`/study 5\` - Practice one question at a time

Let's improve your English together! 🚀`,

  HELP: `📖 **How to Use Grammar Learning Bot**

**Commands:**
• \`/quiz [unit] [count]\` - Start a quiz session (single unit)
  Examples:
  • \`/quiz 12\` - 10 questions from Unit 12
  • \`/quiz 12 5\` - 5 questions from Unit 12
  • \`/quiz 12 15\` - 15 questions from Unit 12

• \`/exam [units] [count]\` - Mixed units exam session (NEW! 🎓)
  Examples:
  • \`/exam\` - 10 questions from your practiced units
  • \`/exam 15\` - 15 questions (auto-selected)
  • \`/exam 1,2,5,10\` - Questions from units 1, 2, 5, 10
  • \`/exam 1,2,3 50\` - 50 questions from units 1, 2, 3
  Features: Multi-unit mixing, per-unit score breakdown

• \`/study [unit]\` - Practice single questions
  Example: \`/study 12\` for Unit 12

• \`/cancel\` - Cancel active quiz/exam session

• \`/stats\` - View your progress and accuracy

• \`/help\` - Show this help message

**Question Types:**
1. **Multiple Choice** - Select the correct answer from 4 options
2. **True/False** - Choose True or False
3. **Fill in the Blank** - Type your answer

**Quiz Mode Features:**
✨ Multiple questions in one session (1-20 questions)
📊 Progress tracking (Question X of Y)
🎯 Auto-advance to next question
📈 Session summary with score and accuracy
💾 All answers saved for analytics

**Exam Mode Features:**
🎓 Mix questions from multiple units
📊 Per-unit score breakdown
📈 Identify weak areas across units
💡 Smart recommendations based on performance
🔄 Auto-select from your practice history

**Units Available:** 1-115 covering all essential grammar topics

Good luck with your learning! 📝`,

  INVALID_UNIT: '❌ Please provide a valid unit number between 1 and 115.\n\nExample: `/study 5`',

  GENERATING_QUESTION: '⏳ Generating your question...',

  ERROR: '❌ Something went wrong. Please try again later.',

  CORRECT: '✅ **Correct!**',

  INCORRECT: '❌ **Incorrect**',
};
