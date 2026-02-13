import { Router, Request, Response } from 'express';
import { prisma } from '../../db/client';

export const masteryRouter = Router();

/**
 * GET /api/mastery/:telegramId
 * Get unit-by-unit mastery data for progress visualization
 */
masteryRouter.get('/:telegramId', async (req: Request, res: Response) => {
  try {
    const telegramId = BigInt(req.params.telegramId as string);

    // Find user
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all attempts grouped by unit
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: user.id },
      include: {
        unit: true,
      },
    });

    // Build mastery map for Units 1-115
    const masteryData = [];

    for (let unitId = 1; unitId <= 115; unitId++) {
      const unitAttempts = attempts.filter(a => a.unitId === unitId);
      const totalQuestions = unitAttempts.length;
      const correctAnswers = unitAttempts.filter(a => a.isCorrect).length;
      const accuracy = totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;

      // Determine mastery level
      let masteryLevel: 'none' | 'beginner' | 'intermediate' | 'advanced' | 'mastered' = 'none';

      if (totalQuestions === 0) {
        masteryLevel = 'none';
      } else if (accuracy < 50) {
        masteryLevel = 'beginner';
      } else if (accuracy < 70) {
        masteryLevel = 'intermediate';
      } else if (accuracy < 90) {
        masteryLevel = 'advanced';
      } else {
        masteryLevel = 'mastered';
      }

      masteryData.push({
        unitId,
        totalQuestions,
        correctAnswers,
        incorrectAnswers: totalQuestions - correctAnswers,
        accuracy,
        masteryLevel,
        lastPracticed: unitAttempts.length > 0
          ? unitAttempts[unitAttempts.length - 1].attemptDate
          : null,
      });
    }

    // Summary statistics
    const practicedUnits = masteryData.filter(u => u.totalQuestions > 0).length;
    const masteredUnits = masteryData.filter(u => u.masteryLevel === 'mastered').length;
    const averageAccuracy = masteryData
      .filter(u => u.totalQuestions > 0)
      .reduce((sum, u) => sum + u.accuracy, 0) / (practicedUnits || 1);

    res.json({
      summary: {
        totalUnits: 115,
        practicedUnits,
        masteredUnits,
        averageAccuracy: Math.round(averageAccuracy),
        progress: Math.round((practicedUnits / 115) * 100),
      },
      units: masteryData,
    });
  } catch (error) {
    console.error('Error fetching mastery data:', error);
    res.status(500).json({ error: 'Failed to fetch mastery data' });
  }
});

/**
 * GET /api/mastery/:telegramId/unit/:unitId
 * Get detailed data for a specific unit
 */
masteryRouter.get('/:telegramId/unit/:unitId', async (req: Request, res: Response) => {
  try {
    const telegramId = BigInt(req.params.telegramId as string);
    const unitId = parseInt(req.params.unitId as string);

    if (unitId < 1 || unitId > 115) {
      return res.status(400).json({ error: 'Unit ID must be between 1 and 115' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get attempts for this unit
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        userId: user.id,
        unitId,
      },
      include: {
        question: true,
      },
      orderBy: { attemptDate: 'desc' },
    });

    const totalQuestions = attempts.length;
    const correctAnswers = attempts.filter(a => a.isCorrect).length;
    const accuracy = totalQuestions > 0
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : 0;

    res.json({
      unitId,
      totalQuestions,
      correctAnswers,
      incorrectAnswers: totalQuestions - correctAnswers,
      accuracy,
      attempts: attempts.map(a => ({
        id: a.id,
        questionText: a.question.question,
        questionType: a.question.type,
        userAnswer: a.userAnswer,
        correctAnswer: a.question.correctAnswer,
        isCorrect: a.isCorrect,
        attemptDate: a.attemptDate,
      })),
    });
  } catch (error) {
    console.error('Error fetching unit data:', error);
    res.status(500).json({ error: 'Failed to fetch unit data' });
  }
});
