import { Markup } from 'telegraf';
import { QuestionType, AIQuestion } from '../../validation/schemas';

/**
 * Create inline keyboard for MULTIPLE_CHOICE questions
 * @param question - The AI generated question
 * @param questionId - Unique ID for tracking answers
 * @returns Inline keyboard markup
 */
export function createMultipleChoiceKeyboard(question: AIQuestion, questionId: string) {
  if (!question.options || question.options.length !== 4) {
    throw new Error('MULTIPLE_CHOICE questions must have exactly 4 options');
  }

  // Create 2x2 button layout using option indices instead of full text
  const buttons = question.options.map((option, index) => [
    Markup.button.callback(option, `answer:${questionId}:${index}`),
  ]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Create inline keyboard for TRUE_FALSE questions
 * @param questionId - Unique ID for tracking answers
 * @returns Inline keyboard markup
 */
export function createTrueFalseKeyboard(questionId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ True', `answer:${questionId}:T`),
      Markup.button.callback('❌ False', `answer:${questionId}:F`),
    ],
  ]);
}

/**
 * Helper to escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format question text for display
 * @param question - The AI generated question
 * @returns Formatted question text
 */
export function formatQuestionText(question: AIQuestion): string {
  const typeEmoji = {
    [QuestionType.MULTIPLE_CHOICE]: '🔤',
    [QuestionType.TRUE_FALSE]: '✓/✗',
    [QuestionType.FILL_IN_THE_BLANK]: '✍️',
  };

  return `${typeEmoji[question.type]} <b>Unit ${question.unit} Question</b>\n\n${escapeHtml(question.question)}`;
}

/**
 * Format answer feedback with explanation
 * @param isCorrect - Whether the answer was correct
 * @param correctAnswer - The correct answer
 * @param explanation - Grammar explanation
 * @returns Formatted feedback message
 */
export function formatAnswerFeedback(
  isCorrect: boolean,
  correctAnswer: string,
  explanation: string
): string {
  const emoji = isCorrect ? '✅' : '❌';
  const status = isCorrect ? '<b>Correct!</b>' : '<b>Incorrect</b>';

  let message = `${emoji} ${status}\n\n`;

  if (!isCorrect) {
    message += `<b>Correct Answer:</b> ${escapeHtml(correctAnswer)}\n\n`;
  }

  message += `<b>Explanation:</b>\n${escapeHtml(explanation)}`;

  return message;
}
