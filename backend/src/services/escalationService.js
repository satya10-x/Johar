import Escalation from '../models/Escalation.js';
import Project from '../models/Project.js';
import Milestone from '../models/Milestone.js';
import Challenge from '../models/Challenge.js';
import ApiError from '../utils/ApiError.js';
import { logGovernanceAction } from './auditService.js';
import { HIERARCHY_LEVELS } from './governmentScopeService.js';

export const ESCALATION_CONFIG = {
  LOCAL_REVIEW_DAYS: 3, // 0-3 days overdue: local review
  BLOCK_DISTRICT_DAYS: 7, // 4-7 days overdue: block/district review
  STATE_REVIEW_DAYS: 8, // 8+ days overdue: state review
  PROGRESS_LAG_THRESHOLD: 25, // expected - actual >= 25% => AT RISK
};

/**
 * Returns the appropriate governance authority level for a given number of overdue days.
 */
export function getLevelForDaysOverdue(days) {
  if (days <= ESCALATION_CONFIG.LOCAL_REVIEW_DAYS) return 'local_body';
  if (days <= ESCALATION_CONFIG.BLOCK_DISTRICT_DAYS) return 'district';
  return 'state';
}

/**
 * Returns the next higher level in the hierarchy.
 */
export function getNextEscalationLevel(currentLevel) {
  const order = ['local_body', 'block', 'district', 'state'];
  const idx = order.indexOf(currentLevel);
  if (idx === -1 || idx >= order.length - 1) return 'state';
  return order[idx + 1];
}

/**
 * Evaluates whether a project or its milestones are AT RISK.
 * Informational only — compares scheduled time vs actual progress.
 */
export function computeProjectAtRisk(project, milestones = []) {
  const now = Date.now();
  const riskFactors = [];
  let isAtRisk = false;
  let expectedProgress = 0;
  const actualProgress = Number(project.currentProgress || 0);

  // 1. Time-based expected progress calculation
  if (project.startDate && project.expectedEndDate) {
    const start = new Date(project.startDate).getTime();
    const end = new Date(project.expectedEndDate).getTime();
    const totalDuration = end - start;

    if (totalDuration > 0 && now > start) {
      const elapsed = Math.max(0, now - start);
      expectedProgress = Math.min(100, Math.round((elapsed / totalDuration) * 100));

      const lag = expectedProgress - actualProgress;
      if (lag >= ESCALATION_CONFIG.PROGRESS_LAG_THRESHOLD && actualProgress < 100) {
        isAtRisk = true;
        riskFactors.push(
          `Schedule lag: Expected ${expectedProgress}% based on timeline, but currently at ${actualProgress}% (lag: ${lag}%)`
        );
      }
    }
  }

  // 2. Project due date passed but not completed
  if (
    project.expectedEndDate &&
    new Date(project.expectedEndDate).getTime() < now &&
    project.status !== 'completed' &&
    project.status !== 'deployed'
  ) {
    isAtRisk = true;
    const days = Math.floor((now - new Date(project.expectedEndDate).getTime()) / (1000 * 60 * 60 * 24));
    riskFactors.push(`Project delivery overdue by ${days} day(s)`);
  }

  // 3. Milestone health checks
  let overdueMilestonesCount = 0;
  let blockedMilestonesCount = 0;

  for (const m of milestones) {
    if (m.executionStatus === 'blocked') {
      blockedMilestonesCount += 1;
    }
    const isCompleted = m.status === 'completed' || m.executionStatus === 'completed';
    if (!isCompleted && m.dueDate && new Date(m.dueDate).getTime() < now) {
      overdueMilestonesCount += 1;
    }
  }

  if (blockedMilestonesCount > 0) {
    isAtRisk = true;
    riskFactors.push(`${blockedMilestonesCount} milestone(s) currently marked as blocked`);
  }

  if (overdueMilestonesCount > 0) {
    isAtRisk = true;
    riskFactors.push(`${overdueMilestonesCount} milestone(s) overdue`);
  }

  return {
    isAtRisk,
    expectedProgress,
    actualProgress,
    riskFactors,
    overdueMilestonesCount,
    blockedMilestonesCount,
    severity: riskFactors.length > 2 ? 'high' : isAtRisk ? 'medium' : 'low',
  };
}

/**
 * Scans active projects and milestones, detecting triggers and automatically logging/updating escalations.
 */
