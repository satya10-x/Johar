import Project from '../models/Project.js';
import Milestone from '../models/Milestone.js';
import Escalation from '../models/Escalation.js';
import Challenge from '../models/Challenge.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  getUserScope,
  buildProjectScopeFilter,
  canAssignAuthority,
  canManageEscalation,
  HIERARCHY_LEVELS,
  GOV_DEPARTMENTS,
  CATEGORY_DEPARTMENT_MAP,
} from '../services/governmentScopeService.js';
import {
  computeProjectAtRisk,
  runEscalationScan,
  createManualEscalation,
  advanceEscalationLevel,
  updateEscalationStatus,
} from '../services/escalationService.js';
import { logGovernanceAction, listAuditLogs } from '../services/auditService.js';

const JHARKHAND_DISTRICTS = [
  'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum',
  'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara',
  'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu',
  'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela-Kharsawan', 'Simdega',
  'West Singhbhum',
];

/**
 * Returns scope-filtered projects for government monitoring.
 */
export const getProjects = asyncHandler(async (req, res) => {
  const { district, department, status, atRisk, search, page = 1, limit = 20 } = req.query;

  const additionalFilters = {};
  if (district) {
    additionalFilters.$or = [
      { 'governmentOwnership.district': { $regex: new RegExp(`^${district}$`, 'i') } },
      { 'deploymentDetails.district': { $regex: new RegExp(`^${district}$`, 'i') } },
    ];
  }
  if (department) {
    additionalFilters['governmentOwnership.department'] = {
      $regex: new RegExp(`^${department}$`, 'i'),
    };
  }
  if (status) {
    additionalFilters.status = status;
  }
  if (search?.trim()) {
    additionalFilters.$text = { $search: search.trim() };
  }

  const scopeFilter = buildProjectScopeFilter(req.user, additionalFilters);

  const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const parsedPage = Math.max(1, Number(page) || 1);
  const skip = (parsedPage - 1) * parsedLimit;

  const [rawProjects, total] = await Promise.all([
    Project.find(scopeFilter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('university', 'name location district')
      .populate('challenge', 'title category district severity')
      .populate('governmentOwnership.assignedAuthority', 'name email role department')
      .lean(),
    Project.countDocuments(scopeFilter),
  ]);

  // Compute at-risk information for each project
  const projectIds = rawProjects.map((p) => p._id);
  const allMilestones = await Milestone.find({ project: { $in: projectIds } }).lean();

  const milestonesByProject = new Map();
  for (const m of allMilestones) {
    const pId = m.project.toString();
    if (!milestonesByProject.has(pId)) milestonesByProject.set(pId, []);
    milestonesByProject.get(pId).push(m);
  }

  let projectsWithRisk = rawProjects.map((proj) => {
    const projMilestones = milestonesByProject.get(proj._id.toString()) || [];
    const risk = computeProjectAtRisk(proj, projMilestones);
    return {
      ...proj,
      milestonesCount: projMilestones.length,
      completedMilestonesCount: projMilestones.filter(
        (m) => m.status === 'completed' || m.executionStatus === 'completed'
      ).length,
      awaitingVerificationCount: projMilestones.filter(
        (m) => m.verificationStatus === 'submitted'
      ).length,
      atRiskInfo: risk,
    };
  });

  if (atRisk === 'true') {
    projectsWithRisk = projectsWithRisk.filter((p) => p.atRiskInfo.isAtRisk);
  }

  // Calculate high-level metrics across scoped projects
  const [totalScoped, completedCount, cancelledCount] = await Promise.all([
    Project.countDocuments(buildProjectScopeFilter(req.user)),
    Project.countDocuments(buildProjectScopeFilter(req.user, { status: 'completed' })),
    Project.countDocuments(buildProjectScopeFilter(req.user, { status: 'cancelled' })),
  ]);

  res.json({
    success: true,
    projects: projectsWithRisk,
    stats: {
      total: totalScoped,
      active: totalScoped - completedCount - cancelledCount,
      completed: completedCount,
      cancelled: cancelledCount,
    },
    pagination: {
      total,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit) || 1,
      limit: parsedLimit,
    },
    userScope: getUserScope(req.user),
  });
});

