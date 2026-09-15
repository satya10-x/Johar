import asyncHandler from '../utils/asyncHandler.js';
import {
  createDiscussion,
  listDiscussions,
  getNearbyDiscussions,
  getDiscussionById,
  addComment,
  listComments,
  joinDiscussion,
  leaveDiscussion,
  reportDiscussion,
  updateDiscussion,
  deleteDiscussion,
} from '../services/discussion.service.js';

export const create = asyncHandler(async (req, res) => {
  const discussion = await createDiscussion(req.user, req.body);
  res.status(201).json({ success: true, message: 'Discussion created', discussion });
});

export const list = asyncHandler(async (req, res) => {
  const data = await listDiscussions(req.query);
  res.json({ success: true, ...data });
});

export const nearby = asyncHandler(async (req, res) => {
  const data = await getNearbyDiscussions(req.query);
  res.json({ success: true, ...data });
});

export const getById = asyncHandler(async (req, res) => {
  const discussion = await getDiscussionById(req.params.id, req.user);
  res.json({ success: true, discussion });
});

export const update = asyncHandler(async (req, res) => {
  const discussion = await updateDiscussion(req.params.id, req.user, req.body);
  res.json({ success: true, message: 'Discussion updated', discussion });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteDiscussion(req.params.id, req.user);
  res.json({ success: true, message: 'Discussion deleted' });
});

// ---------- comments ----------

export const postComment = asyncHandler(async (req, res) => {
  const comment = await addComment(req.user, req.params.id, req.body);
  res.status(201).json({ success: true, message: 'Comment added', comment });
});

export const getComments = asyncHandler(async (req, res) => {
  const data = await listComments(req.params.id, req.query);
  res.json({ success: true, ...data });
});

// ---------- participation ----------

export const join = asyncHandler(async (req, res) => {
  const result = await joinDiscussion(req.user, req.params.id);
  res.json({ success: true, message: 'Joined the discussion', ...result });
});

export const leave = asyncHandler(async (req, res) => {
  const result = await leaveDiscussion(req.user, req.params.id);
  res.json({ success: true, message: 'Left the discussion', ...result });
});

// ---------- reporting ----------

export const report = asyncHandler(async (req, res) => {
  await reportDiscussion(req.user, req.params.id, req.body);
  res.status(201).json({
    success: true,
    message: 'Report submitted for admin review',
  });
});
