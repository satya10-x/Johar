import { verifyToken } from '../services/token.service.js';
import User from '../models/User.js';

// Attaches req.user if a valid token is present, but never rejects.
export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme === 'Bearer' && token) {
      const payload = verifyToken(token);
      const user = await User.findById(payload.id);
      if (user && user.isActive) req.user = user;
    }
  } catch {
    // invalid/expired token on a public route — treat as anonymous
  }
  next();
}
