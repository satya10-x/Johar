import asyncHandler from '../utils/asyncHandler.js';
import {
  createIndustry,
  listIndustries,
  getIndustryById,
  updateIndustry,
  findMatchedProjectsForIndustry,
} from '../services/industry.service.js';

export const create = asyncHandler(async (req, res) => {
  const industry = await createIndustry(req.user, req.body);
  res.status(201).json({ success: true, message: 'Industry profile created', industry });
});

export const list = asyncHandler(async (req, res) => {
  const data = await listIndustries(req.query);
  res.json({ success: true, ...data });
});

export const getById = asyncHandler(async (req, res) => {
  const industry = await getIndustryById(req.params.id, req.user);
  res.json({ success: true, industry });
});

export const update = asyncHandler(async (req, res) => {
  const industry = await updateIndustry(req.params.id, req.user, req.body);
  res.json({ success: true, message: 'Profile updated', industry });
});

export const matchedProjects = asyncHandler(async (req, res) => {
  const projects = await findMatchedProjectsForIndustry(req.params.id, req.user);
  res.json({ success: true, projects });
});
