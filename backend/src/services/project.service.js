import mongoose from 'mongoose';

import Project from '../models/Project.js';
import Challenge from '../models/Challenge.js';
import Industry from '../models/Industry.js';
import Funding from '../models/Funding.js';
import CollaborationRequest, {
  COLLABORATION_TYPES,
  COLLABORATION_STATUSES,
} from '../models/CollaborationRequest.js';
import University from '../models/University.js';
import Milestone from '../models/Milestone.js';

import ApiError from '../utils/ApiError.js';
import { matchIndustries as matchIndustriesAI } from './groqService.js';
import { triggerProjectRiskUpdateOnEvent } from './projectRiskService.js';

export const STATUS_TRANSITIONS = {
  proposed: ['approved', 'cancelled'],
  approved: ['team_formation', 'cancelled'],
  team_formation: ['development', 'cancelled'],
  development: ['testing', 'cancelled'],
  testing: ['pilot', 'cancelled'],
  pilot: ['deployed'],
  deployed: ['completed'],
  completed: [],
  cancelled: [],
};

const PROJECT_STATUSES = Object.keys(STATUS_TRANSITIONS);
const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'delayed'];

export async function recomputeProgress(projectId) {
  const milestones = await Milestone.find({ project: projectId }).select(
    'status executionStatus verificationStatus'
  );
  if (!milestones.length) return null;
  const completed = milestones.filter(
    (m) =>
      m.status === 'completed' ||
      m.executionStatus === 'completed' ||
      m.verificationStatus === 'verified'
  ).length;
  return Math.round((completed / milestones.length) * 100);
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'into']);

function keywordsOf(text, arrays) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z\u0900-\u097F\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const terms = new Set(words);
  for (const arr of arrays) {
    for (const item of arr || []) {
      const lower = String(item).toLowerCase();
      terms.add(lower);
      for (const part of lower.split(/[\s_/]+/)) {
        if (part.length > 3 && !STOPWORDS.has(part)) terms.add(part);
      }
    }
  }
  return terms;
}

export async function createProject(user, body) {
  if (!body.challenge) throw new ApiError(400, 'challenge is required');
  if (!body.title?.trim()) throw new ApiError(400, 'title is required');
  if (!body.description?.trim()) throw new ApiError(400, 'description is required');

  const challenge = await Challenge.findById(body.challenge);
  if (!challenge) throw new ApiError(404, 'Challenge not found');

  let universityId = body.university;
  if (user.role === 'university') {
    // universities can only create projects for their own university profile
    const uni = await University.findOne({ createdBy: user._id });
    if (!uni) throw new ApiError(403, 'No university profile is linked to your account');
    universityId = uni._id;
    if (
      challenge.assignedUniversity &&
      challenge.assignedUniversity.toString() !== uni._id.toString()
    ) {
      throw new ApiError(403, 'This challenge is assigned to a different university');
    }
  } else if (user.role !== 'admin') {
    throw new ApiError(403, 'Only universities or admins can create projects');
  }

  const project = await Project.create({
    title: String(body.title).trim(),
    description: String(body.description).trim(),
    challenge: challenge._id,
    university: universityId,
    status: 'proposed',
    objectives: Array.isArray(body.objectives) ? body.objectives.slice(0, 10) : [],
    proposedSolution: body.proposedSolution,
    estimatedBudget: body.estimatedBudget
      ? { amount: Number(body.estimatedBudget) || 0, currency: 'INR' }
      : undefined,
    startDate: body.startDate,
    expectedEndDate: body.expectedEndDate,
    technologies: Array.isArray(body.technologies) ? body.technologies.slice(0, 15) : [],
    teamMembers: [{ user: user._id, role: 'project lead' }],
    facultyMentor: user._id,
  });

  return project;
}

export async function canManageProject(user, project) {
  if (user.role === 'admin') return true;
  if (!project.university) return false;
  // NOTE: ObjectId instances have a self-referencing `_id`, so we must check
  // whether the field is actually populated (a document) before trusting `._id`.
  const isPopulated =
    typeof project.university === 'object' &&
    !(project.university instanceof mongoose.Types.ObjectId);
  const uniId = isPopulated ? project.university._id : project.university;
  const uni = await University.findById(uniId);
  return Boolean(uni && uni.createdBy && uni.createdBy.toString() === user._id.toString());
}

