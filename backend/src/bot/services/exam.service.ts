import { Context } from 'telegraf';
import { prisma } from '../../db/client';
import { generateBulkQuestions } from '../../ai/generator';
import { AIQuestion } from '../../validation/schemas';

/**
 * Exam session interface
 */
export interface ExamSession {
  userId: string;
  chatId: number;
  units: number[];
  questions: Array<{
    question: AIQuestion;
    questionId: string;
    unitId: number;
  }>;
  currentIndex: number;
  scorePerUnit: Record<number, { correct: number; total: number }>;
  totalScore: number;
  totalQuestions: number;
  startedAt: Date;
}

/**
 * In-memory exam session storage
 */
const activeExamSessions = new Map<string, ExamSession>();

/**
 * Parse /exam command
 *
 * Formats:
 * - /exam                    -> Auto: 10 questions from practiced units
 * - /exam 15                 -> Auto: 15 questions
 * - /exam 1,2,5,10          -> Custom: Units 1,2,5,10 (default count)
 * - /exam 1,2,5,10 50       -> Custom: Units 1,2,5,10 with 50 questions
 */
export function parseExamCommand(text: string): {
  mode: 'auto' | 'custom';
  count?: number;
  units?: number[];
} | null {
  // /exam
  if (text.trim() === '/exam') {
    return { mode: 'auto', count: 10 };
  }

  // /exam 15
  const countMatch = text.match(/^\/exam\s+(\d+)$/);
  if (countMatch) {
    const count = parseInt(countMatch[1]);
    if (count < 1 || count > 100) return null;
    return { mode: 'auto', count };
  }

  // /exam 1,2,5,10 50 (units with custom count)
  const unitsWithCountMatch = text.match(/^\/exam\s+([\d,\s]+)\s+(\d+)$/);
  if (unitsWithCountMatch) {
    const units = unitsWithCountMatch[1]
      .split(',')
      .map(n => parseInt(n.trim()))
      .filter(n => n >= 1 && n <= 115);

    const count = parseInt(unitsWithCountMatch[2]);

    if (units.length === 0) return null;
    if (count < 1 || count > 100) return null;

    return { mode: 'custom', units, count };
  }

  // /exam 1,2,5,10 (units without count - use default)
  const unitsMatch = text.match(/^\/exam\s+([\d,\s]+)$/);
  if (unitsMatch) {
    const units = unitsMatch[1]
      .split(',')
      .map(n => parseInt(n.trim()))
      .filter(n => n >= 1 && n <= 115);

    if (units.length === 0) return null;
    return { mode: 'custom', units };
  }

  return null;
}

/**
 * Get units from user history (for auto mode)
 */
export async function getUnitsFromHistory(
  userId: string,
  limit: number = 5
): Promise<number[]> {
  // Get units user has practiced
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId },
    select: { unitId: true },
    distinct: ['unitId'],
    orderBy: { attemptDate: 'desc' },
    take: limit,
  });

  const units = attempts.map(a => a.unitId);

  // If user has no history, return first 5 units
  if (units.length === 0) {
    return [1, 2, 3, 4, 5];
  }

  return units;
}

/**
 * Get exam questions with smart generation
 *
 * Strategy:
 * 1. Check available questions per unit
 * 2. Generate 30 questions for units that don't have enough
 * 3. Fetch and distribute questions evenly
 */
