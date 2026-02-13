import { z } from 'zod';

/**
 * Question Type Enum
 */
export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  FILL_IN_THE_BLANK = 'FILL_IN_THE_BLANK',
}

/**
 * Zod Schema for AI-generated Question Response
 * This ensures the AI returns valid JSON in the expected format
 */
export const AIQuestionSchema = z.object({
  unit: z.number().int().min(1).max(115),
  type: z.nativeEnum(QuestionType),
  question: z.string().min(1),
  options: z
    .array(z.string())
    .length(4)
    .nullable()
    .refine(
      (options) => {
        // options must be null for FILL_IN_THE_BLANK, and array for MULTIPLE_CHOICE
        return options !== undefined;
      },
      { message: 'Options must be provided for MULTIPLE_CHOICE or null for FILL_IN_THE_BLANK' }
    ),
  correct_answer: z.string().min(1),
  explanation: z.string().min(1),
}).refine(
  (data) => {
    // For MULTIPLE_CHOICE, options must be an array of 4 strings
    if (data.type === QuestionType.MULTIPLE_CHOICE) {
      return Array.isArray(data.options) && data.options.length === 4;
    }
    // For TRUE_FALSE, options must be an array with ['True', 'False']
    if (data.type === QuestionType.TRUE_FALSE) {
      return (
        Array.isArray(data.options) &&
        data.options.length === 2 &&
        data.options.includes('True') &&
        data.options.includes('False')
      );
    }
    // For FILL_IN_THE_BLANK, options must be null
    if (data.type === QuestionType.FILL_IN_THE_BLANK) {
      return data.options === null;
    }
    return false;
  },
  {
    message: 'Options must match the question type requirements',
  }
);

/**
 * Schema for Quiz Attempt submission
 */
export const QuizAttemptSchema = z.object({
  userId: z.string().uuid(),
  questionId: z.string().uuid(),
  unitId: z.number().int().min(1).max(115),
  userAnswer: z.string().min(1),
  isCorrect: z.boolean(),
});

/**
 * Schema for User creation/validation
 */
export const UserSchema = z.object({
  telegramId: z.bigint(),
  username: z.string().optional(),
});

/**
 * Schema for Unit data
 */
export const UnitSchema = z.object({
  id: z.number().int().min(1).max(115),
  title: z.string().min(1),
  description: z.string().optional(),
  murphyPage: z.number().int().positive().optional(),
});

/**
 * Type exports for TypeScript
 */
export type AIQuestion = z.infer<typeof AIQuestionSchema>;
export type QuizAttempt = z.infer<typeof QuizAttemptSchema>;
export type User = z.infer<typeof UserSchema>;
export type Unit = z.infer<typeof UnitSchema>;
