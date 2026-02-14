import { Context } from 'telegraf';
import { CallbackQuery, Message } from 'telegraf/types';
import { saveQuizAttempt } from '../services/user.service';
import { formatAnswerFeedback } from '../keyboards/question.keyboard';
import { MESSAGES } from '../config';
import {
  getSession,
  updateSession,
  isSessionComplete,
  getSessionStats,
  deleteSession,
} from '../services/session.service';
import {
  getExamSession,
  updateExamSession,
  isExamComplete,
  hasActiveExamSession,
} from '../services/exam.service';
import { sendQuestion } from './quiz.handler';
import { sendExamQuestion, sendExamSummary } from './exam.handler';

/**
 * Handle inline keyboard button clicks for quiz sessions (MULTIPLE_CHOICE and TRUE_FALSE)
 */
export async function handleSessionCallbackQuery(ctx: Context) {
  try {
    const callbackQuery = ctx.callbackQuery as CallbackQuery.DataQuery;
    const data = callbackQuery.data;

    if (!data.startsWith('answer:')) {
      return;
    }

    if (!ctx.from) {
      await ctx.answerCbQuery('❌ Unable to identify user');
      return;
    }

    // Parse callback data: "answer:questionId:answerCode"
    const [, questionId, answerCode] = data.split(':');

    // Get user from database
    const { getOrCreateUser } = await import('../services/user.service');
    const user = await getOrCreateUser(ctx.from);

    // Check for exam session first, then quiz session
    const examSession = getExamSession(user.id);
    const quizSession = getSession(user.id);

    if (examSession) {
      // Handle exam session
      return handleExamAnswer(ctx, user.id, questionId, answerCode);
    }

    if (!quizSession) {
      await ctx.answerCbQuery('⚠️ No active quiz session. Use /quiz [unit] to start.');
      return;
    }

    // Get current question from session
    const currentQ = quizSession.questions[quizSession.currentIndex];

    if (!currentQ || currentQ.questionId !== questionId) {
      await ctx.answerCbQuery('⚠️ This question is not current. Please answer the latest question.');
      return;
    }

    const question = currentQ.question;

    // Resolve answer code to actual answer text
    let userAnswer: string;
    if (answerCode === 'T') {
      userAnswer = 'True';
    } else if (answerCode === 'F') {
      userAnswer = 'False';
    } else {
      // Multiple choice - answerCode is an index
      const optionIndex = parseInt(answerCode);
      if (!question.options || isNaN(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
        await ctx.answerCbQuery('⚠️ Invalid answer option');
        return;
      }
      userAnswer = question.options[optionIndex];
    }

    // Check answer (case-insensitive)
    const isCorrect =
      userAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();

    // Save quiz attempt to database
    await saveQuizAttempt({
      userId: user.id,
      questionId: currentQ.questionId,
      unitId: quizSession.unitId,
      userAnswer,
      isCorrect,
    });

    // Update session (increment index, update score)
    updateSession(user.id, isCorrect);

    // Format feedback message
    const feedback = formatAnswerFeedback(
      isCorrect,
      question.correct_answer,
      question.explanation
    );

    // Answer callback query (removes loading state)
    await ctx.answerCbQuery(isCorrect ? '✅ Correct!' : '❌ Incorrect');

    // Send feedback
    await ctx.reply(feedback, { parse_mode: 'HTML' });

    // Check if session is complete
    if (isSessionComplete(quizSession)) {
      await sendSessionSummary(ctx, user.id);
    } else {
      // Send next question automatically
      await sendQuestion(ctx, user.id);
    }
  } catch (error) {
    console.error('Error handling session callback query:', error);
    await ctx.answerCbQuery('❌ An error occurred');
  }
}

/**
 * Handle text messages for quiz sessions (FILL_IN_THE_BLANK answers)
 */
export async function handleSessionTextMessage(ctx: Context) {
  try {
    const message = ctx.message as Message.TextMessage;
    const text = message.text;

    // Ignore commands
    if (text.startsWith('/')) {
      return;
    }

    if (!ctx.from) {
      return;
    }

    // Get user from database
    const { getOrCreateUser } = await import('../services/user.service');
    const user = await getOrCreateUser(ctx.from);

    // Check for exam session first, then quiz session
    const examSession = getExamSession(user.id);
    const quizSession = getSession(user.id);

    if (examSession) {
      // Handle exam session
      return handleExamTextAnswer(ctx, user.id, text);
    }

    if (!quizSession) {
      // No active session, ignore the message
      return;
    }

    // Get current question from session
    const currentQ = quizSession.questions[quizSession.currentIndex];

    if (!currentQ) {
      return;
    }

    const question = currentQ.question;

    // Only process if it's a FILL_IN_THE_BLANK question
    if (question.type !== 'FILL_IN_THE_BLANK') {
      return;
    }

    // Check answer (case-insensitive)
    const userAnswer = text.trim();
    const isCorrect =
      userAnswer.toLowerCase() === question.correct_answer.trim().toLowerCase();

    // Save quiz attempt to database
    await saveQuizAttempt({
      userId: user.id,
      questionId: currentQ.questionId,
      unitId: quizSession.unitId,
      userAnswer,
      isCorrect,
    });

    // Update session (increment index, update score)
    updateSession(user.id, isCorrect);

    // Format feedback message
    const feedback = formatAnswerFeedback(
      isCorrect,
      question.correct_answer,
      question.explanation
    );

    // Send feedback
    await ctx.reply(feedback, { parse_mode: 'HTML' });

    // Check if session is complete
    if (isSessionComplete(quizSession)) {
      await sendSessionSummary(ctx, user.id);
    } else {
      // Send next question automatically
      await sendQuestion(ctx, user.id);
    }
  } catch (error) {
    console.error('Error handling session text message:', error);
    await ctx.reply(MESSAGES.ERROR);
  }
}

/**
 * Send session completion summary to user
 * @param ctx - Telegram context
 * @param userId - User's database ID
 */
async function sendSessionSummary(ctx: Context, userId: string) {
  const session = getSession(userId);

  if (!session) {
    return;
  }

  const stats = getSessionStats(session);
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
  } else {
    performanceEmoji = '📝';
  }

  // Build summary message
  const summaryMessage = `
${performanceEmoji} <b>Quiz Session Complete!</b>

━━━━━━━━━━━━━━━━━━━━
<b>📊 Your Results</b>
━━━━━━━━━━━━━━━━━━━━

✅ <b>Score:</b> ${stats.score}/${stats.total}
📈 <b>Accuracy:</b> ${stats.accuracy}%
⏱ <b>Time:</b> ${durationMinutes}m ${durationSeconds}s

━━━━━━━━━━━━━━━━━━━━

${getPerformanceMessage(stats.accuracy)}

<b>📊 View Detailed Analytics</b>
Check your dashboard for:
• Progress tracking across all units
• Error bank for review
• Learning trends and insights

<b>🔄 Continue Learning</b>
• /quiz [unit] - Start another quiz
• /study [unit] - Practice single questions
• /stats - View your overall stats
  `.trim();

  await ctx.reply(summaryMessage, { parse_mode: 'HTML' });

  // Delete the session
  deleteSession(userId);
}

