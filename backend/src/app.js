import express from 'express';
import cors from 'cors';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import apiRoutes from './routes/index.js';
import notFound from './middleware/notFound.middleware.js';
import errorHandler from './middleware/error.middleware.js';

const app = express();

// support one origin (string) or several origins (comma-separated) via CORS_ORIGIN
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      // allow same-origin/no-origin tools (curl, health checks) and configured origins
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '2mb' }));

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export async function startServer() {
  const server = app.listen(env.PORT, () => {
    console.log(`JOHAR API running on port ${env.PORT}`);
  });
  await connectDB();
  return server;
}

export default app;
