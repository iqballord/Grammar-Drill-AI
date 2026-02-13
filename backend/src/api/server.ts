import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { statsRouter } from './routes/stats.routes';
import { masteryRouter } from './routes/mastery.routes';
import { errorBankRouter } from './routes/error-bank.routes';
import { quizRouter } from './routes/quiz.routes';

dotenv.config();

/**
 * Express server for REST API
 * Provides endpoints for Next.js dashboard
 */
export const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/stats', statsRouter);
app.use('/api/mastery', masteryRouter);
app.use('/api/error-bank', errorBankRouter);
app.use('/api/quiz', quizRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

/**
 * Start Express server
 */
export function startApiServer(port: number = 3001) {
  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`✅ API server running on http://localhost:${port}`);
      resolve();
    });
  });
}
