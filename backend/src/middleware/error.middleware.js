import { env } from '../config/env.js';

function normalizeError(err) {
  if (err.name === 'ValidationError' && err.errors) {
    const first = Object.values(err.errors)[0];
    return { statusCode: 400, message: first.message };
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return { statusCode: 409, message: `Duplicate value for ${field}` };
  }
  if (err.name === 'CastError') {
    return { statusCode: 400, message: `Invalid ${err.path}: ${err.value}` };
  }
  return { statusCode: err.statusCode || 500, message: err.message || 'Internal Server Error' };
}

export default function errorHandler(err, req, res, next) {
  const { statusCode, message } = normalizeError(err);

  console.error(`[error] ${statusCode} ${message}`);
  if (env.NODE_ENV === 'development' && statusCode >= 500 && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
}
