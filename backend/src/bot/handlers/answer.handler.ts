import { Context } from 'telegraf';
import { CallbackQuery, Message } from 'telegraf/types';
import { activeQuestions } from './study.handler';
import { saveQuizAttempt } from '../services/user.service';
import { formatAnswerFeedback } from '../keyboards/question.keyboard';
import { MESSAGES } from '../config';

/**
 * Handle inline keyboard button clicks (MULTIPLE_CHOICE and TRUE_FALSE)
 */
export async function handleCallbackQuery(ctx: Context) {
  try {
    const callbackQuery = ctx.callbackQuery as CallbackQuery.DataQuery;
    const data = callbackQuery.data;

    if (!data.startsWith('answer:')) {
      return;
    }

    // Parse callback data: "answer:questionId:userAnswer"
    const [, questionId, userAnswer] = data.split(':');

    // Find question data
    let questionData;
    for (const [key, value] of activeQuestions.entries()) {
      if (value.questionId === questionId) {
        questionData = value;
        activeQuestions.delete(key); // Remove after use
        break;
      }
    }

    if (!questionData) {
      await ctx.answerCbQuery('⚠️ This question has expired. Please request a new one.');
      return;
    }

    // Check answer
    const isCorrect =
      userAnswer.trim().toLowerCase() === questionData.correctAnswer.trim().toLowerCase();

    // Save quiz attempt
    await saveQuizAttempt({
      userId: questionData.userId,
      questionId: questionData.questionId,
      unitId: questionData.unitId,
      userAnswer,
      isCorrect,
    });

    // Format feedback message
    const feedback = formatAnswerFeedback(
      isCorrect,
      questionData.correctAnswer,
      questionData.explanation
    );

    // Answer callback query (removes loading state)
    await ctx.answerCbQuery(isCorrect ? '✅ Correct!' : '❌ Incorrect');

    // Send feedback
    await ctx.reply(feedback, { parse_mode: 'HTML' });

    // Suggest next action
    await ctx.reply('Ready for another question? Use /study [unit_number]', {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Error handling callback query:', error);
    await ctx.answerCbQuery('❌ An error occurred');
  }
}

/**
 * Handle text messages (FILL_IN_THE_BLANK answers)
 */
export async function handleTextMessage(ctx: Context) {
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

    // Try to find active question for this user
    let questionData;
    let questionKey;

    for (const [key, value] of activeQuestions.entries()) {
      if (key.startsWith(value.userId)) {
        questionData = value;
        questionKey = key;
        break;
      }
    }

    if (!questionData || !questionKey) {
      // No active question, ignore the message
      return;
    }

    // Check answer (case-insensitive)
    const userAnswer = text.trim();
    const isCorrect =
      userAnswer.toLowerCase() === questionData.correctAnswer.trim().toLowerCase();

    // Save quiz attempt
    await saveQuizAttempt({
      userId: questionData.userId,
      questionId: questionData.questionId,
      unitId: questionData.unitId,
      userAnswer,
      isCorrect,
    });

    // Remove question from active questions
    activeQuestions.delete(questionKey);

    // Format feedback message
    const feedback = formatAnswerFeedback(
      isCorrect,
      questionData.correctAnswer,
      questionData.explanation
    );

    // Send feedback
    await ctx.reply(feedback, { parse_mode: 'HTML' });

    // Suggest next action
    await ctx.reply('Ready for another question? Use /study [unit_number]', {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Error handling text message:', error);
    await ctx.reply(MESSAGES.ERROR);
  }
}
