import University from '../models/University.js';
import Challenge from '../models/Challenge.js';

import ApiError from '../utils/ApiError.js';

function sanitizeProfileInput(body, { partial = false } = {}) {
  const fields = [
    'name',
    'description',
    'logo',
    'address',
    'districtsCovered',
    'departments',
    'researchAreas',
    'expertise',
    'facilities',
    'facultyMembers',
    'previousProjects',
    'contactInformation',
  ];

  const payload = {};
  for (const field of fields) {
    if (body[field] !== undefined) payload[field] = body[field];
  }

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!partial || name) {
      if (!name) throw new ApiError(400, 'Name cannot be empty');
      payload.name = name;
    } else {
      delete payload.name;
    }
  }

  if (payload.location !== undefined) delete payload.location; // handled separately
  return payload;
}

export async function createUniversity(user, body) {
  if (!body.name || !String(body.name).trim()) {
    throw new ApiError(400, 'University name is required');
  }

  const existing = await University.findOne({ name: String(body.name).trim() });
  if (existing) throw new ApiError(409, 'A university with this name already exists');

  const university = await University.create({
    ...sanitizeProfileInput(body),
    location: body.location,
    createdBy: user._id,
  });

  return university;
}

export async function listUniversities(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  const filter = {};
  if (query.district) filter.districtsCovered = query.district;
  if (query.researchArea) filter.researchAreas = { $regex: query.researchArea, $options: 'i' };
  if (query.expertise) filter.expertise = { $regex: query.expertise, $options: 'i' };
  if (query.department) filter.departments = { $regex: query.department, $options: 'i' };
  if (query.verificationStatus && ['pending', 'verified', 'rejected'].includes(query.verificationStatus)) {
    filter.verificationStatus = query.verificationStatus;
  }

  const [universities, total] = await Promise.all([
    University.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-location'),
    University.countDocuments(filter),
  ]);

  return {
    universities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

export async function getUniversityById(id) {
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, 'Invalid university ID format');
  }
  const university = await University.findById(id).select('-location');
  if (!university) throw new ApiError(404, 'University not found');
  return university;
}

export async function updateUniversity(id, user, body) {
  const university = await getUniversityById(id);

  const isOwner =
    university.createdBy &&
    user._id.toString() === university.createdBy.toString();
  if (!isOwner && user.role !== 'admin') {
    throw new ApiError(403, 'You can only update your own university profile');
  }

  Object.assign(university, sanitizeProfileInput(body, { partial: true }));
  if (body.location !== undefined) university.location = body.location;
  await university.save();
  return university;
}

export async function listAssignedChallenges(universityId, user, query) {
  const university = await getUniversityById(universityId);
  const isOwner =
    university.createdBy && user._id.toString() === university.createdBy.toString();
  if (!isOwner && user.role !== 'admin') {
    throw new ApiError(403, 'Only this university or an admin can view its assigned challenges');
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  const filter = { assignedUniversity: university._id };
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.priority === 'high') filter.priorityScore = { $gte: 70 };
  else if (query.priority === 'medium') filter.priorityScore = { $gte: 40, $lt: 70 };
  else if (query.priority === 'low') filter.priorityScore = { $lt: 40 };

  const [challenges, total] = await Promise.all([
    Challenge.find(filter)
      .sort({ priorityScore: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('submittedBy', 'name')
      .select('title description category district severity status priorityScore aiSummary communityValidation createdAt assignedUniversity'),
    Challenge.countDocuments(filter),
  ]);

  return {
    challenges,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export function canManageUniversity(user, university) {
  return (
    user.role === 'admin' ||
    Boolean(university.createdBy && user._id.toString() === university.createdBy.toString())
  );
}
