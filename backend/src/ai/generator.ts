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
 * Get unit-specific guidance to prevent overlap between similar units
 */
function getUnitSpecificGuidance(unitNumber: number, unitTitle: string): string {
  // Special handling for Units 1-5 (am/is/are variations)
  const amIsAreUnits: Record<number, string> = {
    1: `**Unit 1 Focus: POSITIVE and NEGATIVE statements only**
- Include negative forms (I'm not, You aren't, He isn't)
- Questions MUST use positive form: "I am", "You are", "He is", "She is", "It is", "We are", "They are"
- DO NOT include question forms (Am I?, Are you?, Is he?)
- Examples: "I ___ happy", "She ___ a teacher", "They ___ students"`,

    2: `**Unit 2 Focus: POSITIVE and NEGATIVE question forms only**
    - Questionsquestion form: "Am I?", "Are you?", "Is he/she/it?", "Are we/they?", etc
    -include negative forms (Aren't you , Isn't she , Aren't they, etc)
- DO NOT include positive statements (I am, You are)
- Examples: "___ you ready?", "___ she a doctor?", "Where ___ they?"`,

    3: `**Unit 3 Focus: PRESENT CONTINUOUS (-ing forms)**
- Questions MUST use "am/is/are + verb-ing": "I am doing", "She is working", "They are playing"
- Focus on actions happening NOW or TEMPORARY situations
- Include time markers: now, at the moment, today, this week
- Examples: "She ___ (work) right now", "They ___ (play) football at the moment"`,

    4: `**Unit 4 Focus: ARE YOU DOING vs DO YOU DO (contrast)**
- Questions MUST test the difference between present continuous and present simple
- Contrast temporary vs permanent, now vs always
- Examples: "I usually ___ coffee, but today I ___ tea" (drink/am drinking)`,

    5: `**Unit 5 Focus: PRESENT SIMPLE (he/she/it) with -s/-es**
- Questions MUST test third person singular: adds -s or -es
- Focus on habits, routines, facts about he/she/it
- Common mistakes: "he go" vs "he goes", "she watch" vs "she watches"
- Examples: "He ___ to work every day" (goes), "She ___ TV in the evening" (watches)`,
  };

  if (amIsAreUnits[unitNumber]) {
    return amIsAreUnits[unitNumber];
  }

  // Generic guidance for other units
  return `**Unit ${unitNumber} Focus:**
- Questions must STRICTLY test "${unitTitle}"
- Avoid generic grammar that could fit other units
- Be specific to this unit's learning objective`;
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
      ? `Generate a ${questionType} question for ${unitContext} of "Essential Grammar in Use".

IMPORTANT: Create an intermediate or advanced level question (NO easy/beginner). Use modern, professional contexts with complex sentences and nuanced grammar.`
      : `Generate a question for ${unitContext} of "Essential Grammar in Use". You can choose any question type (MULTIPLE_CHOICE, TRUE_FALSE, or FILL_IN_THE_BLANK).

IMPORTANT: Create an intermediate or advanced level question (NO easy/beginner). Use modern, professional contexts with complex sentences and nuanced grammar.`;

    // Combine system prompt and user prompt for Gemini
    const fullPrompt = `${MURPHY_SYSTEM_PROMPT}\n\n${userPrompt}\n\nRespond with valid JSON only.`;

    // Call Gemini API
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 1,
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

    // Validate count (increased to 50 for exam/study pooling)
    if (count < 1 || count > 50) {
      throw new QuestionGenerationError(
        `Question count must be between 1 and 50, received: ${count}`
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

    // Build user prompt for bulk generation with unit-specific focus
    const unitFocus = getUnitSpecificGuidance(unitNumber, unit.title);

    const userPrompt = `Generate exactly ${count} UNIQUE grammar questions for ${unitContext} of "Essential Grammar in Use".

**STRICT UNIQUENESS RULES:**
- Every question MUST use a unique scenario
- DO NOT repeat verbs or subjects across the ${count} questions
- Example: If Question 1 is about "Sarah" and "coding", Question 2 must be about a different subject and action
- Ensure the questions cover different aspects of Unit ${unitNumber} to provide comprehensive review
- Avoid generic examples like "I am a student" unless specifically required by the unit's core lesson

**PERSONA & CONTEXT DIVERSITY:**
While following Raymond Murphy's grammar rules, use diverse and modern scenarios to make sentences engaging and unique. Mix these contexts across your questions:
- Software development & tech: developers, programmers, startups, debugging, deploying apps
- Remote work & digital nomads: working from home, video calls, time zones, coworking spaces
- Modern lifestyle: streaming, podcasts, social media, fitness apps, online shopping
- Travel & adventure: backpacking, flight bookings, hotels, exploring cities
- Hobbies & interests: gaming, photography, cooking, music production, cycling
- Business & entrepreneurship: freelancing, clients, projects, deadlines, meetings
- Education & learning: online courses, tutorials, certifications, studying languages

**CRITICAL - Uniqueness:**
- Each question MUST be completely different from others in the set
- DO NOT repeat the same sentence structure with minor word changes
- Ensure diverse vocabulary and contexts across all questions
- Check that no two questions test the exact same concept in the same way

Requirements:
- Return a JSON array of exactly ${count} questions
- Mix question types: MULTIPLE_CHOICE, TRUE_FALSE, and FILL_IN_THE_BLANK
- Each question must be unique and test different aspects of the grammar topic
- All questions MUST focus specifically on "${unit.title}" (Unit ${unitNumber})

${unitFocus}

**IMPORTANT - Question Variety:**
- Include POSITIVE, NEGATIVE, and QUESTION forms (balanced mix)
- Mix difficulty levels: 40% intermediate, 60% advanced (NO beginner/easy questions)
- Include common learner mistakes in wrong options
- Vary sentence complexity (compound, complex)
- Test different contexts (statements, questions, negatives, contractions)

**Difficulty Guidelines:**
- Intermediate (40%): Longer sentences, varied scenarios, multiple grammar points, nuanced vocabulary
- Advanced (60%): Complex sentences, tricky edge cases, subtle grammar distinctions, real-world professional contexts

**CRITICAL - Unit Specificity:**
- DO NOT generate generic questions that could fit any unit
- Each question must clearly test the SPECIFIC grammar point of this unit
- Avoid overlapping with adjacent units (e.g., Unit 1 vs Unit 2)

Questions should reflect Murphy's teaching approach for this specific unit, but with modern, relatable scenarios.

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

      // Remove duplicates based on question text (case-insensitive, trimmed)
      const uniqueQuestions: BulkAIQuestions = [];
      const seenQuestions = new Set<string>();

      for (const question of validatedQuestions) {
        const normalizedQuestion = question.question.toLowerCase().trim();

        if (!seenQuestions.has(normalizedQuestion)) {
          seenQuestions.add(normalizedQuestion);
          uniqueQuestions.push(question);
        }
      }

      // Log warning if duplicates were found
      const duplicateCount = validatedQuestions.length - uniqueQuestions.length;
      if (duplicateCount > 0) {
        console.warn(
          `⚠️ Removed ${duplicateCount} duplicate question(s) for unit ${unitNumber}`
        );
      }

      // Verify we got enough unique questions
      if (uniqueQuestions.length !== count) {
        console.warn(
          `AI generated ${uniqueQuestions.length} unique questions instead of ${count} (${duplicateCount} duplicates removed)`
        );
      }

      // Verify all questions are for the correct unit
      for (const question of uniqueQuestions) {
        if (question.unit !== unitNumber) {
          console.warn(
            `Question has unit ${question.unit} instead of ${unitNumber}`
          );
        }
      }

      return uniqueQuestions;
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
