import { Router, Request, Response } from 'express';
import { prisma } from '../../db/client';
import { z } from 'zod';

export const quizRouter = Router();

/**
 * Schema for quiz attempt submission
 */
const QuizAttemptSchema = z.object({
  telegramId: z.string(),
  questionId: z.string().uuid(),
  unitId: z.number().int().min(1).max(115),
  userAnswer: z.string(),
  isCorrect: z.boolean(),
});

/**
 * POST /api/quiz/attempt
 * Save a quiz attempt (alternative to bot's direct database save)
 */
quizRouter.post('/attempt', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = QuizAttemptSchema.parse(req.body);
    const telegramId = BigInt(validatedData.telegramId);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      // Create user if doesn't exist
      user = await prisma.user.create({
        data: {
          telegramId,
          username: 'api_user',
        },
      });
    }

    // Save quiz attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user.id,
        questionId: validatedData.questionId,
        unitId: validatedData.unitId,
        userAnswer: validatedData.userAnswer,
        isCorrect: validatedData.isCorrect,
      },
    });

    res.status(201).json({
      success: true,
      attemptId: attempt.id,
      attemptDate: attempt.attemptDate,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: (error as z.ZodError).issues,
      });
    }

    console.error('Error saving quiz attempt:', error);
    res.status(500).json({ error: 'Failed to save quiz attempt' });
  }
});

/**
 * GET /api/quiz/recent/:telegramId
 * Get recent quiz attempts
 */
quizRouter.get('/recent/:telegramId', async (req: Request, res: Response) => {
  try {
    const telegramId = BigInt(req.params.telegramId as string);
    const limit = parseInt(req.query.limit as string) || 10;

    // Find user
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent attempts
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: user.id },
      include: {
        question: true,
        unit: true,
      },
      orderBy: { attemptDate: 'desc' },
      take: limit,
    });

    res.json({
      attempts: attempts.map(a => ({
        id: a.id,
        unitId: a.unitId,
        unitTitle: a.unit.title,
        questionType: a.question.type,
        question: a.question.question,
        userAnswer: a.userAnswer,
        correctAnswer: a.question.correctAnswer,
        isCorrect: a.isCorrect,
        attemptDate: a.attemptDate,
      })),
    });
  } catch (error) {
    console.error('Error fetching recent attempts:', error);
    res.status(500).json({ error: 'Failed to fetch recent attempts' });
  }
});