export async function listProjects(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  const filter = {};
  if (query.status && PROJECT_STATUSES.includes(query.status)) filter.status = query.status;
  if (query.university) filter.university = query.university;

  // category / district filters resolve through the linked challenge
  if (query.category || query.district) {
    const challengeFilter = {};
    if (query.category) challengeFilter.category = query.category;
    if (query.district) challengeFilter.district = query.district;
    const challengeIds = await Challenge.find(challengeFilter).distinct('_id');
    filter.challenge = { $in: challengeIds };
  }

  const [projects, total] = await Promise.all([
    Project.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('university', 'name')
      .populate('challenge', 'category district')
      .select('-deploymentDetails.location'),
    Project.countDocuments(filter),
  ]);

  return {
    projects,
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

export async function getProjectById(id, user) {
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, 'Invalid project ID format');
  }
  const project = await Project.findById(id)
    .populate('university', 'name createdBy')
    .populate('challenge', 'title category district severity aiSummary')
    .populate('industryPartners', 'companyName companyType logo')
    .populate('teamMembers.user', 'name role')
    .populate('facultyMentor', 'name role')
    .select('-deploymentDetails.location');

  if (!project) throw new ApiError(404, 'Project not found');

  const obj = project.toObject();
  obj.industryPartners = (obj.industryPartners || []).map((p) => ({
    ...p,
    location: undefined,
    contactInformation: undefined,
  }));
  obj.university = obj.university ? { _id: obj.university._id, name: obj.university.name } : null;
  obj.canManage = user ? await canManageProject(user, obj) : false;

  return obj;
}

// ---------- industry matching ----------

async function findIndustryCandidates(project, challenge) {
  const terms = keywordsOf(
    `${project.title} ${project.description} ${(project.objectives || []).join(' ')} ${(project.technologies || []).join(' ')}`,
    [[challenge.category], project.technologies]
  );
  const regex = [...terms].slice(0, 8).join('|');

  const filter = {
    $or: [
      { industries: { $regex: regex, $options: 'i' } },
      { expertise: { $regex: regex, $options: 'i' } },
      { technologies: { $regex: regex, $options: 'i' } },
      { collaborationTypes: { $in: ['pilot_deployment', 'research_collaboration'] } },
    ],
  };

  let candidates = await Industry.find(filter)
    .select('companyName companyType description industries expertise technologies collaborationTypes previousCollaborations address')
    .limit(12)
    .lean();

  if (candidates.length < 5) {
    const extra = await Industry.find({ _id: { $nin: candidates.map((c) => c._id) } })
      .select('companyName companyType description industries expertise technologies collaborationTypes previousCollaborations address')
      .limit(12 - candidates.length)
      .lean();
    candidates = candidates.concat(extra);
  }

  return candidates;
}

function scoreIndustryFallback(project, challenge, industry) {
  const projectTerms = keywordsOf(
    `${project.title} ${project.description} ${(project.objectives || []).join(' ')} ${(project.technologies || []).join(' ')}`,
    [[challenge.category]]
  );

  const matchingAreas = new Set();
  let hits = 0;
  for (const field of [
    ...(industry.expertise || []),
    ...(industry.technologies || []),
    ...(industry.industries || []),
  ]) {
    const lower = String(field).toLowerCase();
    if (projectTerms.has(lower)) {
      matchingAreas.add(field);
      hits += 1;
      continue;
    }
    for (const part of lower.split(/[\s_/]+/)) {
      if (part.length > 3 && projectTerms.has(part)) {
        matchingAreas.add(field);
        hits += 1;
        break;
      }
    }
  }

  return {
    industryId: industry._id.toString(),
    score: Math.min(95, hits * 20),
    matchingAreas: [...matchingAreas].slice(0, 4),
    reason:
      matchingAreas.size > 0
        ? `Capabilities overlap with the project: ${[...matchingAreas].slice(0, 3).join(', ')}.`
        : 'No direct overlap found in listed capabilities.',
  };
}

