import Challenge, {
  CHALLENGE_CATEGORIES,
  CHALLENGE_STATUSES,
} from '../models/Challenge.js';
import mongoose from 'mongoose';

import ApiError from '../utils/ApiError.js';
import { deleteMedia } from './media.service.js';
import { analyzeChallenge } from './groqService.js';
import { queueDuplicateCheck } from './duplicate.service.js';
import University from '../models/University.js';
import Project from '../models/Project.js';
import { findUniversityMatchesForChallenge } from './matching.service.js';

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const LANGUAGES = ['en', 'hi', 'bn', 'od', 'san', 'nag', 'kur', 'ho', 'mundari'];

function validateLocation(location) {
  if (location === undefined || location === null) return;
  if (
    typeof location !== 'object' ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2 ||
    !location.coordinates.every(
      (n) => typeof n === 'number' && n >= -180 && n <= 180
    ) ||
    location.coordinates[1] < -90 ||
    location.coordinates[1] > 90
  ) {
    throw new ApiError(
      400,
      'Invalid location. Expected GeoJSON Point: { coordinates: [longitude, latitude] }'
    );
  }
}

function assertValidSeverity(severity) {
  if (severity !== undefined && !SEVERITIES.includes(severity)) {
    throw new ApiError(400, `Severity must be one of: ${SEVERITIES.join(', ')}`);
  }
}

function buildCreatePayload(body) {
  const payload = {
    title: body.title?.trim(),
    description: body.description?.trim(),
    category: body.category,
    district: body.district?.trim(),
    submittedBy: undefined,
  };

  if (!payload.title) throw new ApiError(400, 'Title is required');
  if (!payload.description) throw new ApiError(400, 'Description is required');
  if (!payload.category || !CHALLENGE_CATEGORIES.includes(payload.category)) {
    throw new ApiError(400, `Category must be one of: ${CHALLENGE_CATEGORIES.join(', ')}`);
  }
  if (!payload.district) throw new ApiError(400, 'District is required');
  assertValidSeverity(body.severity);
  validateLocation(body.location);

  if (body.subCategory !== undefined) payload.subCategory = String(body.subCategory).trim();
  if (body.severity !== undefined) payload.severity = body.severity;
  if (body.location !== undefined && body.location) {
    const coords = body.location.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      throw new ApiError(
        400,
        'Invalid location. Expected GeoJSON Point: { coordinates: [longitude, latitude] }'
      );
    }
    // store only ~110 m precision
    payload.location = {
      type: 'Point',
      coordinates: [
        Math.round(Number(coords[0]) * 1000) / 1000,
        Math.round(Number(coords[1]) * 1000) / 1000,
      ],
    };
  }
  if (body.address !== undefined) payload.address = String(body.address).trim();
  if (body.language !== undefined) {
    if (!LANGUAGES.includes(body.language)) throw new ApiError(400, 'Unsupported language');
    payload.language = body.language;
  }
  if (body.affectedPopulation !== undefined) {
    const pop = Number(body.affectedPopulation);
    if (!Number.isFinite(pop) || pop < 0) throw new ApiError(400, 'Invalid affectedPopulation');
    payload.affectedPopulation = pop;
  }
  if (body.tags !== undefined) {
    payload.tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
      : [];
  }
  if (body.voiceInput !== undefined) {
    let vi = body.voiceInput;
    if (typeof vi === 'string') {
      try {
        vi = JSON.parse(vi);
      } catch {
        vi = null;
      }
    }
    if (vi && typeof vi === 'object') {
      payload.voiceInput = {
        enabled: Boolean(vi.enabled),
        audioUrl: vi.audioUrl ? String(vi.audioUrl).trim() : undefined,
        originalTranscript: vi.originalTranscript ? String(vi.originalTranscript).trim() : undefined,
        originalLanguage: vi.originalLanguage ? String(vi.originalLanguage).trim() : undefined,
        standardizedText: vi.standardizedText ? String(vi.standardizedText).trim() : undefined,
        standardizedLanguage: vi.standardizedLanguage ? String(vi.standardizedLanguage).trim() : undefined,
      };
    }
  }

  return payload;
}

export async function createChallenge(user, body, media = {}) {
  const payload = buildCreatePayload(body);
  payload.submittedBy = user._id;

  const challenge = await Challenge.create({
    ...payload,
    images: media.images || [],
    videos: media.videos || [],
    documents: media.documents || [],
  });

  queueAiAnalysis(challenge._id);

  return challenge;
}