/**
 * Get motivational message based on accuracy
 * @param accuracy - Accuracy percentage
 * @returns Motivational message
 */
function getPerformanceMessage(accuracy: number): string {
  if (accuracy >= 90) {
    return '🌟 <b>Excellent work!</b> You\'ve mastered this unit!';
  } else if (accuracy >= 70) {
    return '👍 <b>Great job!</b> You\'re making solid progress!';
  } else if (accuracy >= 50) {
    return '📚 <b>Good effort!</b> Review the explanations and try again.';
  } else {
    return '💪 <b>Keep practicing!</b> Every mistake is a learning opportunity.';
  }
}

/**
 * Handle exam answer (callback query)
 */
async function handleExamAnswer(
  ctx: Context,
  userId: string,
  questionId: string,
  answerCode: string
) {
  const session = getExamSession(userId);

  if (!session) {
    await ctx.answerCbQuery('⚠️ No active exam session.');
    return;
  }

  // Get current question from session
  const currentQ = session.questions[session.currentIndex];

  if (!currentQ || currentQ.questionId !== questionId) {
    await ctx.answerCbQuery('⚠️ This question is not current. Please answer the latest question.');
    return;
  }

  const question = currentQ.question;

  // Resolve answer code to actual answer text
  let userAnswer: string;
  if (answerCode === 'T') {
    userAnswer = 'True';
  } else if (answerCode === 'F') {
    userAnswer = 'False';
  } else {
    // Multiple choice - answerCode is an index
    const optionIndex = parseInt(answerCode);
    if (!question.options || isNaN(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
      await ctx.answerCbQuery('⚠️ Invalid answer option');
      return;
    }
    userAnswer = question.options[optionIndex];
  }

  // Check answer (case-insensitive)
  const isCorrect =
    userAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();

  // Save quiz attempt to database
  await saveQuizAttempt({
    userId,
    questionId: currentQ.questionId,
    unitId: currentQ.unitId,
    userAnswer,
    isCorrect,
  });

  // Update exam session
  updateExamSession(userId, isCorrect);

  // Format feedback message
  const feedback = formatAnswerFeedback(
    isCorrect,
    question.correct_answer,
    question.explanation
  );

  // Answer callback query (removes loading state)
  await ctx.answerCbQuery(isCorrect ? '✅ Correct!' : '❌ Incorrect');

  // Send feedback
  await ctx.reply(feedback, { parse_mode: 'HTML' });

  // Check if exam is complete
  if (isExamComplete(session)) {
    await sendExamSummary(ctx, userId);
  } else {
    // Send next question automatically
    await sendExamQuestion(ctx, userId);
  }
}

/**
 * Handle exam text answer (FILL_IN_THE_BLANK)
 */
async function handleExamTextAnswer(
  ctx: Context,
  userId: string,
  text: string
) {
  const session = getExamSession(userId);

  if (!session) {
    return;
  }

  // Get current question from session
  const currentQ = session.questions[session.currentIndex];

  if (!currentQ) {
    return;
  }

  const question = currentQ.question;

  // Only process if it's a FILL_IN_THE_BLANK question
  if (question.type !== 'FILL_IN_THE_BLANK') {
    return;
  }

  // Check answer (case-insensitive)
  const userAnswer = text.trim();
  const isCorrect =
    userAnswer.toLowerCase() === question.correct_answer.trim().toLowerCase();

  // Save quiz attempt to database
  await saveQuizAttempt({
    userId,
    questionId: currentQ.questionId,
    unitId: currentQ.unitId,
    userAnswer,
    isCorrect,
  });

  // Update exam session
  updateExamSession(userId, isCorrect);

  // Format feedback message
  const feedback = formatAnswerFeedback(
    isCorrect,
    question.correct_answer,
    question.explanation
  );

  // Send feedback
  await ctx.reply(feedback, { parse_mode: 'HTML' });

  // Check if exam is complete
  if (isExamComplete(session)) {
    await sendExamSummary(ctx, userId);
  } else {
    // Send next question automatically
    await sendExamQuestion(ctx, userId);
  }
}