export async function findIndustryMatchesForProject(projectId, { force = false } = {}) {
  const project = await Project.findById(projectId)
    .populate('challenge', 'title category district subCategory tags aiSummary')
    .populate('university', 'name');
  if (!project) throw Object.assign(new Error('Project not found'), { statusCode: 404 });
  const challenge = project.challenge;

  const cached = project.industryMatches;
  if (!force && cached && Array.isArray(cached.matches) && cached.matches.length > 0) {
    return cached;
  }

  const candidates = await findIndustryCandidates(project, challenge);

  const profile = {
    title: project.title,
    description: project.description,
    objectives: project.objectives || [],
    technologies: project.technologies || [],
    solutionDomains:
      (challenge.aiClassification && challenge.aiClassification.solutionDomains) || [],
    requiredResources:
      (challenge.universityResponses || []).flatMap((r) => r.requiredResources || []),
    challengeCategory: challenge.category,
    challengeDistrict: challenge.district,
  };

  let matches;
  let generatedBy = 'database';
  try {
    matches = await matchIndustriesAI(profile, candidates);
    generatedBy = 'ai';
  } catch (err) {
    console.error(`[ai] industry matching failed: ${err.message}`);
    matches = candidates.map((c) => scoreIndustryFallback(project, challenge, c)).sort((a, b) => b.score - a.score);
  }

  const withNames = matches
    .map((m) => {
      const ind = candidates.find((c) => c._id.toString() === m.industryId);
      return ind
        ? {
            industryId: m.industryId,
            companyName: ind.companyName,
            companyType: ind.companyType,
            collaborationTypes: ind.collaborationTypes || [],
            score: m.score,
            matchingAreas: m.matchingAreas,
            reason: m.reason,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const result = { checkedAt: new Date(), generatedBy, matches: withNames };
  await Project.updateOne({ _id: project._id }, { $set: { industryMatches: result } });
  return result;
}

// ---------- collaboration requests ----------

export async function createCollaborationRequest(user, projectId, body) {
  const { collaborationType, message, proposedContribution, estimatedAmount } = body;

  if (!COLLABORATION_TYPES.includes(collaborationType)) {
    throw new ApiError(400, `collaborationType must be one of: ${COLLABORATION_TYPES.join(', ')}`);
  }

  const industry = await Industry.findOne({ createdBy: user._id });
  if (!industry && user.role !== 'admin') {
    throw new ApiError(403, 'No industry profile is linked to your account');
  }

  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const duplicate = await CollaborationRequest.findOne({
    project: project._id,
    industry: industry?._id,
    collaborationType,
  });
  if (duplicate) {
    throw new ApiError(409, `You already have a ${collaborationType} request for this project`);
  }

  return CollaborationRequest.create({
    project: project._id,
    industry: industry?._id,
    collaborationType,
    message: message?.trim(),
    proposedContribution: proposedContribution?.trim(),
    estimatedAmount:
      estimatedAmount !== undefined
        ? { amount: Number(estimatedAmount) || 0, currency: 'INR' }
        : undefined,
  });
}

export async function listCollaborationRequests(user, projectId) {
  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const canManage = await canManageProject(user, project);
  const myIndustry = await Industry.findOne({ createdBy: user._id });

  const filter = { project: project._id };
  if (!canManage) {
    if (!myIndustry) throw new ApiError(403, 'Not allowed to view these requests');
    filter.industry = myIndustry._id; // industries see only their own requests
  }

  return CollaborationRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('industry', 'companyName companyType')
    .lean();
}

export async function respondToCollaborationRequest(user, requestId, body) {
  const { status, responseMessage } = body;
  if (!COLLABORATION_STATUSES.includes(status) || status === 'pending') {
    throw new ApiError(400, 'status must be accepted, rejected or needs_more_information');
  }

  const request = await CollaborationRequest.findById(requestId);
  if (!request) throw new ApiError(404, 'Collaboration request not found');

  const project = await Project.findById(request.project);
  const canManage = await canManageProject(user, project);
  if (!canManage) {
    throw new ApiError(403, 'Only the project university or an admin can respond');
  }

  request.status = status;
  request.responseMessage = responseMessage?.trim();
  request.respondedAt = new Date();
  await request.save();

  if (status === 'accepted') {
    await Project.updateOne(
      { _id: project._id },
      { $addToSet: { industryPartners: request.industry } }
    );
  }

  return request;
}

// ---------- funding ----------

export async function createFundingCommitment(user, projectId, body) {
  const { amount, purpose, notes } = body;
  if (!amount || Number(amount) <= 0) {
    throw new ApiError(400, 'A positive funding amount is required');
  }

  const industry = await Industry.findOne({ createdBy: user._id });
  if (!industry && user.role !== 'admin') {
    throw new ApiError(403, 'No industry profile is linked to your account');
  }

  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');

  const funding = await Funding.create({
    project: project._id,
    industry: industry?._id,
    amount: Number(amount),
    purpose: purpose?.trim(),
    notes: notes?.trim(),
    status: 'proposed',
  });

  return funding;
}

export async function listProjectFunding(projectId) {
  return Funding.find({ project: projectId })
    .populate('industry', 'companyName companyType')
    .select('industry amount currency status purpose createdAt')
    .lean();
}

// ---------- lifecycle management ----------

export async function updateProject(projectId, user, body) {
  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!(await canManageProject(user, project))) {
    throw new ApiError(403, 'Only the project university or an admin can update this project');
  }

  const updates = {};
  if (body.title !== undefined && String(body.title).trim()) updates.title = String(body.title).trim();
  if (body.description !== undefined && String(body.description).trim())
    updates.description = String(body.description).trim();
  if (body.proposedSolution !== undefined) updates.proposedSolution = body.proposedSolution;
  if (body.objectives !== undefined)
    updates.objectives = Array.isArray(body.objectives) ? body.objectives.slice(0, 10) : [];
  if (body.technologies !== undefined)
    updates.technologies = Array.isArray(body.technologies) ? body.technologies.slice(0, 15) : [];
  if (body.estimatedBudget !== undefined)
    updates.estimatedBudget = { amount: Number(body.estimatedBudget) || 0, currency: 'INR' };
  if (body.startDate !== undefined) updates.startDate = body.startDate;
  if (body.expectedEndDate !== undefined) updates.expectedEndDate = body.expectedEndDate;
  if (body.currentProgress !== undefined) {
    const p = Number(body.currentProgress);
    if (!Number.isFinite(p) || p < 0 || p > 100) throw new ApiError(400, 'currentProgress must be 0-100');
    updates.currentProgress = Math.round(p);
  }

  Object.assign(project, updates);
  await project.save();
  return project;
}

export async function deleteProject(projectId, user) {
  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!(await canManageProject(user, project))) {
    throw new ApiError(403, 'Only the project university or an admin can delete this project');
  }
  await Promise.allSettled([
    mongoose.model('Milestone').deleteMany({ project: projectId }),
    CollaborationRequest.deleteMany({ project: projectId }),
    Funding.deleteMany({ project: projectId }),
  ]);
  await project.deleteOne();
}

export async function changeProjectStatus(projectId, user, newStatus) {  if (!PROJECT_STATUSES.includes(newStatus)) {
    throw new ApiError(400, `Invalid status. Allowed: ${PROJECT_STATUSES.join(', ')}`);
  }

  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!(await canManageProject(user, project))) {
    throw new ApiError(403, 'Only the project university or an admin can change status');
  }

  const allowed = STATUS_TRANSITIONS[project.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(
      400,
      `Invalid transition: ${project.status} → ${newStatus}. Allowed next: ${allowed.join(', ') || 'none'}`
    );
  }

  project.status = newStatus;
  if (newStatus === 'completed') {
    project.completionDate = new Date();
    project.currentProgress = 100;
  }
  await project.save();
  triggerProjectRiskUpdateOnEvent(projectId, 'status_changed');
  return project;
}

