import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export function signToken(payload) {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token has expired');
    }
    throw new ApiError(401, 'Invalid token');
  }
}
