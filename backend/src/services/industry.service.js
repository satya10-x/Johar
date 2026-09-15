import Industry from '../models/Industry.js';
import Project from '../models/Project.js';

import ApiError from '../utils/ApiError.js';

export async function createIndustry(user, body) {
  if (!body.companyName || !String(body.companyName).trim()) {
    throw new ApiError(400, 'Company name is required');
  }
  const existing = await Industry.findOne({ companyName: String(body.companyName).trim() });
  if (existing) throw new ApiError(409, 'An industry with this name already exists');

  return Industry.create({
    ...body,
    createdBy: user._id,
  });
}

export async function listIndustries(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  const filter = {};
  if (query.district) filter.address = { $regex: query.district, $options: 'i' };
  if (query.companyType) filter.companyType = query.companyType;
  if (query.industry) filter.industries = { $regex: query.industry, $options: 'i' };
  if (query.expertise) filter.expertise = { $regex: query.expertise, $options: 'i' };
  if (query.technology) filter.technologies = { $regex: query.technology, $options: 'i' };
  if (
    query.verificationStatus &&
    ['pending', 'verified', 'rejected'].includes(query.verificationStatus)
  ) {
    filter.verificationStatus = query.verificationStatus;
  }

  const [industries, total] = await Promise.all([
    Industry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-location'),
    Industry.countDocuments(filter),
  ]);

  return {
    industries,
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

export async function getIndustryById(id, user) {
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, 'Invalid industry ID format');
  }
  const industry = await Industry.findById(id).select('-location');
  if (!industry) throw new ApiError(404, 'Industry not found');

  const obj = industry.toObject();
  // contact details and funding capacity only for authenticated users;
  // full fundingCapacity only for the owner or admin
  if (!user) {
    delete obj.contactInformation;
    delete obj.fundingCapacity;
  } else if (user.role !== 'admin' && industry.createdBy?.toString() !== user._id.toString()) {
    delete obj.fundingCapacity;
  }
  return obj;
}

function sanitizeProfileUpdate(body) {
  const allowed = [
    'description',
    'logo',
    'address',
    'industries',
    'expertise',
    'technologies',
    'collaborationTypes',
    'fundingCapacity',
    'previousCollaborations',
    'contactInformation',
  ];
  const payload = {};
  for (const field of allowed) {
    if (body[field] !== undefined) payload[field] = body[field];
  }
  if (body.location !== undefined) payload.location = body.location;
  return payload;
}

export async function updateIndustry(id, user, body) {
  const industry = await Industry.findById(id);
  if (!industry) throw new ApiError(404, 'Industry not found');

  const isOwner =
    industry.createdBy && industry.createdBy.toString() === user._id.toString();
  if (!isOwner && user.role !== 'admin') {
    throw new ApiError(403, 'You can only update your own industry profile');
  }

  Object.assign(industry, sanitizeProfileUpdate(body));
  await industry.save();
  return industry;
}

export function canManageIndustry(user, industry) {
  return (
    user.role === 'admin' ||
    Boolean(industry.createdBy && user._id.toString() === industry.createdBy.toString())
  );
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'into']);

function keywordsOf(text, arrays) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z\u0900-\u097F\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const terms = [...words];
  for (const arr of arrays) {
    for (const item of arr || []) {
      terms.push(String(item).toLowerCase());
      for (const part of String(item).toLowerCase().split(/[\s_/]+/)) {
        if (part.length > 3 && !STOPWORDS.has(part)) terms.push(part);
      }
    }
  }
  return new Set(terms);
}

export async function findMatchedProjectsForIndustry(industryId, user) {
  const industry = await Industry.findById(industryId);
  if (!industry) throw new ApiError(404, 'Industry not found');

  const isOwner = industry.createdBy?.toString() === user._id.toString();
  if (!isOwner && user.role !== 'admin') {
    throw new ApiError(403, 'Only this industry or an admin can view its matched projects');
  }

  const projects = await Project.find({
    status: { $nin: ['completed', 'cancelled'] },
  })
    .populate('challenge', 'category district')
    .populate('university', 'name')
    .select('title description objectives technologies outcomes status challenge university currentProgress')
    .limit(50)
    .lean();

  const industryTerms = keywordsOf(null, [
    industry.industries,
    industry.expertise,
    industry.technologies,
    industry.collaborationTypes,
    [industry.companyType],
  ]);

  const scored = projects
    .map((p) => {
      const projectTerms = keywordsOf(
        `${p.title} ${p.description} ${(p.objectives || []).join(' ')} ${(p.technologies || []).join(' ')}`,
        [[p.challenge?.category]]
      );

      let overlap = 0;
      for (const term of projectTerms) {
        if (industryTerms.has(term)) overlap += 1;
      }

      let score = Math.min(90, overlap * 12);
      const matchingAreas = [];
      for (const tech of industry.technologies || []) {
        if (projectTerms.has(String(tech).toLowerCase())) matchingAreas.push(tech);
      }
      for (const exp of industry.expertise || []) {
        if (projectTerms.has(String(exp).toLowerCase())) matchingAreas.push(exp);
      }

      return {
        projectId: p._id,
        title: p.title,
        challengeCategory: p.challenge?.category,
        district: p.challenge?.district,
        university: p.university?.name,
        status: p.status,
        matchScore: Math.min(100, score),
        matchingAreas: [...new Set(matchingAreas)].slice(0, 4),
      };
    })
    .filter((p) => p.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 20);

  return scored;
}
