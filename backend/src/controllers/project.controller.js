import asyncHandler from '../utils/asyncHandler.js';
import Project from '../models/Project.js';
import ApiError from '../utils/ApiError.js';
import CollaborationRequest from '../models/CollaborationRequest.js';
import { canViewProject } from '../services/governmentScopeService.js';
import {
  assessProjectRisk,
  getProjectRiskHistory,
  getProjectsRiskSummary,
} from '../services/projectRiskService.js';
import {
  createProject,
  listProjects,
  getProjectById,
  findIndustryMatchesForProject,
  createCollaborationRequest,
  listCollaborationRequests,
  respondToCollaborationRequest,
  createFundingCommitment,
  listProjectFunding,
  updateProject,
  deleteProject,
  changeProjectStatus,
  addTeamMember,
  removeTeamMember,
  assignMentor,
  createMilestone,
  listMilestones,
  updateMilestone,
  deleteMilestone,
  STATUS_TRANSITIONS,
} from '../services/project.service.js';
import {
  getProjectImpact,
  saveImpact,
  regenerateImpactSummary,
  findReplicationOpportunities,
} from '../services/impact.service.js';

export const create = asyncHandler(async (req, res) => {
  const project = await createProject(req.user, req.body);
  res.status(201).json({ success: true, message: 'Project created', project });
});

export const list = asyncHandler(async (req, res) => {
  const data = await listProjects(req.query);
  res.json({ success: true, ...data });
});

export const getById = asyncHandler(async (req, res) => {
  const project = await getProjectById(req.params.id, req.user);
  const funding = await listProjectFunding(project._id);
  res.json({ success: true, project, funding });
});

export const update = asyncHandler(async (req, res) => {
  const project = await updateProject(req.params.id, req.user, req.body);
  res.json({ success: true, message: 'Project updated', project });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteProject(req.params.id, req.user);
  res.json({ success: true, message: 'Project deleted' });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const project = await changeProjectStatus(req.params.id, req.user, req.body.status);
  res.json({
    success: true,
    message: `Status updated to ${project.status}`,
    status: project.status,
    allowedNext: STATUS_TRANSITIONS[project.status],
  });
});

export const addMember = asyncHandler(async (req, res) => {
  const member = await addTeamMember(req.params.id, req.user, req.body);
  res.status(201).json({ success: true, message: 'Team member added', member });
});

export const deleteMember = asyncHandler(async (req, res) => {
  await removeTeamMember(req.params.id, req.params.userId, req.user);
  res.json({ success: true, message: 'Team member removed' });
});

export const setMentor = asyncHandler(async (req, res) => {
  if (!req.body.userId) throw Object.assign(new Error('userId is required'), { statusCode: 400 });
  const project = await assignMentor(req.params.id, req.user, req.body.userId);
  res.json({ success: true, message: 'Faculty mentor assigned', facultyMentor: project.facultyMentor });
});

// ---------- milestones ----------

export const createNewMilestone = asyncHandler(async (req, res) => {
  const milestone = await createMilestone(req.params.id, req.user, req.body);
  res.status(201).json({ success: true, message: 'Milestone created', milestone });
});

export const getAllMilestones = asyncHandler(async (req, res) => {
  const milestones = await listMilestones(req.params.id);
  res.json({ success: true, milestones });
});

export const patchMilestone = asyncHandler(async (req, res) => {
  const milestone = await updateMilestone(req.params.milestoneId, req.user, req.body);
  res.json({ success: true, message: 'Milestone updated', milestone });
});

export const removeMilestone = asyncHandler(async (req, res) => {
  await deleteMilestone(req.params.milestoneId, req.user);
  res.json({ success: true, message: 'Milestone deleted' });
});

export const industryMatches = asyncHandler(async (req, res) => {
  const force = req.query.force === 'true';
  const result = await findIndustryMatchesForProject(req.params.id, { force });
  res.json({ success: true, ...result });
});

export const createCollabRequest = asyncHandler(async (req, res) => {
  const request = await createCollaborationRequest(req.user, req.params.id, req.body);
  res.status(201).json({ success: true, message: 'Collaboration request submitted', request });
});

export const getCollabRequests = asyncHandler(async (req, res) => {
  const requests = await listCollaborationRequests(req.user, req.params.id);
  res.json({ success: true, requests });
});

export const respondToRequest = asyncHandler(async (req, res) => {
  const request = await respondToCollaborationRequest(req.user, req.params.requestId, req.body);

  // reflect accepted partners on the project response
  const updated = await CollaborationRequest.find({ project: request.project })
    .populate('industry', 'companyName companyType')
    .lean();

  res.json({
    success: true,
    message: `Request ${request.status}`,
    request: { ...request.toObject(), industryName: request.industry?.companyName },
    projectRequests: updated.map((r) => ({
      _id: r._id,
      collaborationType: r.collaborationType,
      status: r.status,
      industryName: r.industry?.companyName,
      estimatedAmount: r.estimatedAmount,
    })),
  });
});

 export const createFunding = asyncHandler(async (req, res) => {
  const funding = await createFundingCommitment(req.user, req.params.id, req.body);
  res.status(201).json({ success: true, message: 'Funding commitment recorded', funding });
});

// ---------- social impact ----------

export const getImpact = asyncHandler(async (req, res) => {
  const data = await getProjectImpact(req.params.id, req.user);
  res.json({ success: true, ...data });
});

export const createImpact = asyncHandler(async (req, res) => {
  const data = await saveImpact(req.params.id, req.user, req.body);
  res.status(201).json({ success: true, message: 'Impact data recorded', ...data });
});

export const patchImpact = asyncHandler(async (req, res) => {
  const data = await saveImpact(req.params.id, req.user, req.body, { isPatch: true });
  res.json({ success: true, message: 'Impact data updated', ...data });
});

export const generateImpactSummary = asyncHandler(async (req, res) => {
  const data = await regenerateImpactSummary(req.params.id, req.user);
  res.json({
    success: true,
    message: 'AI-assisted summary generated — please review before publishing',
    ...data,
  });
});

export const replicationOpportunities = asyncHandler(async (req, res) => {
  const data = await findReplicationOpportunities(req.params.id);
  res.json({ success: true, ...data });
});

// ---------- AI Project Risk Detection ----------

export const analyzeRisk = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!canViewProject(req.user, project)) {
    throw new ApiError(403, 'You do not have permission to analyze this project');
  }

  const assessment = await assessProjectRisk(req.params.id, req.user, { force: true });
  const data = await getProjectRiskHistory(req.params.id, false, req.user);

  res.json({
    success: true,
    message: 'AI-assisted project risk assessment completed',
    assessment,
    trend: data.trend,
  });
});

export const getRisk = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!canViewProject(req.user, project)) {
    throw new ApiError(403, 'You do not have permission to view risk analysis for this project');
  }

  const data = await getProjectRiskHistory(req.params.id, true, req.user);
  res.json({
    success: true,
    latest: data.latest,
    trend: data.trend,
    history: data.history,
  });
});

export const getRiskSummary = asyncHandler(async (req, res) => {
  const data = await getProjectsRiskSummary(req.query, req.user);
  res.json({ success: true, ...data });
});