/**
 * Returns scope-filtered milestones for government review & monitoring.
 */
export const getMilestones = asyncHandler(async (req, res) => {
  const { projectId, verificationStatus, executionStatus, district } = req.query;

  const projectFilter = buildProjectScopeFilter(
    req.user,
    district
      ? {
          $or: [
            { 'governmentOwnership.district': district },
            { 'deploymentDetails.district': district },
          ],
        }
      : {}
  );

  let scopedProjectIds;
  if (projectId) {
    scopedProjectIds = [projectId];
  } else {
    const projects = await Project.find(projectFilter).select('_id').lean();
    scopedProjectIds = projects.map((p) => p._id);
  }

  const milestoneFilter = { project: { $in: scopedProjectIds } };
  if (verificationStatus) milestoneFilter.verificationStatus = verificationStatus;
  if (executionStatus) milestoneFilter.executionStatus = executionStatus;

  const milestones = await Milestone.find(milestoneFilter)
    .sort({ dueDate: 1 })
    .populate('project', 'title status currentProgress governmentOwnership deploymentDetails')
    .populate('verifiedBy', 'name role department authorityLevel')
    .lean();

  const formatted = milestones.map((m) => ({
    ...m,
    evidenceCount: m.evidence?.length || 0,
    isOverdue:
      !['completed'].includes(m.status) &&
      m.dueDate &&
      new Date(m.dueDate) < new Date(),
  }));

  res.json({
    success: true,
    milestones: formatted,
    count: formatted.length,
    awaitingVerificationCount: formatted.filter((m) => m.verificationStatus === 'submitted').length,
  });
});

/**
 * Returns scope-filtered escalations.
 */
export const getEscalations = asyncHandler(async (req, res) => {
  const { status, trigger, level, projectId, challengeId } = req.query;

  const projectFilter = buildProjectScopeFilter(req.user);
  const projects = await Project.find(projectFilter).select('_id').lean();
  const scopedProjectIds = projects.map((p) => p._id);

  const filter = {};
  if (challengeId) {
    filter.$or = [{ challenge: challengeId }, { project: { $in: scopedProjectIds } }];
  } else {
    filter.project = { $in: scopedProjectIds };
  }

  if (projectId) filter.project = projectId;
  if (status) filter.status = status;
  if (trigger) filter.trigger = trigger;
  if (level) filter.currentLevel = level;

  const escalations = await Escalation.find(filter)
    .sort({ createdAt: -1 })
    .populate('project', 'title status currentProgress governmentOwnership')
    .populate('challenge', 'title category district status')
    .populate('milestone', 'title dueDate status verificationStatus')
    .populate('acknowledgedBy', 'name role department')
    .populate('resolvedBy', 'name role department')
    .lean();

  const stats = {
    open: escalations.filter((e) => e.status === 'open').length,
    acknowledged: escalations.filter((e) => e.status === 'acknowledged').length,
    resolved: escalations.filter((e) => e.status === 'resolved').length,
    dismissed: escalations.filter((e) => e.status === 'dismissed').length,
  };

  res.json({
    success: true,
    escalations,
    stats,
  });
});

/**
 * Creates a manual escalation for a project, milestone, or challenge.
 */
export const createEscalation = asyncHandler(async (req, res) => {
  const { projectId, challengeId, milestoneId, trigger, reason, severity, escalatedTo, targetLevel } = req.body;
  const escalation = await createManualEscalation({
    user: req.user,
    projectId,
    challengeId,
    milestoneId,
    trigger,
    reason,
    severity,
    escalatedTo: escalatedTo || targetLevel || 'district',
  });

  res.status(201).json({
    success: true,
    message: 'Escalation recorded',
    escalation,
  });
});

/**
 * Updates an escalation (acknowledge, resolve, dismiss, or advance level).
 */
