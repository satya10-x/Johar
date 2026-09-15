import asyncHandler from '../utils/asyncHandler.js';
import { listSolutions, getSolutionById } from '../services/impact.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await listSolutions(req.query);
  res.json({ success: true, ...data });
});

export const getById = asyncHandler(async (req, res) => {
  const data = await getSolutionById(req.params.id);
  res.json({ success: true, ...data });
});
