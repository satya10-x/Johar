import CommunityValidation, { VALIDATION_TYPES } from '../models/CommunityValidation.js';
import Challenge from '../models/Challenge.js';

import ApiError from '../utils/ApiError.js';

const DISPUTE_MIN_COMMENT = 10;

export async function addValidation(challengeId, user, body) {
  const { type, comment, evidence } = body;

  if (!VALIDATION_TYPES.includes(type)) {
    throw new ApiError(400, `Type must be one of: ${VALIDATION_TYPES.join(', ')}`);
  }
  if (type === 'dispute' && (!comment || comment.trim().length < DISPUTE_MIN_COMMENT)) {
    throw new ApiError(400, 'A short reason (at least 10 characters) is required to dispute');
  }

  const challengeExists = await Challenge.exists({ _id: challengeId });
  if (!challengeExists) throw new ApiError(404, 'Challenge not found');

  const existing = await CommunityValidation.findOne({
    challenge: challengeId,
    user: user._id,
    type,
  });
  if (existing) {
    throw new ApiError(
      409,
      `You have already ${type === 'support' ? 'supported' : type === 'dispute' ? 'disputed' : 'commented on'} this challenge`
    );
  }

  const validation = await CommunityValidation.create({
    challenge: challengeId,
    user: user._id,
    type,
    comment: comment?.trim(),
    evidence: Array.isArray(evidence) ? evidence.filter((e) => typeof e === 'string') : [],
  });

  const counterField =
    type === 'support' ? 'supportCount' : type === 'dispute' ? 'disputeCount' : 'commentCount';

  await Challenge.updateOne(
    { _id: challengeId },
    { $inc: { [`communityValidation.${counterField}`]: 1 } }
  );

  return validation;
}

export async function listValidations(challengeId, query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));

  const [validations, total] = await Promise.all([
    CommunityValidation.find({ challenge: challengeId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name'),
    CommunityValidation.countDocuments({ challenge: challengeId }),
  ]);

  return {
    validations: validations.map((v) => ({
      _id: v._id,
      type: v.type,
      comment: v.comment || null,
      evidence: v.evidence,
      userName: v.user?.name || 'Anonymous',
      createdAt: v.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function removeValidation(challengeId, user, type) {
  if (type && !VALIDATION_TYPES.includes(type)) {
    throw new ApiError(400, `Type must be one of: ${VALIDATION_TYPES.join(', ')}`);
  }

  const filter = { challenge: challengeId, user: user._id };
  if (type) filter.type = type;

  const removed = await CommunityValidation.find(filter);
  if (!removed.length) {
    throw new ApiError(404, 'No validation of yours found for this challenge');
  }

  await CommunityValidation.deleteMany(filter);

  for (const item of removed) {
    const counterField =
      item.type === 'support'
        ? 'supportCount'
        : item.type === 'dispute'
          ? 'disputeCount'
          : 'commentCount';
    await Challenge.updateOne(
      { _id: challengeId },
      { $inc: { [`communityValidation.${counterField}`]: -1 } }
    );
  }
}