export const updateEscalation = asyncHandler(async (req, res) => {
  const { action, notes } = req.body;
  const escalation = await Escalation.findById(req.params.id);
  if (!escalation) throw new ApiError(404, 'Escalation not found');

  const project = await Project.findById(escalation.project);
  if (!canManageEscalation(req.user, escalation, project)) {
    throw new ApiError(
      403,
      'You do not have the required authority scope to manage this escalation'
    );
  }

  let updated;
  if (action === 'advance') {
    updated = await advanceEscalationLevel(escalation._id, req.user, notes);
  } else if (['acknowledged', 'resolved', 'dismissed'].includes(action)) {
    updated = await updateEscalationStatus(escalation._id, req.user, action, notes);
  } else {
    throw new ApiError(400, 'Invalid escalation action');
  }

  res.json({
    success: true,
    message: `Escalation updated: ${action}`,
    escalation: updated,
  });
});

/**
 * Triggers automated escalation scan across active projects and milestones.
 */
export const scanEscalations = asyncHandler(async (req, res) => {
  const results = await runEscalationScan();
  res.json({
    success: true,
    message: 'Escalation scan completed',
    ...results,
  });
});

/**
 * Returns projects and milestones identified as AT RISK.
 */
export const getAtRisk = asyncHandler(async (req, res) => {
  const scopeFilter = buildProjectScopeFilter(req.user, {
    status: { $nin: ['completed', 'cancelled'] },
  });

  const projects = await Project.find(scopeFilter)
    .populate('university', 'name district')
    .populate('challenge', 'title category district severity')
    .populate('governmentOwnership.assignedAuthority', 'name email department')
    .lean();

  const projectIds = projects.map((p) => p._id);
  const allMilestones = await Milestone.find({ project: { $in: projectIds } }).lean();

  const milestonesByProject = new Map();
  for (const m of allMilestones) {
    const pId = m.project.toString();
    if (!milestonesByProject.has(pId)) milestonesByProject.set(pId, []);
    milestonesByProject.get(pId).push(m);
  }

  const atRiskList = [];

  for (const proj of projects) {
    const projMilestones = milestonesByProject.get(proj._id.toString()) || [];
    const risk = computeProjectAtRisk(proj, projMilestones);

    if (risk.isAtRisk) {
      atRiskList.push({
        project: {
          _id: proj._id,
          title: proj.title,
          status: proj.status,
          startDate: proj.startDate,
          expectedEndDate: proj.expectedEndDate,
          university: proj.university,
          challenge: proj.challenge,
          governmentOwnership: proj.governmentOwnership,
        },
        risk,
        milestones: projMilestones.map((m) => ({
          _id: m._id,
          title: m.title,
          dueDate: m.dueDate,
          status: m.status,
          executionStatus: m.executionStatus,
          verificationStatus: m.verificationStatus,
          isOverdue:
            m.status !== 'completed' && m.dueDate && new Date(m.dueDate) < new Date(),
        })),
      });
    }
  }

  res.json({
    success: true,
    atRiskProjects: atRiskList,
    count: atRiskList.length,
  });
});

/**
 * Returns governance audit logs.
 */
export const getAudit = asyncHandler(async (req, res) => {
  const result = await listAuditLogs(req.query);
  res.json({
    success: true,
    ...result,
  });
});

/**
 * Returns governance hierarchy metadata (levels, departments, districts, caller scope, and officers).
 */
