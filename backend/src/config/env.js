import dotenv from 'dotenv';

dotenv.config();

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const optional = (key, fallback = '') => process.env[key] || fallback;

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: optional('PORT', '4000'),
  MONGODB_URI: optional('MONGODB_URI', 'mongodb://127.0.0.1:27017/johar'),
  JWT_SECRET: optional('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),
  GROQ_API_KEY: optional('GROQ_API_KEY'),
  GROQ_MODEL: optional('GROQ_MODEL', 'openai/gpt-oss-120b'),
  CLOUDINARY_CLOUD_NAME: optional('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: optional('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: optional('CLOUDINARY_API_SECRET'),
  CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:5173'),
};

// fail fast in production rather than running with an insecure default
if (env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required when NODE_ENV=production');
}
if (env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is required when NODE_ENV=production');
}
