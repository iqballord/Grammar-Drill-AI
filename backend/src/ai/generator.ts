import { geminiModel, MURPHY_SYSTEM_PROMPT } from './config';
import { AIQuestionSchema, BulkAIQuestionsSchema, QuestionType, type AIQuestion, type BulkAIQuestions } from '../validation/schemas';
import { ZodError } from 'zod';
import { prisma } from '../db/client';

/**
 * Error thrown when AI fails to generate a valid question
 */
export class QuestionGenerationError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'QuestionGenerationError';
  }
}

/**
 * Generate a grammar question for a specific unit using AI
 * @param unitNumber - Unit number (1-115) from Murphy's Grammar book
 * @param questionType - Optional specific question type to generate
 * @returns Validated AI-generated question
 * @throws QuestionGenerationError if generation or validation fails
 */
export async function generateQuestion(
  unitNumber: number,
  questionType?: QuestionType
): Promise<AIQuestion> {
  try {
    // Validate unit number
    if (unitNumber < 1 || unitNumber > 115) {
      throw new QuestionGenerationError(
        `Unit number must be between 1 and 115, received: ${unitNumber}`
      );
    }

    // Fetch unit info from database for better context
    const unit = await prisma.unit.findUnique({
      where: { id: unitNumber },
    });

    if (!unit) {
      throw new QuestionGenerationError(
        `Unit ${unitNumber} not found in database`
      );
    }

    // Build user prompt with unit topic for better accuracy
    const unitContext = unit.description
      ? `Unit ${unitNumber}: ${unit.title} - ${unit.description}`
      : `Unit ${unitNumber}: ${unit.title}`;

    const userPrompt = questionType
      ? `Generate a ${questionType} question for ${unitContext} of "Essential Grammar in Use".`
      : `Generate a question for ${unitContext} of "Essential Grammar in Use". You can choose any question type (MULTIPLE_CHOICE, TRUE_FALSE, or FILL_IN_THE_BLANK).`;

    // Combine system prompt and user prompt for Gemini
    const fullPrompt = `${MURPHY_SYSTEM_PROMPT}\n\n${userPrompt}\n\nRespond with valid JSON only.`;

    // Call Gemini API
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    });

    // Extract response content
    const response = await result.response;
    let content = response.text();

    if (!content) {
      throw new QuestionGenerationError('AI returned empty response');
    }

    // Clean up markdown code blocks if present (Gemini sometimes wraps JSON in ```json ```)
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // Parse JSON
    let parsedQuestion: unknown;
    try {
      parsedQuestion = JSON.parse(content);
    } catch (parseError) {
      throw new QuestionGenerationError(
        'Failed to parse AI response as JSON',
        parseError
      );
    }

    // Validate with Zod schema
    try {
      const validatedQuestion = AIQuestionSchema.parse(parsedQuestion);

      // Additional validation: ensure unit matches request
      if (validatedQuestion.unit !== unitNumber) {
        console.warn(
          `AI generated question for unit ${validatedQuestion.unit} instead of ${unitNumber}`
        );
      }

      return validatedQuestion;
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const errorMessages = (validationError as ZodError).issues
          .map((err: any) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        throw new QuestionGenerationError(
          `AI response validation failed: ${errorMessages}`,
          validationError
        );
      }
      throw validationError;
    }
  } catch (error) {
    if (error instanceof QuestionGenerationError) {
      throw error;
    }

    // Handle Gemini API errors
    throw new QuestionGenerationError(
      'Failed to generate question from AI',
      error
    );
  }
}

/**
 * Generate multiple questions for a unit in a SINGLE API call (optimized for quiz sessions)
 * @param unitNumber - Unit number (1-115)
 * @param count - Number of questions to generate (default: 10)
 * @returns Array of validated questions
 * @throws QuestionGenerationError if generation or validation fails
 */