export const getHierarchy = asyncHandler(async (req, res) => {
  const { district, department, level, search } = req.query;

  const officerQuery = { role: { $in: ['government', 'admin'] } };
  if (district) officerQuery.district = new RegExp(`^${district}$`, 'i');
  if (department) officerQuery.department = new RegExp(`^${department}$`, 'i');
  if (level) officerQuery.authorityLevel = level;
  if (search?.trim()) {
    officerQuery.$or = [
      { name: new RegExp(search.trim(), 'i') },
      { organization: new RegExp(search.trim(), 'i') },
      { department: new RegExp(search.trim(), 'i') },
      { district: new RegExp(search.trim(), 'i') },
    ];
  }

  const rawOfficers = await User.find(officerQuery)
    .select('name email phone role department authorityLevel state district block localBody organization')
    .sort({ authorityLevel: 1, district: 1, name: 1 })
    .lean();

  const officers = rawOfficers.map((o) => {
    const officerLevel = o.authorityLevel || (o.district ? 'district' : 'state');
    const isSameDistrict =
      req.user.district && o.district && req.user.district.toLowerCase() === o.district.toLowerCase();
    const canSeePrivateContact =
      req.user.role === 'admin' || req.user.authorityLevel === 'state' || isSameDistrict;

    return {
      _id: o._id,
      name: o.name,
      role: o.role,
      authorityLevel: officerLevel,
      department: o.department || 'District Administration',
      state: o.state || 'Jharkhand',
      district: o.district || 'State Level',
      block: o.block || null,
      localBody: o.localBody || null,
      organization:
        o.organization ||
        `${officerLevel === 'state' ? 'State Secretariat' : 'District Administration'}, ${o.district || 'Jharkhand'}`,
      email: canSeePrivateContact ? o.email : (o.email ? `${o.email.split('@')[0]}@jh.gov.in` : null),
      phone: canSeePrivateContact ? o.phone : null,
    };
  });

  const breakdown = {
    state: officers.filter((o) => o.authorityLevel === 'state' || o.role === 'admin').length,
    district: officers.filter((o) => o.authorityLevel === 'district').length,
    block: officers.filter((o) => o.authorityLevel === 'block').length,
    local_body: officers.filter((o) => o.authorityLevel === 'local_body').length,
    totalOfficers: officers.length,
  };

  // Build real-time hierarchy data and summary statistics within the caller's authority scope
  const scopeFilter = buildProjectScopeFilter(req.user);
  const projects = await Project.find(scopeFilter)
    .populate('challenge', 'title category district severity')
    .populate('university', 'name location district')
    .populate('industryPartners', 'companyName companyType')
    .populate('governmentOwnership.assignedAuthority', 'name email role department')
    .lean();

  const projectIds = projects.map((p) => p._id);
  const [allMilestones, allEscalations] = await Promise.all([
    Milestone.find({ project: { $in: projectIds } }).sort({ dueDate: 1 }).lean(),
    Escalation.find({ project: { $in: projectIds } }).lean(),
  ]);

  const milestonesByProject = new Map();
  for (const m of allMilestones) {
    const pId = m.project.toString();
    if (!milestonesByProject.has(pId)) milestonesByProject.set(pId, []);
    milestonesByProject.get(pId).push(m);
  }

  const escalationsByProject = new Map();
  for (const e of allEscalations) {
    if (e.project) {
      const pId = e.project.toString();
      if (!escalationsByProject.has(pId)) escalationsByProject.set(pId, []);
      escalationsByProject.get(pId).push(e);
    }
  }

  let totalDelayed = 0;
  let totalAtRisk = 0;
  const now = new Date();

  const enrichedProjects = projects.map((p) => {
    const pId = p._id.toString();
    const projMilestones = milestonesByProject.get(pId) || [];
    const projEscalations = escalationsByProject.get(pId) || [];
    const risk = computeProjectAtRisk(p, projMilestones);

    const isProjectOverdue =
      p.status !== 'completed' &&
      p.status !== 'cancelled' &&
      p.expectedEndDate &&
      new Date(p.expectedEndDate) < now;
    const hasOverdueMilestones = projMilestones.some(
      (m) => m.status !== 'completed' && m.dueDate && new Date(m.dueDate) < now
    );
    const isDelayed = Boolean(isProjectOverdue || hasOverdueMilestones);

    if (isDelayed) totalDelayed += 1;
    if (risk.isAtRisk) totalAtRisk += 1;

    const resolvedDistrict =
      p.governmentOwnership?.district ||
      p.deploymentDetails?.district ||
      p.challenge?.district ||
      (req.user.district || 'Ranchi');

    const resolvedBlock =
      p.governmentOwnership?.block ||
      p.deploymentDetails?.block ||
      'Sadar';

    const resolvedLocalBody =
      p.governmentOwnership?.localBody ||
      p.deploymentDetails?.localBody ||
      'Ward 1';

    return {
      _id: p._id,
      title: p.title,
      status: p.status,
      currentProgress: p.currentProgress || 0,
      expectedEndDate: p.expectedEndDate,
      startDate: p.startDate,
      challenge: p.challenge,
      university: p.university,
      industryPartners: p.industryPartners || [],
      governmentOwnership: p.governmentOwnership || {},
      resolvedDistrict,
      resolvedBlock,
      resolvedLocalBody,
      atRiskInfo: risk,
      milestones: projMilestones,
      openEscalationsCount: projEscalations.filter((e) => e.status === 'open').length,
      isDelayed,
    };
  });

  const totalProjects = enrichedProjects.length;
  const activeProjects = enrichedProjects.filter(
    (p) => !['completed', 'cancelled'].includes(p.status)
  ).length;
  const completedProjects = enrichedProjects.filter((p) => p.status === 'completed').length;
  const openEscalations = allEscalations.filter((e) => e.status === 'open').length;
  const pendingVerification = allMilestones.filter((m) => m.verificationStatus === 'submitted').length;

  const summaryStats = {
    totalProjects,
    activeProjects,
    completedProjects,
    delayedProjects: totalDelayed,
    atRiskProjects: totalAtRisk,
    openEscalations,
    pendingVerification,
  };

  const userScope = getUserScope(req.user);
  let visibleDistricts = JHARKHAND_DISTRICTS;
  if (!userScope.isUnrestricted && userScope.district) {
    visibleDistricts = [userScope.district];
  }

  const districtTrees = visibleDistricts.map((dName) => {
    const dProjects = enrichedProjects.filter(
      (p) => (p.resolvedDistrict || '').toLowerCase() === dName.toLowerCase()
    );

    const blockMap = new Map();
    for (const p of dProjects) {
      const bName = p.resolvedBlock || 'Sadar';
      if (!blockMap.has(bName)) blockMap.set(bName, []);
      blockMap.get(bName).push(p);
    }

    if (userScope.block && userScope.level === 'block') {
      const scopedBlock = userScope.block;
      const bProjects = blockMap.get(scopedBlock) || [];
      blockMap.clear();
      blockMap.set(scopedBlock, bProjects);
    }

    // Ensure at least a default 'Sadar' block if district has no projects yet
    if (blockMap.size === 0) {
      blockMap.set('Sadar Block', []);
    }

    const blocks = Array.from(blockMap.entries()).map(([bName, bProjects]) => {
      const localBodiesMap = new Map();
      for (const p of bProjects) {
        const lbName = p.resolvedLocalBody || 'General Gram Panchayat';
        if (!localBodiesMap.has(lbName)) localBodiesMap.set(lbName, []);
        localBodiesMap.get(lbName).push(p);
      }

      if (localBodiesMap.size === 0) {
        localBodiesMap.set('Panchayat / Ward 1', []);
      }

      const localBodies = Array.from(localBodiesMap.entries()).map(([lbName, lbProjects]) => ({
        name: lbName,
        projects: lbProjects,
      }));

      return {
        name: bName,
        stats: {
          total: bProjects.length,
          active: bProjects.filter((p) => !['completed', 'cancelled'].includes(p.status)).length,
          completed: bProjects.filter((p) => p.status === 'completed').length,
          delayed: bProjects.filter((p) => p.isDelayed).length,
          atRisk: bProjects.filter((p) => p.atRiskInfo?.isAtRisk).length,
        },
        projects: bProjects,
        localBodies,
      };
    });

    return {
      name: dName,
      stats: {
        total: dProjects.length,
        active: dProjects.filter((p) => !['completed', 'cancelled'].includes(p.status)).length,
        completed: dProjects.filter((p) => p.status === 'completed').length,
        delayed: dProjects.filter((p) => p.isDelayed).length,
        atRisk: dProjects.filter((p) => p.atRiskInfo?.isAtRisk).length,
      },
      blocks,
      projects: dProjects,
    };
  });

  const hierarchyTree = {
    state: 'Jharkhand',
    districts: districtTrees,
  };

  res.json({
    success: true,
    hierarchyLevels: HIERARCHY_LEVELS,
    departments: GOV_DEPARTMENTS,
    districts: JHARKHAND_DISTRICTS,
    userScope,
    officers,
    breakdown,
    summaryStats,
    hierarchyTree,
  });
});