export function getDuplicateCheck(challenge) {
  return challenge.duplicateCheck
    ? {
        isDuplicate: challenge.duplicateCheck.isDuplicate,
        confidence: challenge.duplicateCheck.confidence,
        checkedAt: challenge.duplicateCheck.checkedAt,
        similarChallenges: (challenge.duplicateCheck.similarChallenges || []).map((s) => ({
          challengeId: s.challenge,
          title: s.title,
          district: s.district,
          distance: s.distanceLabel,
          similarity: s.similarity,
          reason: s.reason,
        })),
      }
    : null;
}

export function queueAiAnalysis(challengeId) {
  setImmediate(() => {
    runAiAnalysis(challengeId).catch((err) => {
      console.error(`[ai] background analysis failed for ${challengeId}: ${err.message}`);
    });
  });
}

export async function runAiAnalysis(challengeId) {
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) throw new ApiError(404, 'Challenge not found');

  challenge.aiStatus = 'processing';
  challenge.aiError = undefined;
  await challenge.save();

  try {
    const analysis = await analyzeChallenge({
      title: challenge.title,
      description: challenge.description,
      category: challenge.category,
      district: challenge.district,
      affectedPopulation: challenge.affectedPopulation,
    });

    challenge.aiStatus = 'completed';
    challenge.aiSummary = analysis.summary;
    challenge.aiClassification = analysis;
    challenge.priorityScore = analysis.priorityScore;
    challenge.skillsRequired = analysis.skillsRequired.length
      ? analysis.skillsRequired
      : challenge.skillsRequired;
    challenge.aiAnalyzedAt = new Date();
    challenge.aiError = undefined;
  } catch (err) {
    challenge.aiStatus = 'failed';
    challenge.aiError = err.message.slice(0, 300);
    throw err;
  } finally {
    await challenge.save();
  }

  return challenge;
}

function roundCoordinates(location) {
  if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    return undefined;
  }
  // ~110 m precision — enough for maps, never an exact citizen location
  return {
    type: 'Point',
    coordinates: [
      Math.round(location.coordinates[0] * 1000) / 1000,
      Math.round(location.coordinates[1] * 1000) / 1000,
    ],
  };
}

