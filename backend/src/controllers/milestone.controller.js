import Milestone from '../models/Milestone.js';
import Project from '../models/Project.js';
import Escalation from '../models/Escalation.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  canVerifyMilestone,
  canReviewMilestone,
  canSubmitMilestoneEvidence,
} from '../services/governmentScopeService.js';
import { recomputeProgress } from '../services/project.service.js';
import { logGovernanceAction } from '../services/auditService.js';

/**
 * Submits a milestone for official government/authority verification.
 */
export const submitForVerification = asyncHandler(async (req, res) => {
  const milestone = await Milestone.findById(req.params.id);
  if (!milestone) throw new ApiError(404, 'Milestone not found');

  const project = await Project.findById(milestone.project);
  if (!project) throw new ApiError(404, 'Project not found');

  if (!canSubmitMilestoneEvidence(req.user, project)) {
    throw new ApiError(403, 'You do not have permission to submit this milestone for verification');
  }

  const oldStatus = milestone.verificationStatus;
  milestone.verificationStatus = 'submitted';
  milestone.executionStatus = 'completed';
  if (milestone.progress < 100) milestone.progress = 100;
  if (!milestone.completedDate) milestone.completedDate = new Date();
  if (req.body.notes) {
    milestone.notes = req.body.notes;
  }

  await milestone.save();

  await logGovernanceAction({
    actor: req.user,
    action: 'milestone_submission',
    entityType: 'Milestone',
    entityId: milestone._id,
    entityTitle: `${milestone.title} (Project: ${project.title})`,
    oldValue: { verificationStatus: oldStatus },
    newValue: { verificationStatus: 'submitted' },
    notes: req.body.notes,
  });

  res.json({
    success: true,
    message: 'Milestone submitted for authority verification',
    milestone,
  });
});

/**
 * Gets evidence attachments for a milestone.
 * Public users receive only public evidence; authorized team/gov/admin receive all.
 */
export const getEvidence = asyncHandler(async (req, res) => {
  const milestone = await Milestone.findById(req.params.id)
    .populate('evidence.submittedBy', 'name role organization')
    .lean();

  if (!milestone) throw new ApiError(404, 'Milestone not found');

  const project = await Project.findById(milestone.project).lean();
  const isPrivileged =
    req.user &&
    (req.user.role === 'admin' ||
      req.user.role === 'government' ||
      canSubmitMilestoneEvidence(req.user, project));

  let evidence = milestone.evidence || [];
  if (!isPrivileged) {
    evidence = evidence.filter((e) => e.isPublic !== false);
  }

  res.json({
    success: true,
    evidence,
    milestoneId: milestone._id,
    milestoneTitle: milestone.title,
    verificationStatus: milestone.verificationStatus,
  });
});

/**
 * Adds an evidence item (document, image, report, prototype link, measurement, notes).
 */
export const addEvidence = asyncHandler(async (req, res) => {
  const { type, url, title, description, isPublic } = req.body;
  if (!title?.trim()) throw new ApiError(400, 'Evidence title is required');

  const milestone = await Milestone.findById(req.params.id);
  if (!milestone) throw new ApiError(404, 'Milestone not found');

  const project = await Project.findById(milestone.project);
  if (!project) throw new ApiError(404, 'Project not found');

  if (!canSubmitMilestoneEvidence(req.user, project)) {
    throw new ApiError(403, 'You do not have permission to attach evidence to this milestone');
  }

  const evidenceItem = {
    type: type || 'document',
    url: url?.trim() || undefined,
    title: String(title).trim(),
    description: description?.trim() || undefined,
    isPublic: isPublic !== false,
    submittedBy: req.user._id,
    submittedAt: new Date(),
  };

  milestone.evidence.push(evidenceItem);
  await milestone.save();

  await logGovernanceAction({
    actor: req.user,
    action: 'evidence_upload',
    entityType: 'Milestone',
    entityId: milestone._id,
    entityTitle: `${title} on ${milestone.title}`,
    newValue: { type: evidenceItem.type, title: evidenceItem.title },
    notes: description,
  });

  res.status(201).json({
    success: true,
    message: 'Evidence successfully attached',
    evidence: milestone.evidence,
  });
});

/**
 * Officially verifies a milestone.
 * Only authorized government officials within scope or platform admins can verify.
 */