/**
 * Assigns or updates government responsibility for a project.
 */
export const assignProjectAuthority = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');

  if (!canAssignAuthority(req.user, project)) {
    throw new ApiError(
      403,
      'You do not have the required authority scope to assign this project'
    );
  }

  const { department, authorityLevel, assignedAuthority, state, district, block, localBody, notes } =
    req.body;

  const oldOwnership = project.governmentOwnership ? { ...project.governmentOwnership.toObject() } : null;

  project.governmentOwnership = {
    department: department?.trim() || project.governmentOwnership?.department,
    authorityLevel: authorityLevel || project.governmentOwnership?.authorityLevel || 'district',
    assignedAuthority: assignedAuthority || project.governmentOwnership?.assignedAuthority || req.user._id,
    state: state?.trim() || 'Jharkhand',
    district: district?.trim() || project.governmentOwnership?.district || project.deploymentDetails?.district,
    block: block?.trim() || project.governmentOwnership?.block,
    localBody: localBody?.trim() || project.governmentOwnership?.localBody,
    assignedAt: new Date(),
    assignedBy: req.user._id,
    notes: notes?.trim() || project.governmentOwnership?.notes,
  };

  await project.save();

  await logGovernanceAction({
    actor: req.user,
    action: 'assignment',
    entityType: 'Project',
    entityId: project._id,
    entityTitle: project.title,
    oldValue: oldOwnership,
    newValue: project.governmentOwnership,
    notes,
  });

  res.json({
    success: true,
    message: 'Government authority assigned successfully',
    governmentOwnership: project.governmentOwnership,
  });
});