export async function addTeamMember(projectId, user, { userId, role }) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, 'A valid userId is required');
  }
  const member = await mongoose.model('User').findById(userId);
  if (!member || !member.isActive) throw new ApiError(404, 'Team member user not found');

  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!(await canManageProject(user, project))) {
    throw new ApiError(403, 'Only the project university or an admin can manage the team');
  }

  if (project.teamMembers.some((tm) => tm.user.toString() === userId)) {
    throw new ApiError(409, 'This user is already a team member');
  }

  project.teamMembers.push({ user: userId, role: role?.trim() || 'member' });
  await project.save();

  const added = project.teamMembers[project.teamMembers.length - 1];
  return { _id: added._id, user: { _id: member._id, name: member.name }, role: added.role };
}

export async function removeTeamMember(projectId, userId, actingUser) {
  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!(await canManageProject(actingUser, project))) {
    throw new ApiError(403, 'Only the project university or an admin can manage the team');
  }

  const before = project.teamMembers.length;
  project.teamMembers = project.teamMembers.filter(
    (tm) => tm.user.toString() !== userId
  );
  if (project.teamMembers.length === before) {
    throw new ApiError(404, 'Team member not found on this project');
  }
  await project.save();
}

export async function assignMentor(projectId, user, mentorUserId) {
  const mentor = await mongoose.model('User').findById(mentorUserId);
  if (!mentor || !mentor.isActive) throw new ApiError(404, 'Mentor user not found');
  if (mentor.role !== 'faculty') {
    throw new ApiError(400, 'Only faculty users can be assigned as mentors');
  }

  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!(await canManageProject(user, project))) {
    throw new ApiError(403, 'Only the project university or an admin can assign a mentor');
  }

  project.facultyMentor = mentorUserId;
  await project.save();
  return project;
}

