import { Context } from 'telegraf';
import { generateQuestion } from '../../ai/generator';
import { getOrCreateUser } from '../services/user.service';
import { prisma } from '../../db/client';
import { MESSAGES } from '../config';
import {
  createMultipleChoiceKeyboard,
  createTrueFalseKeyboard,
  formatQuestionText,
} from '../keyboards/question.keyboard';
import { QuestionType } from '../../validation/schemas';

/**
 * Store active questions in memory (in production, use Redis or database)
 * Key: `userId:messageId`, Value: { questionId, correctAnswer, explanation }
 */
export const activeQuestions = new Map<
  string,
  {
    questionId: string;
    correctAnswer: string;
    explanation: string;
    unitId: number;
    userId: string;
  }
>();

/**
 * Handle /study command
 * Generate and display a question for the specified unit
 */
export async function handleStudy(ctx: Context) {
  try {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    // Get or create user
    const user = await getOrCreateUser(ctx.from);

    // Extract unit number from command
    const text = ctx.text || '';
    const match = text.match(/\/study\s+(\d+)/);

    if (!match) {
      await ctx.reply(MESSAGES.INVALID_UNIT, { parse_mode: 'Markdown' });
      return;
    }

    const unitNumber = parseInt(match[1]);

    // Validate unit number
    if (unitNumber < 1 || unitNumber > 115) {
      await ctx.reply(MESSAGES.INVALID_UNIT, { parse_mode: 'Markdown' });
      return;
    }

    // Show loading message
    const loadingMsg = await ctx.reply(MESSAGES.GENERATING_QUESTION);

    let loadingMessageDeleted = false;

    try {
      // Generate question using AI
      const aiQuestion = await generateQuestion(unitNumber);

      // Save question to database
      const savedQuestion = await prisma.question.create({
        data: {
          unitId: aiQuestion.unit,
          type: aiQuestion.type,
          question: aiQuestion.question,
          options: aiQuestion.options ?? undefined,
          correctAnswer: aiQuestion.correct_answer,
          explanation: aiQuestion.explanation,
        },
      });

      // Format question text
      const questionText = formatQuestionText(aiQuestion);

      // Delete loading message
      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
      loadingMessageDeleted = true;

      // Send question with appropriate keyboard
      let sentMessage;

      if (aiQuestion.type === QuestionType.MULTIPLE_CHOICE) {
        sentMessage = await ctx.reply(
          questionText,
          {
            parse_mode: 'HTML',
            ...createMultipleChoiceKeyboard(aiQuestion, savedQuestion.id),
          }
        );
      } else if (aiQuestion.type === QuestionType.TRUE_FALSE) {
        sentMessage = await ctx.reply(
          questionText,
          {
            parse_mode: 'HTML',
            ...createTrueFalseKeyboard(savedQuestion.id),
          }
        );
      } else if (aiQuestion.type === QuestionType.FILL_IN_THE_BLANK) {
        sentMessage = await ctx.reply(
          `${questionText}\n\n✍️ <b>Type your answer:</b>`,
          { parse_mode: 'HTML' }
        );
      }

      // Store question data for answer verification
      if (sentMessage) {
        const key = `${user.id}:${sentMessage.message_id}`;
        activeQuestions.set(key, {
            questionId: savedQuestion.id,
            correctAnswer: aiQuestion.correct_answer,
            explanation: aiQuestion.explanation,
            unitId: aiQuestion.unit,
            userId: user.id,
        });
      }
    } catch (error) {
      // Delete loading message on error only if it hasn't been deleted yet
      if (!loadingMessageDeleted) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
        } catch (e) {
          // Ignore error if message cannot be deleted
          console.warn('Could not delete loading message:', e);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in /study command:', error);
    await ctx.reply(MESSAGES.ERROR);
  }
}
