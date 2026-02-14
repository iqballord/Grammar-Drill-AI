import { prisma } from '../../db/client';
import { generateBulkQuestions } from '../../ai/generator';
import { AIQuestion } from '../../validation/schemas';

/**
 * Smart question pool strategy:
 * 1. Check database for existing questions
 * 2. If enough questions exist, use them
 * 3. If not, generate bulk questions (20-30) and save to DB
 * 4. This saves 99% AI costs by reusing questions
 */

/**
 * Get a single question for /study command
 * Uses existing questions from DB, or generates 20 new ones if unit is empty
 *
 * @param unitId - Unit number (1-115)
 * @param userId - User ID to avoid showing recently answered questions
 * @returns Question data with database ID
 */
export async function getStudyQuestion(
  unitId: number,
  userId?: string
): Promise<{ question: AIQuestion; questionId: string } | null> {
  // 1. Check database for existing questions in this unit
  const existingQuestions = await prisma.question.findMany({
    where: { unitId },
  });

  // 2. If questions exist, return a random one (avoid recent attempts if userId provided)
  if (existingQuestions.length > 0) {
    console.log(`✅ Found ${existingQuestions.length} existing questions for unit ${unitId}`);

    // Filter out recently answered questions (optional)
    let availableQuestions = existingQuestions;

    if (userId) {
      const recentAttempts = await prisma.quizAttempt.findMany({
        where: {
          userId,
          unitId,
        },
        orderBy: { attemptDate: 'desc' },
        take: 10, // Last 10 attempts
      });

      const recentQuestionIds = new Set(recentAttempts.map(a => a.questionId));
      availableQuestions = existingQuestions.filter(q => !recentQuestionIds.has(q.id));

      // If all questions were recently answered, use all questions
      if (availableQuestions.length === 0) {
        availableQuestions = existingQuestions;
      }
    }

    // Select random question
    const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

    return {
      question: {
        unit: randomQuestion.unitId,
        type: randomQuestion.type as any,
        question: randomQuestion.question,
        options: randomQuestion.options ? (randomQuestion.options as string[]) : null,
        correct_answer: randomQuestion.correctAnswer,
        explanation: randomQuestion.explanation,
      },
      questionId: randomQuestion.id,
    };
  }

  // 3. No questions in database, generate 20 questions for this unit
  console.log(`📦 Unit ${unitId} has no questions, generating 20 new questions...`);

  const aiQuestions = await generateBulkQuestions(unitId, 20);

  // 4. Save all questions to database
  const savedQuestions = await Promise.all(
    aiQuestions.map(async (aiQuestion) => {
      return await prisma.question.create({
        data: {
          unitId: aiQuestion.unit,
          type: aiQuestion.type,
          question: aiQuestion.question,
          options: aiQuestion.options ?? undefined,
          correctAnswer: aiQuestion.correct_answer,
          explanation: aiQuestion.explanation,
        },
      });
    })
  );

  console.log(`✅ Saved ${savedQuestions.length} questions for unit ${unitId}`);

  // 5. Return first question
  const firstQuestion = savedQuestions[0];
  return {
    question: aiQuestions[0],
    questionId: firstQuestion.id,
  };
}

/**
 * Get multiple questions for /quiz command
 * Uses existing questions from DB, or generates 30 new ones if not enough
 *
 * @param unitId - Unit number (1-115)
 * @param count - Number of questions needed (default: 10)
 * @param userId - User ID to avoid showing recently answered questions
 * @returns Array of question data with database IDs
 */
export async function getQuizQuestions(
  unitId: number,
  count: number = 10,
  userId?: string
): Promise<Array<{ question: AIQuestion; questionId: string }>> {
  // 1. Check database for existing questions
  const existingQuestions = await prisma.question.findMany({
    where: { unitId },
  });

  // 2. Filter out recently answered questions (optional)
  let availableQuestions = existingQuestions;

  if (userId && existingQuestions.length > 0) {
    const recentAttempts = await prisma.quizAttempt.findMany({
      where: {
        userId,
        unitId,
      },
      orderBy: { attemptDate: 'desc' },
      take: 20, // Last 20 attempts
    });

    const recentQuestionIds = new Set(recentAttempts.map(a => a.questionId));
    availableQuestions = existingQuestions.filter(q => !recentQuestionIds.has(q.id));

    // If not enough fresh questions, include some recent ones
    if (availableQuestions.length < count) {
      availableQuestions = existingQuestions;
    }
  }

  // 3. If we have enough questions in DB, use them
  if (availableQuestions.length >= count) {
    console.log(`✅ Found ${availableQuestions.length} existing questions for unit ${unitId}`);

    // Shuffle and take `count` questions
    const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    return selected.map(q => ({
      question: {
        unit: q.unitId,
        type: q.type as any,
        question: q.question,
        options: q.options ? (q.options as string[]) : null,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
      },
      questionId: q.id,
    }));
  }

  // 4. Not enough questions, generate more
  const neededQuestions = Math.max(30, count + 10); // Generate at least 30 for future use
  console.log(`📦 Unit ${unitId} has ${existingQuestions.length} questions, generating ${neededQuestions} more...`);

  const aiQuestions = await generateBulkQuestions(unitId, neededQuestions);

  // 5. Save all new questions to database
  const savedQuestions = await Promise.all(
    aiQuestions.map(async (aiQuestion) => {
      return await prisma.question.create({
        data: {
          unitId: aiQuestion.unit,
          type: aiQuestion.type,
          question: aiQuestion.question,
          options: aiQuestion.options ?? undefined,
          correctAnswer: aiQuestion.correct_answer,
          explanation: aiQuestion.explanation,
        },
      });
    })
  );

  console.log(`✅ Saved ${savedQuestions.length} new questions for unit ${unitId}`);

  // 6. Combine existing + new questions, shuffle, and return `count` questions
  const allQuestions = [
    ...availableQuestions.map(q => ({
      question: {
        unit: q.unitId,
        type: q.type as any,
        question: q.question,
        options: q.options ? (q.options as string[]) : null,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
      },
      questionId: q.id,
    })),
    ...aiQuestions.map((aiQ, index) => ({
      question: aiQ,
      questionId: savedQuestions[index].id,
    })),
  ];

  const shuffled = allQuestions.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get question pool stats for a unit
 * @param unitId - Unit number
 * @returns Pool statistics
 */
export async function getQuestionPoolStats(unitId: number) {
  const count = await prisma.question.count({
    where: { unitId },
  });

  const byType = await prisma.question.groupBy({
    by: ['type'],
    where: { unitId },
    _count: true,
  });

  return {
    totalQuestions: count,
    byType: byType.reduce((acc, item) => {
      acc[item.type] = item._count;
      return acc;
    }, {} as Record<string, number>),
  };
}

/**
 * Get total question pool stats across all units
 */
export async function getTotalQuestionPoolStats() {
  const total = await prisma.question.count();

  const byUnit = await prisma.question.groupBy({
    by: ['unitId'],
    _count: true,
  });

  return {
    totalQuestions: total,
    unitsWithQuestions: byUnit.length,
    totalUnits: 115,
    coverage: Math.round((byUnit.length / 115) * 100),
  };
}