export async function generateBulkQuestions(
  unitNumber: number,
  count: number = 10
): Promise<BulkAIQuestions> {
  try {
    // Validate unit number
    if (unitNumber < 1 || unitNumber > 115) {
      throw new QuestionGenerationError(
        `Unit number must be between 1 and 115, received: ${unitNumber}`
      );
    }

    // Validate count
    if (count < 1 || count > 20) {
      throw new QuestionGenerationError(
        `Question count must be between 1 and 20, received: ${count}`
      );
    }

    // Fetch unit info from database for better context
    const unit = await prisma.unit.findUnique({
      where: { id: unitNumber },
    });

    if (!unit) {
      throw new QuestionGenerationError(
        `Unit ${unitNumber} not found in database`
      );
    }

    // Build user prompt with unit topic for better accuracy
    const unitContext = unit.description
      ? `Unit ${unitNumber}: ${unit.title} - ${unit.description}`
      : `Unit ${unitNumber}: ${unit.title}`;

    // Build user prompt for bulk generation
    const userPrompt = `Generate exactly ${count} unique grammar questions for ${unitContext} of "Essential Grammar in Use".

Requirements:
- Return a JSON array of exactly ${count} questions
- Mix question types: MULTIPLE_CHOICE, TRUE_FALSE, and FILL_IN_THE_BLANK
- Each question must be unique and test different aspects of the grammar topic
- All questions MUST focus specifically on "${unit.title}" (Unit ${unitNumber})
- Ensure variety in difficulty and question structure
- Questions should reflect Murphy's teaching approach for this specific unit

Return ONLY a valid JSON array with no additional text.`;

    // Combine system prompt and user prompt for Gemini
    const fullPrompt = `${MURPHY_SYSTEM_PROMPT}\n\n${userPrompt}`;

    // Call Gemini API with higher token limit for bulk generation
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000, // Increased for bulk generation
      },
    });

    // Extract response content
    const response = await result.response;
    let content = response.text();

    if (!content) {
      throw new QuestionGenerationError('AI returned empty response');
    }

    // Clean up markdown code blocks if present
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // Parse JSON
    let parsedQuestions: unknown;
    try {
      parsedQuestions = JSON.parse(content);
    } catch (parseError) {
      throw new QuestionGenerationError(
        'Failed to parse AI response as JSON',
        parseError
      );
    }

    // Validate with Zod schema
    try {
      const validatedQuestions = BulkAIQuestionsSchema.parse(parsedQuestions);

      // Verify we got the requested number of questions
      if (validatedQuestions.length !== count) {
        console.warn(
          `AI generated ${validatedQuestions.length} questions instead of ${count}`
        );
      }

      // Verify all questions are for the correct unit
      for (const question of validatedQuestions) {
        if (question.unit !== unitNumber) {
          console.warn(
            `Question has unit ${question.unit} instead of ${unitNumber}`
          );
        }
      }

      return validatedQuestions;
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const errorMessages = (validationError as ZodError).issues
          .map((err: any) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        throw new QuestionGenerationError(
          `AI response validation failed: ${errorMessages}`,
          validationError
        );
      }
      throw validationError;
    }
  } catch (error) {
    if (error instanceof QuestionGenerationError) {
      throw error;
    }

    // Handle Gemini API errors
    throw new QuestionGenerationError(
      'Failed to generate bulk questions from AI',
      error
    );
  }
}

/**
 * Generate multiple questions for a unit (useful for batch generation)
 * @deprecated Use generateBulkQuestions instead for better performance
 * @param unitNumber - Unit number (1-115)
 * @param count - Number of questions to generate
 * @returns Array of validated questions
 */
export async function generateMultipleQuestions(
  unitNumber: number,
  count: number = 3
): Promise<AIQuestion[]> {
  const questions: AIQuestion[] = [];
  const errors: Error[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const question = await generateQuestion(unitNumber);
      questions.push(question);
    } catch (error) {
      errors.push(error as Error);
      console.error(`Failed to generate question ${i + 1}:`, error);
    }
  }

  if (questions.length === 0) {
    throw new QuestionGenerationError(
      `Failed to generate any questions. Errors: ${errors.map(e => e.message).join('; ')}`
    );
  }

  return questions;
}

/**
 * Test function to verify AI generation works
 * @param unitNumber - Unit to test
 */
export async function testQuestionGeneration(unitNumber: number = 5): Promise<void> {
  console.log(`\n🧪 Testing question generation for Unit ${unitNumber}...\n`);

  try {
    const question = await generateQuestion(unitNumber);
    console.log('✅ Success! Generated question:');
    console.log(JSON.stringify(question, null, 2));
  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  }
}
