import { AIQuestion } from '../../validation/schemas';

/**
 * Quiz Session interface
 */
export interface QuizSession {
  userId: string;
  chatId: number;
  unitId: number;
  questions: Array<{
    question: AIQuestion;
    questionId: string; // Database ID after saving
  }>;
  currentIndex: number;
  score: number;
  totalQuestions: number;
  startedAt: Date;
}

/**
 * In-memory session storage
 * Key: userId (for simplicity, we use userId as the key)
 * In production, consider using Redis for distributed storage
 */
const activeSessions = new Map<string, QuizSession>();

/**
 * Create a new quiz session
 * @param userId - User's database ID
 * @param chatId - Telegram chat ID
 * @param unitId - Unit number
 * @param questions - Array of AI-generated questions with their DB IDs
 * @returns Created session
 */
export function createSession(
  userId: string,
  chatId: number,
  unitId: number,
  questions: Array<{ question: AIQuestion; questionId: string }>
): QuizSession {
  // Delete any existing session for this user
  if (activeSessions.has(userId)) {
    console.log(`Replacing existing session for user ${userId}`);
    activeSessions.delete(userId);
  }

  const session: QuizSession = {
    userId,
    chatId,
    unitId,
    questions,
    currentIndex: 0,
    score: 0,
    totalQuestions: questions.length,
    startedAt: new Date(),
  };

  activeSessions.set(userId, session);
  console.log(`✅ Created quiz session for user ${userId} (${questions.length} questions)`);

  return session;
}

/**
 * Get active session for a user
 * @param userId - User's database ID
 * @returns Session or null if not found
 */
export function getSession(userId: string): QuizSession | null {
  return activeSessions.get(userId) || null;
}

/**
 * Update session after answering a question
 * @param userId - User's database ID
 * @param isCorrect - Whether the answer was correct
 * @returns Updated session or null if not found
 */
export function updateSession(userId: string, isCorrect: boolean): QuizSession | null {
  const session = activeSessions.get(userId);
  if (!session) {
    return null;
  }

  // Increment score if correct
  if (isCorrect) {
    session.score++;
  }

  // Move to next question
  session.currentIndex++;

  return session;
}

/**
 * Check if session is complete
 * @param session - Quiz session
 * @returns True if all questions have been answered
 */
export function isSessionComplete(session: QuizSession): boolean {
  return session.currentIndex >= session.totalQuestions;
}

/**
 * Get current question from session
 * @param session - Quiz session
 * @returns Current question data or null if session is complete
 */
export function getCurrentQuestion(session: QuizSession): {
  question: AIQuestion;
  questionId: string;
  index: number;
} | null {
  if (isSessionComplete(session)) {
    return null;
  }

  const currentQ = session.questions[session.currentIndex];
  return {
    question: currentQ.question,
    questionId: currentQ.questionId,
    index: session.currentIndex,
  };
}

/**
 * Delete a session (cleanup after completion)
 * @param userId - User's database ID
 */
export function deleteSession(userId: string): void {
  activeSessions.delete(userId);
  console.log(`🗑️  Deleted quiz session for user ${userId}`);
}

/**
 * Get session statistics
 * @param session - Quiz session
 * @returns Session stats
 */
export function getSessionStats(session: QuizSession) {
  return {
    score: session.score,
    total: session.totalQuestions,
    accuracy: session.totalQuestions > 0
      ? Math.round((session.score / session.totalQuestions) * 100)
      : 0,
    duration: Date.now() - session.startedAt.getTime(),
  };
}

/**
 * Check if user has an active session
 * @param userId - User's database ID
 * @returns True if user has active session
 */
export function hasActiveSession(userId: string): boolean {
  return activeSessions.has(userId);
}

/**
 * Get total number of active sessions (for monitoring)
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}
