import asyncHandler from '../utils/asyncHandler.js';
import Challenge from '../models/Challenge.js';
import Project from '../models/Project.js';
import {
  createChallenge,
  listChallenges,
  listMyChallenges,
  getPlatformStats,
  findNearbyChallenges,
  getAreaSummary,
  getChallengeById,
  updateChallenge,
  deleteChallenge,
  runAiAnalysis,
  getDuplicateCheck,
  assignUniversity,
  saveUniversityResponse,
  getUniversityMatchesForChallenge,
} from '../services/challenge.service.js';
import { queueDuplicateCheck } from '../services/duplicate.service.js';
import {
  addValidation,
  listValidations,
  removeValidation,
} from '../services/validation.service.js';

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);

export const create = asyncHandler(async (req, res) => {
  const media = req.files || {};
  const challenge = await createChallenge(req.user, req.body, media);

  // Duplicate detection: wait briefly so the citizen can be warned, but never block creation.
  let duplicateCheck = null;
  if (!req.query.skipDuplicateCheck) {
    duplicateCheck = await withTimeout(queueDuplicateCheck(challenge._id), 15000);
    if (duplicateCheck && !duplicateCheck.isDuplicate) duplicateCheck = null;
  }

  res.status(201).json({
    success: true,
    message: 'Challenge submitted',
    challenge,
    duplicateWarning: duplicateCheck
      ? {
          isDuplicate: true,
          confidence: duplicateCheck.confidence,
          similarChallenges: duplicateCheck.similarChallenges.map((s) => ({
            challengeId: s.challenge,
            title: s.title,
            district: s.district,
            distance: s.distanceLabel,
            similarity: s.similarity,
            reason: s.reason,
          })),
        }
      : null,
  });
});

export const list = asyncHandler(async (req, res) => {
  const data = await listChallenges(req.query);
  res.json({ success: true, ...data });
});

export const mine = asyncHandler(async (req, res) => {
  const data = await listMyChallenges(req.user._id, req.query);
  res.json({ success: true, ...data });
});

export const stats = asyncHandler(async (req, res) => {
  const stats = await getPlatformStats();
  res.json({ success: true, stats });
});

export const nearby = asyncHandler(async (req, res) => {
  const challenges = await findNearbyChallenges(req.query);
  res.json({ success: true, count: challenges.length, challenges });
});

export const areaSummary = asyncHandler(async (req, res) => {
  const summary = await getAreaSummary(req.query);
  res.json({ success: true, summary });
});

export const getById = asyncHandler(async (req, res) => {
  const challenge = await getChallengeById(req.params.id);
  const solutionProject = await Project.findOne({ challenge: req.params.id })
    .select('title status currentProgress')
    .lean();
  res.json({ success: true, challenge, solutionProject: solutionProject || null });
});

export const update = asyncHandler(async (req, res) => {
  const challenge = await updateChallenge(req.params.id, req.user, req.body);
  res.json({ success: true, message: 'Challenge updated', challenge });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteChallenge(req.params.id, req.user);
  res.json({ success: true, message: 'Challenge deleted' });
});

export const analyze = asyncHandler(async (req, res) => {
  const challenge = await getChallengeById(req.params.id);

  const isOwner = challenge.submittedBy._id.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    throw Object.assign(new Error('You can only analyze your own challenges'), { statusCode: 403 });
  }

  if (challenge.aiStatus === 'completed' && !req.query.force) {
    return res.json({
      success: true,
      message: 'Challenge already analyzed',
      challenge,
    });
  }

  try {
    const updated = await runAiAnalysis(challenge._id);
    res.json({ success: true, message: 'AI analysis completed', challenge: updated });
  } catch (err) {
    if (err.statusCode) throw err;
    throw Object.assign(new Error('AI analysis failed'), { statusCode: 502 });
  }
});

export const checkDuplicates = asyncHandler(async (req, res) => {
  const challenge = await getChallengeById(req.params.id);

  const isOwner = challenge.submittedBy._id.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    throw Object.assign(
      new Error('You can only check duplicates for your own challenges'),
      { statusCode: 403 }
    );
  }

  const cached = getDuplicateCheck(challenge);
  if (cached && !req.query.force) {
    return res.json({
      success: true,
      message: 'Cached duplicate check',
      duplicateCheck: cached,
    });
  }

  const result = await queueDuplicateCheck(challenge._id);
  if (!result) {
    throw Object.assign(new Error('Duplicate detection failed. Please try again later.'), {
      statusCode: 502,
    });
  }

  res.json({
    success: true,
    message: 'Duplicate check completed',
    duplicateCheck: {
      isDuplicate: result.isDuplicate,
      confidence: result.confidence,
      checkedAt: result.checkedAt,
      similarChallenges: result.similarChallenges.map((s) => ({
        challengeId: s.challenge,
        title: s.title,
        district: s.district,
        distance: s.distanceLabel,
        similarity: s.similarity,
        reason: s.reason,
      })),
    },
  });
});

export const validate = asyncHandler(async (req, res) => {
  const validation = await addValidation(req.params.id, req.user, req.body);
  const challenge = await getChallengeById(req.params.id);
  res.status(201).json({
    success: true,
    message:
      req.body.type === 'support'
        ? 'Thanks for supporting this challenge'
        : req.body.type === 'dispute'
          ? 'Dispute recorded for review'
          : 'Comment added',
    validation,
    community: {
      supportCount: challenge.communityValidation.supportCount,
      disputeCount: challenge.communityValidation.disputeCount,
      commentCount: challenge.communityValidation.commentCount,
      communityValidationScore: challenge.communityValidationScore,
    },
  });
});

export const getValidations = asyncHandler(async (req, res) => {
  const data = await listValidations(req.params.id, req.query);
  const challenge = await Challenge.findById(req.params.id).select('communityValidation');
  res.json({
    success: true,
    ...data,
    community: challenge
      ? {
          supportCount: challenge.communityValidation.supportCount,
          disputeCount: challenge.communityValidation.disputeCount,
          commentCount: challenge.communityValidation.commentCount,
          communityValidationScore: challenge.communityValidationScore,
        }
      : null,
  });
});

export const removeOwnValidation = asyncHandler(async (req, res) => {
  await removeValidation(req.params.id, req.user, req.query.type || req.body?.type);
  const challenge = await getChallengeById(req.params.id);
  res.json({
    success: true,
    message: 'Your validation was removed',
    community: {
      supportCount: challenge.communityValidation.supportCount,
      disputeCount: challenge.communityValidation.disputeCount,
      commentCount: challenge.communityValidation.commentCount,
      communityValidationScore: challenge.communityValidationScore,
    },
  });
});

export const universityMatches = asyncHandler(async (req, res) => {
  const force = req.query.force === 'true';
  const result = await getUniversityMatchesForChallenge(req.params.id, force);
  res.json({ success: true, ...result });
});

export const assignToUniversity = asyncHandler(async (req, res) => {
  if (!req.body.universityId) throw Object.assign(new Error('universityId is required'), { statusCode: 400 });
  const challenge = await assignUniversity(req.params.id, req.user, req.body.universityId);
  res.json({
    success: true,
    message: 'Challenge assigned',
    assignedUniversity: challenge.assignedUniversity,
    status: challenge.status,
  });
});

export const universityResponse = asyncHandler(async (req, res) => {
  const challenge = await saveUniversityResponse(req.params.id, req.user, req.body);
  const latest = challenge.universityResponses[challenge.universityResponses.length - 1];
  res.status(201).json({ success: true, message: 'Response recorded', response: latest });
});