export async function listChallenges(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  const filter = {};
  if (query.category) filter.category = query.category;
  if (query.district) filter.district = query.district;
  if (query.status && CHALLENGE_STATUSES.includes(query.status)) filter.status = query.status;
  else if (query.status === 'active') filter.status = { $nin: ['resolved', 'rejected'] };
  if (query.severity && SEVERITIES.includes(query.severity)) filter.severity = query.severity;

  const [challenges, total] = await Promise.all([
    Challenge.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('submittedBy', 'name'),
    Challenge.countDocuments(filter),
  ]);

  const safeChallenges = challenges.map((c) => {
    const obj = c.toObject();
    obj.location = roundCoordinates(c.location);
    return obj;
  });

  return {
    challenges: safeChallenges,
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

export async function listMyChallenges(userId, query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  const filter = { submittedBy: userId };

  const [challenges, total] = await Promise.all([
    Challenge.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-location'),
    Challenge.countDocuments(filter),
  ]);

  return {
    challenges,
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

export async function getPlatformStats() {
  const [reported, active, beingSolved, resolved, districts] = await Promise.all([
    Challenge.countDocuments({}),
    Challenge.countDocuments({ status: { $nin: ['resolved', 'rejected'] } }),
    Challenge.countDocuments({ status: { $in: ['assigned', 'in_progress'] } }),
    Challenge.countDocuments({ status: 'resolved' }),
    Challenge.distinct('district'),
  ]);

  return {
    problemsReported: reported,
    activeProblems: active,
    problemsBeingSolved: beingSolved,
    solutionsCreated: resolved,
    communitiesInvolved: districts.filter(Boolean).length,
  };
}

export async function getChallengeById(id) {
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, 'Invalid challenge ID format');
  }

  const challenge = await Challenge.findById(id)
    .populate('submittedBy', 'name');

  if (!challenge) throw new ApiError(404, 'Challenge not found');
  const obj = challenge.toObject();
  obj.location = roundCoordinates(challenge.location);
  // linked solution project (public summary) for the Challenge → Project flow
  obj.solutionProject = await Project.findOne({ challenge: challenge._id })
    .select('title status currentProgress university')
    .populate('university', 'name')
    .lean();
  // linked Local Samvaad discussion, if any
  const Discussion = mongoose.model('Discussion');
  obj.relatedDiscussion = await Discussion.findOne({
    relatedChallenge: challenge._id,
    status: { $ne: 'archived' },
  })
    .select('title participantCount district')
    .lean();
  return obj;
}

const ALLOWED_RADIUS_KM = [1, 5, 10, 25];
const NEARBY_LIMIT = 50;

function parseCoordinates(query) {
  const latitude = Number(query.latitude);
  const longitude = Number(query.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new ApiError(400, 'Valid latitude and longitude are required');
  }
  return { latitude, longitude };
}

export async function findNearbyChallenges(query) {
  const { latitude, longitude } = parseCoordinates(query);
  let radius = Number(query.radius);
  if (!ALLOWED_RADIUS_KM.includes(radius)) radius = 5;

  const match = {};
  if (query.category && CHALLENGE_CATEGORIES.includes(query.category)) {
    match.category = query.category;
  }
  if (query.severity && ['low', 'medium', 'high', 'critical'].includes(query.severity)) {
    match.severity = query.severity;
  }
  if (query.status === 'active') match.status = { $nin: ['resolved', 'rejected'] };
  else if (CHALLENGE_STATUSES.includes(query.status)) match.status = query.status;

  const results = await Challenge.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [longitude, latitude] },
        distanceField: 'distanceMeters',
        maxDistance: radius * 1000,
        query: match,
        spherical: true,
        key: 'location',
      },
    },
    { $sort: { distanceMeters: 1 } },
    { $limit: NEARBY_LIMIT },
    {
      $project: {
        title: 1,
        category: 1,
        severity: 1,
        status: 1,
        district: 1,
        address: 1,
        priorityScore: 1,
        supportCount: '$communityValidation.supportCount',
        location: 1,
        distanceMeters: 1,
      },
    },
  ]);

  return results.map((c) => ({
    _id: c._id,
    title: c.title,
    category: c.category,
    severity: c.severity,
    status: c.status,
    district: c.district,
    address: c.address || null,
    supportCount: c.supportCount || 0,
    priorityScore: c.priorityScore ?? 0,
    distanceKm:
      Math.round((c.distanceMeters / 1000) * 10) / 10 < 0.1
        ? Math.round(c.distanceMeters)
        : Math.round((c.distanceMeters / 1000) * 10) / 10,
    approximateLocation: `Near ${c.district}`,
    coordinates: roundCoordinates(c.location)?.coordinates || null,
  }));
}

