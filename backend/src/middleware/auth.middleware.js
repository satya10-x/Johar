import User from '../models/User.js';

import ApiError from '../utils/ApiError.js';
import { verifyToken } from '../services/token.service.js';

function extractToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Authorization header must be in the format: Bearer <token>');
  }
  return token;
}

export async function requireAuth(req, res, next) {
  try {
    const payload = verifyToken(extractToken(req));
    const user = await User.findById(payload.id);
    if (!user) throw new ApiError(401, 'User no longer exists');
    if (!user.isActive) throw new ApiError(403, 'Account is deactivated');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Access denied. Required role: ${roles.join(' or ')}`)
      );
    }
    next();
  };
}
