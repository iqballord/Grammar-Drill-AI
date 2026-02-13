import { prisma } from '../../db/client';
import { User as TelegramUser } from 'telegraf/types';

/**
 * Get or create user from Telegram user data
 * @param telegramUser - Telegram user object from context
 * @returns User from database
 */
export async function getOrCreateUser(telegramUser: TelegramUser) {
  const telegramId = BigInt(telegramUser.id);

  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { telegramId },
  });

  // Create user if doesn't exist
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        username: telegramUser.username || telegramUser.first_name || 'Unknown',
      },
    });

    console.log(`✅ New user created: ${user.username} (Telegram ID: ${telegramId})`);
  }

  return user;
}

/**
 * Get user statistics
 * @param userId - User ID from database
 * @returns User statistics object
 */
export async function getUserStats(userId: string) {
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId },
    include: {
      unit: true,
      question: true,
    },
  });

  const totalQuestions = attempts.length;
  const correctAnswers = attempts.filter(a => a.isCorrect).length;
  const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

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

  // Get units practiced
  const uniqueUnits = new Set(attempts.map(a => a.unitId));

  return {
    totalQuestions,
    correctAnswers,
    incorrectAnswers: totalQuestions - correctAnswers,
    accuracy: Math.round(accuracy),
    dailyStreak: streak,
    unitsPracticed: uniqueUnits.size,
  };
}

/**
 * Save quiz attempt to database
 * @param data - Quiz attempt data
 */
export async function saveQuizAttempt(data: {
  userId: string;
  questionId: string;
  unitId: number;
  userAnswer: string;
  isCorrect: boolean;
}) {
  return await prisma.quizAttempt.create({
    data,
  });
}