export async function getAreaSummary({ district, latitude, longitude, radius }) {
  let docs;
  if (district) {
    docs = await Challenge.find(
      { district },
      { category: 1, severity: 1 }
    ).lean();
  } else {
    const coords = parseCoordinates({ latitude, longitude });
    let maxDistance = Number(radius);
    if (![1, 5, 10, 25].includes(maxDistance)) maxDistance = 5;
    docs = await Challenge.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [coords.longitude, coords.latitude] },
          distanceField: 'd',
          maxDistance: maxDistance * 1000,
          spherical: true,
          key: 'location',
        },
      },
      { $project: { category: 1, severity: 1 } },
    ]);
  }

  const byCategory = {};
  let highCritical = 0;
  for (const doc of docs) {
    byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
    if (doc.severity === 'high' || doc.severity === 'critical') highCritical += 1;
  }

  return {
    total: docs.length,
    highCritical,
    topCategories: Object.entries(byCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

const UPDATABLE_FIELDS = [
  'title',
  'description',
  'category',
  'subCategory',
  'district',
  'language',
  'affectedPopulation',
  'severity',
  'tags',
];

export async function updateChallenge(id, user, body) {
  const challenge = await getChallengeById(id);

  if (challenge.submittedBy._id.toString() !== user._id.toString() && user.role !== 'admin') {
    throw new ApiError(403, 'You can only update your own challenges');
  }

  const updates = {};

  if (body.title !== undefined) {
    if (!String(body.title).trim()) throw new ApiError(400, 'Title cannot be empty');
    updates.title = String(body.title).trim();
  }
  if (body.description !== undefined) {
    if (!String(body.description).trim()) throw new ApiError(400, 'Description cannot be empty');
    updates.description = String(body.description).trim();
  }
  if (body.category !== undefined) {
    if (!CHALLENGE_CATEGORIES.includes(body.category)) {
      throw new ApiError(400, `Category must be one of: ${CHALLENGE_CATEGORIES.join(', ')}`);
    }
    updates.category = body.category;
  }
  if (body.district !== undefined) {
    if (!String(body.district).trim()) throw new ApiError(400, 'District cannot be empty');
    updates.district = String(body.district).trim();
  }
  if (body.subCategory !== undefined) updates.subCategory = String(body.subCategory).trim();
  if (body.severity !== undefined) {
    assertValidSeverity(body.severity);
    updates.severity = body.severity;
  }
  if (body.language !== undefined) {
    if (!LANGUAGES.includes(body.language)) throw new ApiError(400, 'Unsupported language');
    updates.language = body.language;
  }
  if (body.affectedPopulation !== undefined) {
    const pop = Number(body.affectedPopulation);
    if (!Number.isFinite(pop) || pop < 0) throw new ApiError(400, 'Invalid affectedPopulation');
    updates.affectedPopulation = pop;
  }
  if (body.tags !== undefined) {
    updates.tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
      : [];
  }
  if (body.location !== undefined) {
    validateLocation(body.location);
    updates.location = body.location ? { ...body.location } : undefined;
  }

  Object.assign(challenge, updates);
  await challenge.save();
  return challenge;
}

export async function deleteChallenge(id, user) {
  const challenge = await getChallengeById(id);

  if (challenge.submittedBy._id.toString() !== user._id.toString() && user.role !== 'admin') {
    throw new ApiError(403, 'You can only delete your own challenges');
  }

  const publicIds = [...challenge.images, ...challenge.videos, ...challenge.documents]
    .map((m) => m.publicId)
    .filter(Boolean);

  await Promise.allSettled([
    challenge.deleteOne(),
    deleteMedia(publicIds),
  ]);
}

export async function assignUniversity(challengeId, user, universityId) {
  const university = await University.findById(universityId);
  if (!university) throw new ApiError(404, 'University not found');

  const challenge = await Challenge.findById(challengeId);
  if (!challenge) throw new ApiError(404, 'Challenge not found');

  const isThisUniversity =
    user.role === 'university' &&
    university.createdBy &&
    university.createdBy.toString() === user._id.toString();

  // citizens (even the reporter) cannot assign; only admins or the university itself
  if (user.role !== 'admin' && !isThisUniversity) {
    throw new ApiError(403, 'Not allowed to assign this challenge');
  }

  challenge.assignedUniversity = university._id;
  challenge.status = 'assigned';
  await challenge.save();
  return challenge;
}

const INTEREST_LEVELS = ['interested', 'needs_more_information', 'not_interested'];

export async function saveUniversityResponse(challengeId, user, body) {
  const { response, interestLevel, estimatedTimeline, requiredResources } = body;

  if (!INTEREST_LEVELS.includes(interestLevel)) {
    throw new ApiError(
      400,
      `interestLevel must be one of: ${INTEREST_LEVELS.join(', ')}`
    );
  }
  if (!response || !String(response).trim()) {
    throw new ApiError(400, 'A short response is required');
  }

  const challenge = await Challenge.findById(challengeId).populate('assignedUniversity');
  if (!challenge) throw new ApiError(404, 'Challenge not found');
  if (!challenge.assignedUniversity) {
    throw new ApiError(400, 'No university is assigned to this challenge yet');
  }

  const uni = challenge.assignedUniversity;
  const isAssignedUniversity =
    uni.createdBy && uni.createdBy._id
      ? uni.createdBy._id.toString() === user._id.toString()
      : uni.createdBy?.toString() === user._id.toString();

  if (!isAssignedUniversity && user.role !== 'admin') {
    throw new ApiError(403, 'Only the assigned university can respond to this challenge');
  }

  challenge.universityResponses.push({
    university: uni._id,
    response: String(response).trim(),
    interestLevel,
    estimatedTimeline: estimatedTimeline ? String(estimatedTimeline).trim() : undefined,
    requiredResources: Array.isArray(requiredResources)
      ? requiredResources.map((r) => String(r)).slice(0, 10)
      : [],
  });
  await challenge.save();
  return challenge;
}

export function getUniversityMatchesForChallenge(challengeId, force) {
  return findUniversityMatchesForChallenge(challengeId, { force });
}
