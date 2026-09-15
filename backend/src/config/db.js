import mongoose from 'mongoose';

import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}`);

    // Atlas can drop idle sockets — log reconnects so failures are visible
    mongoose.connection.on('disconnected', () => {
      console.warn('[db] MongoDB disconnected — auto-reconnecting...');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('[db] MongoDB reconnected');
    });
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    if (env.NODE_ENV === 'production') {
      throw err; // fail fast in production
    }
    console.error('[db] Retrying in 3 seconds... (dev mode)');
    await new Promise((r) => setTimeout(r, 3000));
    return connectDB();
  }
}
