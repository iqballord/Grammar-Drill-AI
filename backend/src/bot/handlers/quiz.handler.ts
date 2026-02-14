import { Context } from 'telegraf';
import { getOrCreateUser } from '../services/user.service';
import { prisma } from '../../db/client';
import { MESSAGES } from '../config';
import {
  createMultipleChoiceKeyboard,
  createTrueFalseKeyboard,
  formatQuestionText,
} from '../keyboards/question.keyboard';
import { QuestionType } from '../../validation/schemas';
import {
  createSession,
  getCurrentQuestion,
  hasActiveSession,
  getSession,
  deleteSession,
} from '../services/session.service';

/**
 * Handle /quiz command
 * Usage: /quiz [unit] [total_questions]
 * Examples:
 *   /quiz 12       -> 10 questions (default)
 *   /quiz 12 5     -> 5 questions
 */
export async function handleQuiz(ctx: Context) {
  try {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    // Get or create user
    const user = await getOrCreateUser(ctx.from);

    // Check if user already has an active session
    if (hasActiveSession(user.id)) {
      await ctx.reply(
        '⚠️ You already have an active quiz session.\n\n' +
        'Please complete your current quiz or use /cancel to cancel it.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Extract unit number and question count from command
    const text = ctx.text || '';
    const match = text.match(/\/quiz\s+(\d+)(?:\s+(\d+))?/);

    if (!match) {
      await ctx.reply(
        '❌ Invalid command format.\n\n' +
        '**Usage:**\n' +
        '`/quiz [unit]` - Start 10-question quiz\n' +
        '`/quiz [unit] [count]` - Custom question count (1-20)\n\n' +
        '**Examples:**\n' +
        '`/quiz 12` - 10 questions from Unit 12\n' +
        '`/quiz 12 5` - 5 questions from Unit 12',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const unitNumber = parseInt(match[1]);
    const questionCount = match[2] ? parseInt(match[2]) : 10; // Default to 10

    // Validate unit number
    if (unitNumber < 1 || unitNumber > 115) {
      await ctx.reply(
        '❌ Invalid unit number. Please choose a unit between 1 and 115.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Validate question count
    if (questionCount < 1 || questionCount > 20) {
      await ctx.reply(
        '❌ Invalid question count. Please choose between 1 and 20 questions.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Get unit info from database
    const unit = await prisma.unit.findUnique({
      where: { id: unitNumber },
    });

    if (!unit) {
      await ctx.reply(
        `❌ Unit ${unitNumber} not found in database.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Show loading message
    const loadingMsg = await ctx.reply(
      `🤖 Preparing ${questionCount} questions for Unit ${unitNumber}...\n` +
      `📚 **${unit.title}**\n\n` +
      `Loading...`,
      { parse_mode: 'Markdown' }
    );

    let loadingMessageDeleted = false;

    try {
      // Use smart pooling: get from database or generate if needed
      const { getQuizQuestions } = await import('../services/question.service');
      const savedQuestions = await getQuizQuestions(unitNumber, questionCount, user.id);

      // Create quiz session
      const session = createSession(
        user.id,
        ctx.chat!.id,
        unitNumber,
        savedQuestions
      );

      // Delete loading message
      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
      loadingMessageDeleted = true;

      // Send welcome message
      await ctx.reply(
        `🎯 **Quiz Session Started!**\n\n` +
        `📚 Unit ${unitNumber}: ${unit.title}\n` +
        `📝 ${questionCount} questions\n\n` +
        `Let's begin! 🚀`,
        { parse_mode: 'Markdown' }
      );

      // Send first question
      await sendQuestion(ctx, user.id);

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
    console.error('Error in /quiz command:', error);

    // Check if it's a rate limit error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests');

    if (isRateLimit) {
      await ctx.reply(
        '⏳ <b>API Quota Exceeded</b>\n\n' +
        '❌ Daily quota limit reached for AI question generation.\n\n' +
        '<b>Solutions:</b>\n' +
        '• Wait for quota to reset (resets daily)\n' +
        '• Upgrade to paid plan at Google AI Studio\n' +
        '• Contact admin to increase quota\n\n' +
        'Please try again later.',
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(
        '❌ Failed to generate quiz questions. Please try again later.\n\n' +
        'If the problem persists, try a different unit or fewer questions.',
        { parse_mode: 'Markdown' }
      );
    }
  }
}

/**
 * Send current question from session to user
 * @param ctx - Telegram context
 * @param userId - User's database ID
 */
export async function sendQuestion(ctx: Context, userId: string) {
  const session = getSession(userId);
  if (!session) {
    await ctx.reply('❌ No active quiz session found. Use /quiz [unit] to start a new quiz.');
    return;
  }

  const currentQ = getCurrentQuestion(session);
  if (!currentQ) {
    await ctx.reply('❌ No more questions in this session.');
    return;
  }

  const { question, questionId, index } = currentQ;
  const questionNumber = index + 1;

  // Format question text with progress indicator
  const progressText = `📊 **Question ${questionNumber} of ${session.totalQuestions}**\n\n`;
  const questionText = formatQuestionText(question);
  const fullText = progressText + questionText;

  // Send question with appropriate keyboard
  let sentMessage;

  if (question.type === QuestionType.MULTIPLE_CHOICE) {
    sentMessage = await ctx.reply(
      fullText,
      {
        parse_mode: 'HTML',
        ...createMultipleChoiceKeyboard(question, questionId),
      }
    );
  } else if (question.type === QuestionType.TRUE_FALSE) {
    sentMessage = await ctx.reply(
      fullText,
      {
        parse_mode: 'HTML',
        ...createTrueFalseKeyboard(questionId),
      }
    );
  } else if (question.type === QuestionType.FILL_IN_THE_BLANK) {
    sentMessage = await ctx.reply(
      `${fullText}\n\n✍️ <b>Type your answer:</b>\n<i>Hint: Type only the word(s) that fill in the blank(s), separated by spaces</i>`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Handle /cancel command to cancel active quiz session
 */
export async function handleCancelQuiz(ctx: Context) {
  try {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const session = getSession(user.id);

    if (!session) {
      await ctx.reply('ℹ️ You don\'t have an active quiz session.');
      return;
    }

    // Delete the session
    deleteSession(user.id);

    await ctx.reply(
      '❌ Quiz session cancelled.\n\n' +
      'Use /quiz [unit] to start a new quiz.',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /cancel command:', error);
    await ctx.reply(MESSAGES.ERROR);
  }
}
