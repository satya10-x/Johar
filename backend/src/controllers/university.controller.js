import asyncHandler from '../utils/asyncHandler.js';
import {
  createUniversity,
  listUniversities,
  getUniversityById,
  updateUniversity,
  listAssignedChallenges,
} from '../services/university.service.js';

export const create = asyncHandler(async (req, res) => {
  const university = await createUniversity(req.user, req.body);
  res.status(201).json({ success: true, message: 'University profile created', university });
});

export const list = asyncHandler(async (req, res) => {
  const data = await listUniversities(req.query);
  res.json({ success: true, ...data });
});

export const getById = asyncHandler(async (req, res) => {
  const university = await getUniversityById(req.params.id);
  // hide contact details from anonymous visitors
  const obj = university.toObject();
  if (!req.user) delete obj.contactInformation;
  res.json({ success: true, university: obj });
});

export const update = asyncHandler(async (req, res) => {
  const university = await updateUniversity(req.params.id, req.user, req.body);
  res.json({ success: true, message: 'Profile updated', university });
});

export const assignedChallenges = asyncHandler(async (req, res) => {
  const data = await listAssignedChallenges(req.params.id, req.user, req.query);
  res.json({ success: true, ...data });
});