export async function runEscalationScan() {
  const now = new Date();
  const activeProjects = await Project.find({
    status: { $nin: ['completed', 'cancelled'] },
  }).lean();

  const results = {
    scannedProjects: activeProjects.length,
    newEscalations: 0,
    updatedEscalations: 0,
  };

  for (const proj of activeProjects) {
    const milestones = await Milestone.find({ project: proj._id }).lean();
    const risk = computeProjectAtRisk(proj, milestones);

    // Check project-level overdue
    if (proj.expectedEndDate && new Date(proj.expectedEndDate) < now) {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(proj.expectedEndDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const targetLevel = getLevelForDaysOverdue(daysOverdue);

      const existing = await Escalation.findOne({
        project: proj._id,
        trigger: 'project_overdue',
        status: { $in: ['open', 'acknowledged'] },
      });

      if (!existing) {
        await Escalation.create({
          project: proj._id,
          trigger: 'project_overdue',
          currentLevel: proj.governmentOwnership?.authorityLevel || 'district',
          escalatedTo: targetLevel,
          reason: `Project "${proj.title}" is ${daysOverdue} day(s) past expected completion date.`,
          daysOverdue,
          severity: daysOverdue > 14 ? 'critical' : 'high',
        });
        results.newEscalations += 1;
      } else if (existing.daysOverdue !== daysOverdue) {
        existing.daysOverdue = daysOverdue;
        if (targetLevel !== existing.escalatedTo && existing.status === 'open') {
          existing.escalatedTo = targetLevel;
        }
        await existing.save();
        results.updatedEscalations += 1;
      }
    }

    // Check milestone-level triggers
    for (const m of milestones) {
      const isCompleted = m.status === 'completed' || m.executionStatus === 'completed';

      // 1. Milestone overdue
      if (!isCompleted && m.dueDate && new Date(m.dueDate) < now) {
        const daysOverdue = Math.floor(
          (now.getTime() - new Date(m.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        const targetLevel = getLevelForDaysOverdue(daysOverdue);

        const existing = await Escalation.findOne({
          project: proj._id,
          milestone: m._id,
          trigger: 'milestone_overdue',
          status: { $in: ['open', 'acknowledged'] },
        });

        if (!existing) {
          await Escalation.create({
            project: proj._id,
            milestone: m._id,
            trigger: 'milestone_overdue',
            currentLevel: 'local_body',
            escalatedTo: targetLevel,
            reason: `Milestone "${m.title}" is ${daysOverdue} day(s) overdue.`,
            daysOverdue,
            severity: daysOverdue > 7 ? 'high' : 'medium',
          });
          results.newEscalations += 1;
        }
      }

      // 2. Milestone blocked
      if (m.executionStatus === 'blocked') {
        const existing = await Escalation.findOne({
          project: proj._id,
          milestone: m._id,
          trigger: 'milestone_blocked',
          status: { $in: ['open', 'acknowledged'] },
        });

        if (!existing) {
          await Escalation.create({
            project: proj._id,
            milestone: m._id,
            trigger: 'milestone_blocked',
            currentLevel: 'district',
            escalatedTo: 'district',
            reason: `Milestone "${m.title}" is blocked: ${m.blockedReason || 'No blocker details provided'}.`,
            severity: 'high',
          });
          results.newEscalations += 1;
        }
      }

      // 3. Repeated changes requested
      if (m.verificationStatus === 'changes_requested') {
        const existing = await Escalation.findOne({
          project: proj._id,
          milestone: m._id,
          trigger: 'repeated_changes_requested',
          status: { $in: ['open', 'acknowledged'] },
        });

        if (!existing) {
          await Escalation.create({
            project: proj._id,
            milestone: m._id,
            trigger: 'repeated_changes_requested',
            currentLevel: 'district',
            escalatedTo: 'district',
            reason: `Milestone "${m.title}" requires revisions: ${m.verificationNotes || 'Changes requested by verifying authority'}.`,
            severity: 'medium',
          });
          results.newEscalations += 1;
        }
      }
    }
  }

  return results;
}

/**
 * Creates a manual escalation for a project, milestone, or challenge.
 */
export async function createManualEscalation({
  user,
  projectId,
  challengeId,
  milestoneId,
  trigger = 'manual',
  reason,
  severity = 'medium',
  escalatedTo = 'district',
}) {
  if (!reason?.trim()) throw new ApiError(400, 'Escalation reason is required');

  let project = null;
  let challenge = null;

  if (projectId) {
    project = await Project.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');
    challengeId = project.challenge || challengeId;
  }

  if (challengeId) {
    challenge = await Challenge.findById(challengeId);
    if (!challenge && !project) throw new ApiError(404, 'Challenge not found');
    if (!project && challenge) {
      project = await Project.findOne({ challenge: challenge._id });
    }
  }

  if (!project && !challenge) {
    throw new ApiError(400, 'A valid projectId or challengeId is required for escalation');
  }

  let milestoneTitle = '';
  if (milestoneId) {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) throw new ApiError(404, 'Milestone not found');
    milestoneTitle = ` - Milestone: ${milestone.title}`;
  }

  const escalation = await Escalation.create({
    project: project?._id || undefined,
    challenge: challenge?._id || project?.challenge || undefined,
    milestone: milestoneId || undefined,
    trigger,
    currentLevel: user.authorityLevel || 'district',
    escalatedTo,
    reason: String(reason).trim(),
    severity,
    status: 'open',
    history: [
      {
        action: 'created',
        fromLevel: user.authorityLevel || 'district',
        toLevel: escalatedTo,
        performedBy: user._id,
        notes: reason,
        timestamp: new Date(),
      },
    ],
  });

  const entityTitle = project
    ? `Escalation on ${project.title}${milestoneTitle}`
    : `Escalation on Challenge: ${challenge.title}`;

  await logGovernanceAction({
    actor: user,
    action: 'escalation_created',
    entityType: 'Escalation',
    entityId: escalation._id,
    entityTitle,
    newValue: { status: 'open', escalatedTo, trigger },
    notes: reason,
  });

  return escalation;
}

/**
 * Advances the escalation to the next hierarchy level (e.g. block -> district -> state).
 */
export async function advanceEscalationLevel(escalationId, user, notes) {
  const escalation = await Escalation.findById(escalationId).populate('project');
  if (!escalation) throw new ApiError(404, 'Escalation not found');

  const nextLevel = getNextEscalationLevel(escalation.escalatedTo);
  const oldLevel = escalation.escalatedTo;

  escalation.currentLevel = oldLevel;
  escalation.escalatedTo = nextLevel;
  escalation.history.push({
    action: 'advanced_level',
    fromLevel: oldLevel,
    toLevel: nextLevel,
    performedBy: user._id,
    notes: notes || `Advanced from ${oldLevel} to ${nextLevel}`,
    timestamp: new Date(),
  });

  await escalation.save();

  await logGovernanceAction({
    actor: user,
    action: 'escalation_level_advanced',
    entityType: 'Escalation',
    entityId: escalation._id,
    entityTitle: `Escalated from ${oldLevel} to ${nextLevel}`,
    oldValue: { escalatedTo: oldLevel },
    newValue: { escalatedTo: nextLevel },
    notes,
  });

  return escalation;
}

/**
 * Updates escalation status (acknowledged, resolved, dismissed).
 */
export async function updateEscalationStatus(escalationId, user, status, notes) {
  if (!['acknowledged', 'resolved', 'dismissed'].includes(status)) {
    throw new ApiError(400, 'Invalid escalation status');
  }

  const escalation = await Escalation.findById(escalationId);
  if (!escalation) throw new ApiError(404, 'Escalation not found');

  const oldStatus = escalation.status;
  escalation.status = status;

  if (status === 'acknowledged') {
    escalation.acknowledgedAt = new Date();
    escalation.acknowledgedBy = user._id;
  } else if (status === 'resolved' || status === 'dismissed') {
    escalation.resolvedAt = new Date();
    escalation.resolvedBy = user._id;
    escalation.resolutionNotes = notes || undefined;
  }

  escalation.history.push({
    action: `status_${status}`,
    fromLevel: escalation.currentLevel,
    toLevel: escalation.escalatedTo,
    performedBy: user._id,
    notes,
    timestamp: new Date(),
  });

  await escalation.save();

  const auditActionMap = {
    acknowledged: 'escalation_acknowledged',
    resolved: 'escalation_resolved',
    dismissed: 'escalation_dismissed',
  };

  await logGovernanceAction({
    actor: user,
    action: auditActionMap[status],
    entityType: 'Escalation',
    entityId: escalation._id,
    entityTitle: `Escalation ${status}`,
    oldValue: { status: oldStatus },
    newValue: { status },
    notes,
  });

  return escalation;
}