export async function getExamQuestions(
  ctx: Context,
  units: number[],
  totalQuestions: number,
  userId: string
): Promise<Array<{ question: AIQuestion; questionId: string; unitId: number }>> {
  const questionsPerUnit = Math.ceil(totalQuestions / units.length);

  // Phase 1: Check availability and identify units needing generation
  const unitsNeedingGeneration: Array<{
    unitId: number;
    available: number;
    needed: number;
  }> = [];

  for (const unitId of units) {
    const count = await prisma.question.count({ where: { unitId } });

    if (count < questionsPerUnit) {
      unitsNeedingGeneration.push({
        unitId,
        available: count,
        needed: questionsPerUnit - count,
      });
    }
  }

  // Phase 2: Generate questions if needed (with user feedback)
  if (unitsNeedingGeneration.length > 0) {
    const totalNeeded = unitsNeedingGeneration.reduce(
      (sum, u) => sum + u.needed,
      0
    );

    // Fetch unit info for better messaging
    const unitInfos = await prisma.unit.findMany({
      where: { id: { in: unitsNeedingGeneration.map(u => u.unitId) } },
      select: { id: true, title: true },
    });

    const unitTitles = unitInfos
      .map(u => `• Unit ${u.id}: ${u.title}`)
      .join('\n');

    await ctx.reply(
      `📦 <b>Preparing Exam Questions</b>\n\n` +
        `Need to generate questions for ${unitsNeedingGeneration.length} unit(s):\n\n` +
        `${unitTitles}\n\n` +
        `Generating 30 questions per unit for future use...\n` +
        `This may take a moment... ⏳`,
      { parse_mode: 'HTML' }
    );

    // Generate in parallel for speed
    await Promise.all(
      unitsNeedingGeneration.map(async ({ unitId }) => {
        console.log(`📦 Generating 30 questions for Unit ${unitId}...`);
        const aiQuestions = await generateBulkQuestions(unitId, 30);

        // Save all to database
        await Promise.all(
          aiQuestions.map(async aiQuestion => {
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

        console.log(`✅ Saved 30 questions for Unit ${unitId}`);
      })
    );

    await ctx.reply('✅ Questions ready! Starting exam...');
  }

  // Phase 3: Fetch questions from database
  const allQuestions: Array<{
    question: AIQuestion;
    questionId: string;
    unitId: number;
  }> = [];

  for (const unitId of units) {
    // Get available questions for this unit
    let availableQuestions = await prisma.question.findMany({
      where: { unitId },
    });

    // Filter out recently answered questions (optional)
    if (userId) {
      const recentAttempts = await prisma.quizAttempt.findMany({
        where: { userId, unitId },
        orderBy: { attemptDate: 'desc' },
        take: 15,
      });

      const recentQuestionIds = new Set(recentAttempts.map(a => a.questionId));
      const filtered = availableQuestions.filter(
        q => !recentQuestionIds.has(q.id)
      );

      // Use filtered if we have enough, otherwise use all
      if (filtered.length >= questionsPerUnit) {
        availableQuestions = filtered;
      }
    }

    // Shuffle and take needed amount
    const shuffled = availableQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, questionsPerUnit);

    // Map to exam question format
    const questions = selected.map(q => ({
      question: {
        unit: q.unitId,
        type: q.type as any,
        question: q.question,
        options: q.options ? (q.options as string[]) : null,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
      },
      questionId: q.id,
      unitId: q.unitId,
    }));

    allQuestions.push(...questions);
  }

  // Shuffle all questions and return exact count
  return allQuestions.sort(() => Math.random() - 0.5).slice(0, totalQuestions);
}

/**
 * Create exam session
 */
export function createExamSession(
  userId: string,
  chatId: number,
  units: number[],
  questions: Array<{ question: AIQuestion; questionId: string; unitId: number }>
): ExamSession {
  // Initialize score per unit
  const scorePerUnit: Record<number, { correct: number; total: number }> = {};
  for (const unitId of units) {
    scorePerUnit[unitId] = { correct: 0, total: 0 };
  }

  const session: ExamSession = {
    userId,
    chatId,
    units,
    questions,
    currentIndex: 0,
    scorePerUnit,
    totalScore: 0,
    totalQuestions: questions.length,
    startedAt: new Date(),
  };

  activeExamSessions.set(userId, session);
  console.log(`✅ Created exam session for user ${userId} (${questions.length} questions from ${units.length} units)`);

  return session;
}

/**
 * Get active exam session
 */
export function getExamSession(userId: string): ExamSession | null {
  return activeExamSessions.get(userId) || null;
}

/**
 * Update exam session after answering a question
 */
export function updateExamSession(
  userId: string,
  isCorrect: boolean
): ExamSession | null {
  const session = activeExamSessions.get(userId);
  if (!session) {
    return null;
  }

  // Get current question's unit
  const currentQuestion = session.questions[session.currentIndex];
  const unitId = currentQuestion.unitId;

  // Update score
  if (isCorrect) {
    session.totalScore++;
    session.scorePerUnit[unitId].correct++;
  }
  session.scorePerUnit[unitId].total++;

  // Move to next question
  session.currentIndex++;

  return session;
}

/**
 * Check if exam session is complete
 */
export function isExamComplete(session: ExamSession): boolean {
  return session.currentIndex >= session.totalQuestions;
}

/**
 * Get current question from exam session
 */
export function getCurrentExamQuestion(session: ExamSession): {
  question: AIQuestion;
  questionId: string;
  unitId: number;
  index: number;
} | null {
  if (isExamComplete(session)) {
    return null;
  }

  const current = session.questions[session.currentIndex];
  return {
    question: current.question,
    questionId: current.questionId,
    unitId: current.unitId,
    index: session.currentIndex,
  };
}

/**
 * Delete exam session
 */
export function deleteExamSession(userId: string): void {
  activeExamSessions.delete(userId);
  console.log(`🗑️  Deleted exam session for user ${userId}`);
}

/**
 * Check if user has active exam session
 */
export function hasActiveExamSession(userId: string): boolean {
  return activeExamSessions.has(userId);
}

/**
 * Get exam statistics
 */
export function getExamStats(session: ExamSession) {
  const accuracy =
    session.totalQuestions > 0
      ? Math.round((session.totalScore / session.totalQuestions) * 100)
      : 0;

  const duration = Date.now() - session.startedAt.getTime();

  return {
    score: session.totalScore,
    total: session.totalQuestions,
    accuracy,
    duration,
    scorePerUnit: session.scorePerUnit,
    units: session.units,
  };
}
