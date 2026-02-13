import { Router, Request, Response } from 'express';
import { prisma } from '../../db/client';

export const errorBankRouter = Router();

/**
 * GET /api/error-bank/:telegramId
 * Get all incorrectly answered questions for review
 */
errorBankRouter.get('/:telegramId', async (req: Request, res: Response) => {
  try {
    const telegramId = BigInt(req.params.telegramId);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Find user
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get incorrect attempts
    const incorrectAttempts = await prisma.quizAttempt.findMany({
      where: {
        userId: user.id,
        isCorrect: false,
      },
      include: {
        question: true,
        unit: true,
      },
      orderBy: { attemptDate: 'desc' },
      take: limit,
      skip: offset,
    });

    // Get total count
    const totalErrors = await prisma.quizAttempt.count({
      where: {
        userId: user.id,
        isCorrect: false,
      },
    });

    // Format error bank data
    const errors = incorrectAttempts.map(attempt => ({
      id: attempt.id,
      questionId: attempt.questionId,
      unitId: attempt.unitId,
      unitTitle: attempt.unit.title,
      questionText: attempt.question.question,
      questionType: attempt.question.type,
      userAnswer: attempt.userAnswer,
      correctAnswer: attempt.question.correctAnswer,
      explanation: attempt.question.explanation,
      attemptDate: attempt.attemptDate,
      options: attempt.question.options,
    }));

    res.json({
      total: totalErrors,
      limit,
      offset,
      errors,
    });
  } catch (error) {
    console.error('Error fetching error bank:', error);
    res.status(500).json({ error: 'Failed to fetch error bank' });
  }
});

/**
 * GET /api/error-bank/:telegramId/by-unit
 * Get incorrect attempts grouped by unit
 */
errorBankRouter.get('/:telegramId/by-unit', async (req: Request, res: Response) => {
  try {
    const telegramId = BigInt(req.params.telegramId);

    // Find user
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all incorrect attempts
    const incorrectAttempts = await prisma.quizAttempt.findMany({
      where: {
        userId: user.id,
        isCorrect: false,
      },
      include: {
        unit: true,
      },
    });

    // Group by unit
    const errorsByUnit = incorrectAttempts.reduce((acc, attempt) => {
      const unitId = attempt.unitId;
      if (!acc[unitId]) {
        acc[unitId] = {
          unitId,
          unitTitle: attempt.unit.title,
          errorCount: 0,
        };
      }
      acc[unitId].errorCount++;
      return acc;
    }, {} as Record<number, { unitId: number; unitTitle: string; errorCount: number }>);

    // Convert to array and sort by error count
    const errorsByUnitArray = Object.values(errorsByUnit).sort(
      (a, b) => b.errorCount - a.errorCount
    );

    res.json({
      totalErrors: incorrectAttempts.length,
      unitsWithErrors: errorsByUnitArray.length,
      errorsByUnit: errorsByUnitArray,
    });
  } catch (error) {
    console.error('Error fetching errors by unit:', error);
    res.status(500).json({ error: 'Failed to fetch errors by unit' });
  }
});