export const verifyMilestone = asyncHandler(async (req, res) => {
  const milestone = await Milestone.findById(req.params.id);
  if (!milestone) throw new ApiError(404, 'Milestone not found');

  const project = await Project.findById(milestone.project);
  if (!project) throw new ApiError(404, 'Project not found');

  if (!canVerifyMilestone(req.user, milestone, project)) {
    throw new ApiError(
      403,
      'You do not have the required authority scope to verify this milestone'
    );
  }

  const oldStatus = milestone.verificationStatus;
  milestone.verificationStatus = 'verified';
  milestone.executionStatus = 'completed';
  milestone.status = 'completed';
  milestone.progress = 100;
  milestone.completedDate = milestone.completedDate || new Date();
  milestone.verifiedBy = req.user._id;
  milestone.verifiedAt = new Date();
  if (req.body.notes) {
    milestone.verificationNotes = req.body.notes;
  }

  await milestone.save();

  // Recompute overall project progress
  const progress = await recomputeProgress(project._id);
  if (progress !== null) {
    await Project.updateOne({ _id: project._id }, { currentProgress: progress });
  }

  // Automatically resolve any open escalations for this milestone
  await Escalation.updateMany(
    { milestone: milestone._id, status: { $in: ['open', 'acknowledged'] } },
    {
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy: req.user._id,
      resolutionNotes: 'Automatically resolved upon milestone verification.',
    }
  );

  await logGovernanceAction({
    actor: req.user,
    action: 'verification',
    entityType: 'Milestone',
    entityId: milestone._id,
    entityTitle: `${milestone.title} (Project: ${project.title})`,
    oldValue: { verificationStatus: oldStatus },
    newValue: { verificationStatus: 'verified', progress: 100 },
    notes: req.body.notes,
  });

  res.json({
    success: true,
    message: 'Milestone verified successfully',
    milestone,
    projectProgress: progress,
  });
});

/**
 * Requests changes on a submitted milestone.
 */
export const requestChanges = asyncHandler(async (req, res) => {
  const { notes } = req.body;
  if (!notes?.trim()) {
    throw new ApiError(400, 'Notes detailing the required changes are required');
  }

  const milestone = await Milestone.findById(req.params.id);
  if (!milestone) throw new ApiError(404, 'Milestone not found');

  const project = await Project.findById(milestone.project);
  if (!project) throw new ApiError(404, 'Project not found');

  if (!canReviewMilestone(req.user, milestone, project)) {
    throw new ApiError(403, 'You do not have permission to review this milestone');
  }

  const oldStatus = milestone.verificationStatus;
  milestone.verificationStatus = 'changes_requested';
  milestone.verificationNotes = String(notes).trim();
  await milestone.save();

  await logGovernanceAction({
    actor: req.user,
    action: 'changes_requested',
    entityType: 'Milestone',
    entityId: milestone._id,
    entityTitle: `${milestone.title} (Project: ${project.title})`,
    oldValue: { verificationStatus: oldStatus },
    newValue: { verificationStatus: 'changes_requested' },
    notes,
  });

  res.json({
    success: true,
    message: 'Changes requested on milestone',
    milestone,
  });
});

/**
 * Rejects milestone verification.
 */
export const rejectMilestone = asyncHandler(async (req, res) => {
  const { notes } = req.body;
  if (!notes?.trim()) {
    throw new ApiError(400, 'Notes detailing the rejection reason are required');
  }

  const milestone = await Milestone.findById(req.params.id);
  if (!milestone) throw new ApiError(404, 'Milestone not found');

  const project = await Project.findById(milestone.project);
  if (!project) throw new ApiError(404, 'Project not found');

  if (!canReviewMilestone(req.user, milestone, project)) {
    throw new ApiError(403, 'You do not have permission to review this milestone');
  }

  const oldStatus = milestone.verificationStatus;
  milestone.verificationStatus = 'rejected';
  milestone.verificationNotes = String(notes).trim();
  await milestone.save();

  await logGovernanceAction({
    actor: req.user,
    action: 'rejection',
    entityType: 'Milestone',
    entityId: milestone._id,
    entityTitle: `${milestone.title} (Project: ${project.title})`,
    oldValue: { verificationStatus: oldStatus },
    newValue: { verificationStatus: 'rejected' },
    notes,
  });

  res.json({
    success: true,
    message: 'Milestone rejected',
    milestone,
  });
});