/**
 * Returns responsible government authority, department, officer, and escalation info for a challenge.
 */
export const getChallengeAuthority = asyncHandler(async (req, res) => {
  const challenge = await Challenge.findById(req.params.id)
    .populate('submittedBy', 'name');
  if (!challenge) throw new ApiError(404, 'Challenge not found');

  const solutionProject = await Project.findOne({ challenge: challenge._id })
    .select('title status currentProgress university governmentOwnership')
    .populate('university', 'name')
    .populate('governmentOwnership.assignedAuthority', 'name email role department district organization phone')
    .lean();

  const gov = solutionProject?.governmentOwnership;
  const defaultDepartment = CATEGORY_DEPARTMENT_MAP[challenge.category] || 'District Administration';

  const authorityInfo = {
    isExplicit: Boolean(gov?.department || gov?.assignedAuthority),
    authorityLevel: gov?.authorityLevel || 'district',
    department: gov?.department || defaultDepartment,
    district: gov?.district || challenge.district || 'Jharkhand',
    block: gov?.block || null,
    localBody: gov?.localBody || null,
    assignedOfficer: gov?.assignedAuthority || null,
    assignedAt: gov?.assignedAt || null,
    notes: gov?.notes || null,
  };

  const escalations = await Escalation.find({
    $or: [{ challenge: challenge._id }, ...(solutionProject ? [{ project: solutionProject._id }] : [])],
  })
    .sort({ createdAt: -1 })
    .populate('acknowledgedBy', 'name role department')
    .populate('resolvedBy', 'name role department')
    .lean();

  const activeEscalation = escalations.find((e) => e.status === 'open' || e.status === 'acknowledged');

  res.json({
    success: true,
    challenge: {
      _id: challenge._id,
      title: challenge.title,
      category: challenge.category,
      district: challenge.district,
      severity: challenge.severity,
      status: challenge.status,
    },
    solutionProject,
    authorityInfo,
    escalations,
    currentEscalationLevel: activeEscalation ? activeEscalation.escalatedTo : 'none',
  });
});
