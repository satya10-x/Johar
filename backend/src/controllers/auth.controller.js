import asyncHandler from '../utils/asyncHandler.js';
import { registerUser, loginUser, buildAuthResponse } from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    ...buildAuthResponse(user),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { token, user } = await loginUser(req.body);
  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: user.toSafeJSON ? user.toSafeJSON() : user,
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON() });
});
