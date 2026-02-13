import { Router, Request, Response } from 'express';
import { prisma } from '../../db/client';

export const statsRouter = Router();

/**
 * GET /api/stats/:telegramId
 * Get user statistics by Telegram ID
 */
statsRouter.get('/:telegramId', async (req: Request, res: Response) => {
  try {
    const telegramId = BigInt(req.params.telegramId);

    // Find user
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get quiz attempts
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: user.id },
      include: {
        unit: true,
        question: true,
      },
      orderBy: { attemptDate: 'desc' },
    });

    const totalQuestions = attempts.length;
    const correctAnswers = attempts.filter(a => a.isCorrect).length;
    const incorrectAnswers = totalQuestions - correctAnswers;
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    // Calculate daily streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedAttempts = attempts
      .map(a => a.attemptDate)
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    let currentDate = new Date(today);

    for (const attemptDate of sortedAttempts) {
      const attemptDay = new Date(attemptDate);
      attemptDay.setHours(0, 0, 0, 0);

      if (attemptDay.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (attemptDay.getTime() < currentDate.getTime()) {
        break;
      }
    }

    // Get unique units practiced
    const uniqueUnits = new Set(attempts.map(a => a.unitId));

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAttempts = attempts.filter(
      a => a.attemptDate >= sevenDaysAgo
    );

    res.json({
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
      },
      stats: {
        totalQuestions,
        correctAnswers,
        incorrectAnswers,
        accuracy,
        dailyStreak: streak,
        unitsPracticed: uniqueUnits.size,
        totalUnits: 115,
        recentActivity: recentAttempts.length,
      },
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});