// ---------- milestones ----------

function sanitizeMilestoneBody(body, { requireCore = false } = {}) {
  const payload = {};
  if (body.title !== undefined || requireCore) {
    if (!String(body.title || '').trim()) throw new ApiError(400, 'Milestone title is required');
    payload.title = String(body.title).trim();
  }
  if (body.description !== undefined) payload.description = body.description;
  if (body.dueDate !== undefined || requireCore) {
    const due = new Date(body.dueDate);
    if (!body.dueDate || Number.isNaN(due.getTime())) {
      throw new ApiError(400, 'A valid dueDate is required');
    }
    payload.dueDate = due;
  }
  if (body.completedDate !== undefined) payload.completedDate = body.completedDate;
  if (body.status !== undefined) {
    if (!MILESTONE_STATUSES.includes(body.status)) {
      throw new ApiError(400, `status must be one of: ${MILESTONE_STATUSES.join(', ')}`);
    }
    payload.status = body.status;
    payload.completedDate =
      body.status === 'completed' ? (body.completedDate ?? new Date()) : undefined;
  }
  if (body.progress !== undefined) {
    const p = Number(body.progress);
    if (!Number.isFinite(p) || p < 0 || p > 100) throw new ApiError(400, 'progress must be 0-100');
    payload.progress = Math.round(p);
  }
  if (body.deliverables !== undefined) {
    payload.deliverables = Array.isArray(body.deliverables)
      ? body.deliverables.map((d) => String(d)).slice(0, 10)
      : [];
  }
  if (body.notes !== undefined) payload.notes = body.notes;
  if (body.executionStatus !== undefined) {
    if (!['pending', 'in_progress', 'completed', 'delayed', 'blocked'].includes(body.executionStatus)) {
      throw new ApiError(400, 'Invalid executionStatus');
    }
    payload.executionStatus = body.executionStatus;
    if (body.executionStatus === 'completed') {
      payload.status = 'completed';
      payload.completedDate = payload.completedDate || new Date();
    }
  }
  if (body.blockedReason !== undefined) payload.blockedReason = body.blockedReason;
  return payload;
}

export async function createMilestone(projectId, user, body) {
  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!(await canManageProject(user, project))) {
    throw new ApiError(403, 'Only the project university or an admin can manage milestones');
  }

  const payload = sanitizeMilestoneBody(body, { requireCore: true });
  const milestone = await mongoose.model('Milestone').create({
    ...payload,
    project: projectId,
  });

  const progress = await recomputeProgress(projectId);
  if (progress !== null) await Project.updateOne({ _id: projectId }, { currentProgress: progress });
  triggerProjectRiskUpdateOnEvent(projectId, 'milestone_created');
  return milestone;
}

export async function listMilestones(projectId) {
  return mongoose
    .model('Milestone')
    .find({ project: projectId })
    .sort({ dueDate: 1 })
    .lean();
}

async function getMilestoneForManagement(milestoneId, user) {
  const idStr = String(milestoneId || '');
  if (!idStr.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, 'Invalid milestone ID format');
  }
  const milestone = await mongoose.model('Milestone').findById(idStr);
  if (!milestone) throw new ApiError(404, 'Milestone not found');

  const project = await Project.findById(milestone.project);
  if (!(await canManageProject(user, project))) {
    throw new ApiError(403, 'Only the project university or an admin can manage milestones');
  }
  return { milestone, projectId: milestone.project };
}

export async function updateMilestone(milestoneId, user, body) {
  const { milestone, projectId } = await getMilestoneForManagement(milestoneId, user);
  Object.assign(milestone, sanitizeMilestoneBody(body));
  await milestone.save();

  const progress = await recomputeProgress(projectId);
  if (progress !== null) await Project.updateOne({ _id: projectId }, { currentProgress: progress });
  triggerProjectRiskUpdateOnEvent(projectId, 'milestone_updated');
  return milestone;
}

export async function deleteMilestone(milestoneId, user) {
  const { milestone, projectId } = await getMilestoneForManagement(milestoneId, user);
  await milestone.deleteOne();

  const progress = await recomputeProgress(projectId);
  if (progress !== null) await Project.updateOne({ _id: projectId }, { currentProgress: progress });
  triggerProjectRiskUpdateOnEvent(projectId, 'milestone_deleted');
}
