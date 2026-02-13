import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from './db/client';
import { startBot, stopBot } from './bot';
import { startApiServer } from './api/server';

// Load environment variables
dotenv.config();

/**
 * Main application entry point
 */
async function main() {
  console.log('🚀 Starting Grammar Learning System...\n');

  try {
    // Connect to database
    await connectDatabase();

    // Start API server for dashboard
    const apiPort = parseInt(process.env.API_PORT || '3001');
    await startApiServer(apiPort);

    // Start Telegram bot
    await startBot();

    console.log('\n✅ Application started successfully!');
    console.log(`📊 Dashboard API: http://localhost:${apiPort}`);
    console.log('🤖 Telegram Bot: Running\n');
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n👋 Shutting down gracefully...');

  try {
    await stopBot();
    await disconnectDatabase();
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start the application
main();
