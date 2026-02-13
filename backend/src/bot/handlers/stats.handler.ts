import { Context } from 'telegraf';
import { getUserStats, getOrCreateUser } from '../services/user.service';
import { MESSAGES } from '../config';

/**
 * Handle /stats command
 * Show user statistics and progress
 */
export async function handleStats(ctx: Context) {
  try {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    // Get or create user
    const user = await getOrCreateUser(ctx.from);

    // Get user statistics
    const stats = await getUserStats(user.id);

    // Format statistics message
    const message = `📊 **Your Learning Statistics**

**Total Questions Answered:** ${stats.totalQuestions}
**Correct Answers:** ${stats.correctAnswers} ✅
**Incorrect Answers:** ${stats.incorrectAnswers} ❌
**Accuracy Rate:** ${stats.accuracy}%

**Daily Streak:** ${stats.dailyStreak} day${stats.dailyStreak !== 1 ? 's' : ''} 🔥
**Units Practiced:** ${stats.unitsPracticed} / 115

Keep up the great work! 💪`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in /stats command:', error);
    await ctx.reply(MESSAGES.ERROR);
  }
}
