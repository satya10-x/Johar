import mongoose from 'mongoose';

import Discussion, {
  DISCUSSION_STATUSES,
  REPORT_REASONS,
} from '../models/Discussion.js';
import Challenge from '../models/Challenge.js';

import ApiError from '../utils/ApiError.js';

const ALLOWED_RADIUS_KM = [1, 5, 10, 25];
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function validateLocation(location) {
  if (location === undefined || location === null) return;
  if (
    typeof location !== 'object' ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2 ||
    !location.coordinates.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
    location.coordinates[0] < -180 ||
    location.coordinates[0] > 180 ||
    location.coordinates[1] < -90 ||
    location.coordinates[1] > 90
  ) {
    throw new ApiError(
      400,
      'Invalid location. Expected GeoJSON Point: { coordinates: [longitude, latitude] }'
    );
  }
}

function assertValidStatus(status) {
  if (!DISCUSSION_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${DISCUSSION_STATUSES.join(', ')}`);
  }
}

function publicDiscussion(doc, { distanceMeters } = {}) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  // privacy: never expose exact coordinates, reports or raw participant ids
  delete obj.location;
  delete obj.reports;
  delete obj.participants;
  if (distanceMeters !== undefined) {
    const km = Math.round((distanceMeters / 1000) * 10) / 10;
    obj.approximateDistance = km < 0.1 ? '< 0.1 km away' : `${km} km away`;
  } else {
    obj.approximateDistance = null;
  }
  return obj;
}

export async function createDiscussion(user, body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  if (!title) throw new ApiError(400, 'Title is required');
  if (!description) throw new ApiError(400, 'Description is required');
  if (!body.category) throw new ApiError(400, 'Category is required');
  if (!body.district) throw new ApiError(400, 'District is required');
  validateLocation(body.location);

  let relatedChallenge;
  if (body.relatedChallenge) {
    relatedChallenge = await Challenge.findById(body.relatedChallenge).select('_id category district');
    if (!relatedChallenge) throw new ApiError(404, 'Related challenge not found');
  }

  const discussion = await Discussion.create({
    title,
    description,
    createdBy: user._id,
    district: String(body.district).trim(),
    category: body.category,
    relatedChallenge: relatedChallenge?._id,
    location: body.location || undefined,
    radius: ALLOWED_RADIUS_KM.includes(Number(body.radius)) ? Number(body.radius) : 5,
    language: body.language,
  });

  return publicDiscussion(discussion);
}

export async function listDiscussions(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  const filter = {};
  if (query.district) filter.district = query.district;
  if (query.category) filter.category = query.category;
  if (query.status && DISCUSSION_STATUSES.includes(query.status)) filter.status = query.status;
  else filter.status = { $ne: 'archived' };
  if (query.relatedChallenge && query.relatedChallenge.match(OBJECT_ID_RE)) {
    filter.relatedChallenge = query.relatedChallenge;
  }

  const [discussions, total] = await Promise.all([
    Discussion.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name')
      .populate('relatedChallenge', 'title category district'),
    Discussion.countDocuments(filter),
  ]);

  return {
    discussions: discussions.map((d) => publicDiscussion(d)),
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

export async function getNearbyDiscussions(query) {
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

  let radius = Number(query.radius);
  if (!ALLOWED_RADIUS_KM.includes(radius)) radius = 5;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  const match = {};
  if (query.category) match.category = query.category;
  if (query.district) match.district = query.district;
  if (query.status && DISCUSSION_STATUSES.includes(query.status)) match.status = query.status;
  else match.status = { $ne: 'archived' };

  const [docs, totalDoc] = await Promise.all([
    Discussion.aggregate([
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
      { $sort: { distanceMeters: 1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      {
        $lookup: {
          from: 'challenges',
          localField: 'relatedChallenge',
          foreignField: '_id',
          as: 'challenge',
        },
      },
      {
        $project: {
          title: 1,
          description: { $substrCP: ['$description', 0, 220] },
          category: 1,
          district: 1,
          status: 1,
          language: 1,
          participantCount: 1,
          commentCount: { $size: '$comments' },
          createdAt: 1,
          relatedChallengeId: { $arrayElemAt: ['$challenge._id', 0] },
          relatedChallengeTitle: { $arrayElemAt: ['$challenge.title', 0] },
          creatorName: { $arrayElemAt: ['$creator.name', 0] },
          distanceMeters: 1,
        },
      },
    ]),
    Discussion.aggregate([
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
      { $count: 'total' },
    ]),
  ]);

  return {
    discussions: docs.map((d) => ({
      _id: d._id,
      title: d.title,
      shortDescription: d.description,
      category: d.category,
      district: d.district,
      status: d.status,
      language: d.language,
      approximateLocation: `Near ${d.district}`,
      approximateDistance:
        Math.round(d.distanceMeters) < 100
          ? '< 0.1 km away'
          : `${Math.round((d.distanceMeters / 1000) * 10) / 10} km away`,
      participantCount: d.participantCount,
      commentCount: d.commentCount,
      creatorName: d.creatorName,
      relatedChallenge: d.relatedChallengeId
        ? { _id: d.relatedChallengeId, title: d.relatedChallengeTitle }
        : null,
      createdAt: d.createdAt,
    })),
    search: { latitude, longitude, radiusKm: radius },
    pagination: {
      page,
      limit,
      total: totalDoc[0]?.total || 0,
      totalPages: Math.ceil((totalDoc[0]?.total || 0) / limit) || 1,
      hasNextPage: page * limit < (totalDoc[0]?.total || 0),
      hasPrevPage: page > 1,
    },
  };
}

async function getDiscussionOr404(id) {
  const idStr = String(id || '');
  if (!idStr.match(OBJECT_ID_RE)) throw new ApiError(400, 'Invalid discussion ID format');
  const discussion = await Discussion.findById(idStr)
    .populate('createdBy', 'name')
    .populate('relatedChallenge', 'title category district')
    .populate('comments.user', 'name role');
  if (!discussion) throw new ApiError(404, 'Discussion not found');
  return discussion;
}

function canModerate(user) {
  return Boolean(user && user.role === 'admin');
}

function canManage(user, discussion) {
  if (!user) return false;
  return canModerate(user) || discussion.createdBy._id.toString() === user._id.toString();
}

export async function getDiscussionById(id, user) {
  const discussion = await getDiscussionOr404(id);
  const obj = publicDiscussion(discussion);
  obj.approximateLocation = `Near ${discussion.district}`;
  obj.canManage = canManage(user, discussion);
  if (user) {
    obj.hasJoined = (discussion.participants || []).some(
      (p) => p.toString() === user._id.toString()
    );
  } else {
    obj.hasJoined = false;
  }
  if (canModerate(user)) {
    obj.reportCount = discussion.reports.length;
  }
  return obj;
}

// ---------- comments ----------

export async function addComment(user, id, body) {
  const text = String(body.text || '').trim();
  if (!text) throw new ApiError(400, 'Comment text is required');

  const discussion = await getDiscussionOr404(id);
  if (discussion.status !== 'active') {
    throw new ApiError(400, 'This discussion is no longer active');
  }

  discussion.comments.push({ user: user._id, text });
  await discussion.save();

  const added = discussion.comments[discussion.comments.length - 1];
  return { _id: added._id, text: added.text, createdAt: added.createdAt, user: { _id: user._id, name: user.name } };
}

export async function listComments(id, query) {
  const discussion = await getDiscussionOr404(id);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));

  const sorted = [...discussion.comments].sort(
    (a, b) => b.createdAt - a.createdAt
  );
  const slice = sorted.slice((page - 1) * limit, page * limit);

  return {
    comments: slice.map((c) => ({
      _id: c._id,
      text: c.text,
      createdAt: c.createdAt,
      user: c.user ? { _id: c.user._id, name: c.user.name, role: c.user.role } : null,
    })),
    total: sorted.length,
    pagination: {
      page,
      limit,
      total: sorted.length,
      totalPages: Math.ceil(sorted.length / limit) || 1,
      hasNextPage: page * limit < sorted.length,
      hasPrevPage: page > 1,
    },
  };
}

// ---------- participation ----------

export async function joinDiscussion(user, id) {
  const idStr = String(id || '');
  if (!idStr.match(OBJECT_ID_RE)) throw new ApiError(400, 'Invalid discussion ID format');
  const discussion = await Discussion.findById(idStr).select('status participants participantCount');
  if (!discussion) throw new ApiError(404, 'Discussion not found');
  if (discussion.status !== 'active') {
    throw new ApiError(400, 'This discussion is no longer active');
  }

  const result = await Discussion.updateOne(
    { _id: discussion._id, participants: { $ne: user._id } },
    { $addToSet: { participants: user._id }, $inc: { participantCount: 1 } }
  );
  if (result.modifiedCount === 0) {
    throw new ApiError(409, 'You have already joined this discussion');
  }
  return { joined: true, participantCount: discussion.participantCount + 1 };
}

export async function leaveDiscussion(user, id) {
  const idStr = String(id || '');
  if (!idStr.match(OBJECT_ID_RE)) throw new ApiError(400, 'Invalid discussion ID format');
  const discussion = await Discussion.findById(idStr).select('participants participantCount');
  if (!discussion) throw new ApiError(404, 'Discussion not found');

  const result = await Discussion.updateOne(
    { _id: discussion._id, participants: user._id },
    { $pull: { participants: user._id }, $inc: { participantCount: -1 } }
  );
  if (result.modifiedCount === 0) {
    throw new ApiError(404, 'You are not a participant of this discussion');
  }
  return { joined: false, participantCount: Math.max(0, discussion.participantCount - 1) };
}

// ---------- reporting ----------

export async function reportDiscussion(user, id, body) {
  const { reason, details } = body;
  if (!REPORT_REASONS.includes(reason)) {
    throw new ApiError(400, `reason must be one of: ${REPORT_REASONS.join(', ')}`);
  }

  const idStr = String(id || '');
  if (!idStr.match(OBJECT_ID_RE)) throw new ApiError(400, 'Invalid discussion ID format');
  const discussion = await Discussion.findById(idStr).select('reports');
  if (!discussion) throw new ApiError(404, 'Discussion not found');

  if (discussion.reports.some((r) => r.reportedBy.toString() === user._id.toString())) {
    throw new ApiError(409, 'You have already reported this discussion');
  }

  discussion.reports.push({
    reportedBy: user._id,
    reason,
    details: details?.trim() || undefined,
  });
  await discussion.save();
}

// ---------- update / delete / moderation ----------

export async function updateDiscussion(id, user, body) {
  const discussion = await getDiscussionOr404(id);
  if (!canManage(user, discussion)) {
    throw new ApiError(403, 'Only the creator or an admin can update this discussion');
  }

  const isAdmin = canModerate(user);
  const isCreator = discussion.createdBy._id.toString() === user._id.toString();

  // status changes
  if (body.status !== undefined && body.status !== discussion.status) {
    assertValidStatus(body.status);
    if (isAdmin) {
      discussion.status = body.status; // admins may close/archive anything
    } else if (isCreator && ['closed', 'active'].includes(body.status)) {
      discussion.status = body.status; // creators may close/reopen their own
    } else {
      throw new ApiError(403, 'Not allowed to set this status');
    }
  }

  if (isCreator || isAdmin) {
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (!t) throw new ApiError(400, 'Title cannot be empty');
      discussion.title = t;
    }
    if (body.description !== undefined) {
      const d = String(body.description).trim();
      if (!d) throw new ApiError(400, 'Description cannot be empty');
      discussion.description = d;
    }
    if (body.category !== undefined) discussion.category = body.category;
    if (body.language !== undefined) discussion.language = body.language;
  }

  if (body.location !== undefined) {
    validateLocation(body.location);
    discussion.location = body.location || undefined;
  }

  await discussion.save();
  return getDiscussionById(id, user);
}

export async function deleteDiscussion(id, user) {
  const discussion = await getDiscussionOr404(id);
  if (!canManage(user, discussion)) {
    throw new ApiError(403, 'Only the creator or an admin can delete this discussion');
  }
  await discussion.deleteOne();
}
