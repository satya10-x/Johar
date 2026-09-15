import 'dotenv/config';
import { startServer } from './app.js';

const exit = (err) => {
  console.error('Failed to start JOHAR API:', err.message);
  process.exit(1);
};

process.on('unhandledRejection', exit);
process.on('uncaughtException', exit);

startServer().catch(exit);
