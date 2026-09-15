import User, { SELF_REGISTRATION_ROLES } from '../models/User.js';

import ApiError from '../utils/ApiError.js';
import { isValidEmail, isStrongPassword, isValidPhone } from '../utils/validators.js';
import { signToken } from './token.service.js';

function assertValidRegistration({ name, email, password, phone, role }) {
  if (!name || !name.trim()) throw new ApiError(400, 'Name is required');
  if (!email || !isValidEmail(email)) throw new ApiError(400, 'A valid email is required');
  if (!isStrongPassword(password)) {
    throw new ApiError(
      400,
      'Password must be at least 8 characters and contain letters and numbers'
    );
  }
  if (!isValidPhone(phone)) throw new ApiError(400, 'Invalid phone number');
  if (role && !SELF_REGISTRATION_ROLES.includes(role)) {
    throw new ApiError(403, `Role "${role}" cannot be self-registered`);
  }
}

export async function registerUser(data) {
  const role = data.role || 'citizen';
  assertValidRegistration({ ...data, role });

  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) throw new ApiError(409, 'An account with this email already exists');

  const user = await User.create({
    name: data.name,
    email: data.email,
    phone: data.phone,
    password: data.password,
    role,
    preferredLanguage: data.preferredLanguage,
    district: data.district,
    location: data.location,
    organization: data.organization,
  });

  return user;
}

export async function loginUser({ email, password }) {
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const matches = await user.comparePassword(password);
  if (!matches) throw new ApiError(401, 'Invalid email or password');

  if (!user.isActive) throw new ApiError(403, 'Account is deactivated');

  const token = signToken({ id: user._id.toString(), role: user.role });
  user.password = undefined;

  return { token, user };
}

export function buildAuthResponse(user) {
  const token = signToken({ id: user._id.toString(), role: user.role });
  return { token, user: user.toSafeJSON() };
}
