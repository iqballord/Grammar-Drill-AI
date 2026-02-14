import { Context } from 'telegraf';
import { getOrCreateUser } from '../services/user.service';
import { MESSAGES } from '../config';
import {
  parseExamCommand,
  getUnitsFromHistory,
  getExamQuestions,
  createExamSession,
  hasActiveExamSession,
  getExamSession,
  deleteExamSession,
  getCurrentExamQuestion,
  isExamComplete,
  getExamStats,
} from '../services/exam.service';
import {
  createMultipleChoiceKeyboard,
  createTrueFalseKeyboard,
  formatQuestionText,
} from '../keyboards/question.keyboard';
import { QuestionType } from '../../validation/schemas';
import { prisma } from '../../db/client';

/**
 * Handle /exam command
 *
 * Usage:
 * - /exam              -> 10 questions from practiced units
 * - /exam 15           -> 15 questions from practiced units
 * - /exam 1,2,5,10    -> Questions from units 1,2,5,10
 */
export async function handleExam(ctx: Context) {
  try {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    // Get or create user
    const user = await getOrCreateUser(ctx.from);

    // Check if user already has an active exam session
    if (hasActiveExamSession(user.id)) {
      await ctx.reply(
        '⚠️ You already have an active exam session.\n\n' +
          'Please complete your current exam or use /cancel to cancel it.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Parse command
    const text = ctx.text || '';
    const parsed = parseExamCommand(text);

    if (!parsed) {
      await ctx.reply(
        '❌ Invalid command format.\n\n' +
          '**Usage:**\n' +
          '`/exam` - 10 questions from your practiced units\n' +
          '`/exam 15` - 15 questions from practiced units\n' +
          '`/exam 1,2,5,10` - Questions from specific units\n' +
          '`/exam 1,2,5,10 50` - 50 questions from specific units\n\n' +
          '**Examples:**\n' +
          '`/exam` - Quick 10-question exam\n' +
          '`/exam 20` - 20 questions (auto-selected units)\n' +
          '`/exam 1,2,3,4,5` - Units 1-5 mixed (default count)\n' +
          '`/exam 1,2,3 30` - 30 questions from units 1-3',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Determine units and question count
    let units: number[];
    let questionCount: number;

    if (parsed.mode === 'auto') {
      // Auto mode: get from user history
      questionCount = parsed.count || 10;
      const historyUnits = await getUnitsFromHistory(user.id, 5);
      units = historyUnits.slice(0, Math.min(5, Math.ceil(questionCount / 5)));
    } else {
      // Custom mode: user specified units
      units = parsed.units!;
      questionCount = parsed.count || Math.min(units.length * 10, 50); // Use custom count or default
    }

    // Validate units
    const validUnits = await prisma.unit.findMany({
      where: { id: { in: units } },
      select: { id: true, title: true },
    });

    if (validUnits.length === 0) {
      await ctx.reply('❌ No valid units found. Please check unit numbers (1-115).');
      return;
    }

    // Show loading message
    const unitTitles = validUnits.map(u => `${u.id}. ${u.title}`).join('\n');

    const loadingMsg = await ctx.reply(
      `🎓 <b>Preparing Exam</b>\n\n` +
        `<b>Units:</b>\n${unitTitles}\n\n` +
        `<b>Questions:</b> ${questionCount}\n\n` +
        `Loading questions... ⏳`,
      { parse_mode: 'HTML' }
    );

    let loadingMessageDeleted = false;

    try {
      // Get exam questions (with smart generation)
      const questions = await getExamQuestions(
        ctx,
        units,
        questionCount,
        user.id
      );

      if (questions.length === 0) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
        await ctx.reply('❌ Failed to prepare exam questions. Please try again.');
        return;
      }

      // Create exam session
      const session = createExamSession(
        user.id,
        ctx.chat!.id,
        units,
        questions
      );

      // Delete loading message
      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
      loadingMessageDeleted = true;

      // Send welcome message
      await ctx.reply(
        `🎓 <b>Exam Session Started!</b>\n\n` +
          `📚 <b>Units:</b> ${units.join(', ')}\n` +
          `📝 <b>Questions:</b> ${session.totalQuestions}\n\n` +
          `Let's begin! 🚀`,
        { parse_mode: 'HTML' }
      );

      // Send first question
      await sendExamQuestion(ctx, user.id);
    } catch (error) {
      // Delete loading message on error only if it hasn't been deleted yet
      if (!loadingMessageDeleted) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
        } catch (e) {
          console.warn('Could not delete loading message:', e);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in /exam command:', error);

    // Check if it's a rate limit error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit =
      errorMessage.includes('429') ||
      errorMessage.includes('quota') ||
      errorMessage.includes('Too Many Requests');

    if (isRateLimit) {
      await ctx.reply(
        '⏳ <b>API Quota Exceeded</b>\n\n' +
          '❌ Daily quota limit reached for AI question generation.\n\n' +
          '<b>Solutions:</b>\n' +
          '• Wait for quota to reset (resets daily)\n' +
          '• Try units that already have questions\n' +
          '• Use /quiz for single-unit practice\n\n' +
          'Please try again later.',
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(MESSAGES.ERROR);
    }
  }
}

/**
 * Send current exam question to user
 */
export async function sendExamQuestion(ctx: Context, userId: string) {
  const session = getExamSession(userId);

  if (!session) {
    await ctx.reply('❌ No active exam session found. Use /exam to start.');
    return;
  }

  const currentQ = getCurrentExamQuestion(session);

  if (!currentQ) {
    await ctx.reply('❌ No more questions in this exam.');
    return;
  }

  const { question, questionId, unitId, index } = currentQ;
  const questionNumber = index + 1;

  // Format question text with progress and unit indicator
  const progressText = `📊 <b>Question ${questionNumber} of ${session.totalQuestions}</b> (Unit ${unitId})\n\n`;
  const questionText = formatQuestionText(question);
  const fullText = progressText + questionText;

  // Send question with appropriate keyboard
  if (question.type === QuestionType.MULTIPLE_CHOICE) {
    await ctx.reply(fullText, {
      parse_mode: 'HTML',
      ...createMultipleChoiceKeyboard(question, questionId),
    });
  } else if (question.type === QuestionType.TRUE_FALSE) {
    await ctx.reply(fullText, {
      parse_mode: 'HTML',
      ...createTrueFalseKeyboard(questionId),
    });
  } else if (question.type === QuestionType.FILL_IN_THE_BLANK) {
    await ctx.reply(
      `${fullText}\n\n✍️ <b>Type your answer:</b>\n<i>Hint: Type only the word(s) that fill in the blank(s), separated by spaces</i>`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Send exam completion summary
 */
export async function sendExamSummary(ctx: Context, userId: string) {
  const session = getExamSession(userId);

  if (!session) {
    return;
  }

  const stats = getExamStats(session);
  const durationMinutes = Math.floor(stats.duration / 60000);
  const durationSeconds = Math.floor((stats.duration % 60000) / 1000);

  // Determine performance emoji
  let performanceEmoji = '📊';
  if (stats.accuracy >= 90) {
    performanceEmoji = '🏆';
  } else if (stats.accuracy >= 70) {
    performanceEmoji = '🎯';
  } else if (stats.accuracy >= 50) {
    performanceEmoji = '📈';
  }

  // Build per-unit breakdown
  const unitBreakdown = await Promise.all(
    stats.units.map(async unitId => {
      const unit = await prisma.unit.findUnique({ where: { id: unitId } });
      const unitScore = stats.scorePerUnit[unitId];
      const unitAccuracy = Math.round(
        (unitScore.correct / unitScore.total) * 100
      );

      const emoji =
        unitAccuracy >= 80 ? '✅' : unitAccuracy >= 50 ? '⚠️' : '❌';

      return `${emoji} Unit ${unitId}: ${unitScore.correct}/${unitScore.total} (${unitAccuracy}%)`;
    })
  );

  // Get recommendations
  const weakUnits = stats.units.filter(unitId => {
    const unitScore = stats.scorePerUnit[unitId];
    const unitAccuracy = (unitScore.correct / unitScore.total) * 100;
    return unitAccuracy < 70;
  });

  let recommendations = '';
  if (weakUnits.length > 0) {
    recommendations = `💡 <b>Recommended Practice:</b>\nFocus on units: ${weakUnits.join(', ')}`;
  } else {
    recommendations = `🌟 <b>Excellent!</b> All units mastered!`;
  }

  // Build summary message
  const summaryMessage = `
${performanceEmoji} <b>Exam Complete!</b>

━━━━━━━━━━━━━━━━━━━━
<b>📊 Overall Results</b>
━━━━━━━━━━━━━━━━━━━━

✅ <b>Score:</b> ${stats.score}/${stats.total}
📈 <b>Accuracy:</b> ${stats.accuracy}%
⏱ <b>Time:</b> ${durationMinutes}m ${durationSeconds}s

━━━━━━━━━━━━━━━━━━━━
<b>📚 Per Unit Breakdown</b>
━━━━━━━━━━━━━━━━━━━━

${unitBreakdown.join('\n')}

━━━━━━━━━━━━━━━━━━━━

${recommendations}

<b>🔄 Continue Learning:</b>
• /exam - Another mixed exam
• /quiz [unit] - Practice specific unit
• /study [unit] - Single question practice
  `.trim();

  await ctx.reply(summaryMessage, { parse_mode: 'HTML' });

  // Delete the session
  deleteExamSession(userId);
}

/**
 * Handle /cancel command for exam sessions
 */
export async function handleCancelExam(ctx: Context) {
  try {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const session = getExamSession(user.id);

    if (!session) {
      return; // No exam session, let quiz handler check
    }

    // Delete the exam session
    deleteExamSession(user.id);

    await ctx.reply(
      '❌ Exam session cancelled.\n\n' + 'Use /exam to start a new exam.',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /cancel for exam:', error);
    await ctx.reply(MESSAGES.ERROR);
  }
}
