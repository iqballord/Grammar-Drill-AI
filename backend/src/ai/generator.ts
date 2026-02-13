import { geminiModel, MURPHY_SYSTEM_PROMPT } from './config';
import { AIQuestionSchema, QuestionType, type AIQuestion } from '../validation/schemas';
import { ZodError } from 'zod';

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

    // Build user prompt
    const userPrompt = questionType
      ? `Generate a ${questionType} question for Unit ${unitNumber} of "Essential Grammar in Use".`
      : `Generate a question for Unit ${unitNumber} of "Essential Grammar in Use". You can choose any question type (MULTIPLE_CHOICE, TRUE_FALSE, or FILL_IN_THE_BLANK).`;

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
 * Generate multiple questions for a unit (useful for batch generation)
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
