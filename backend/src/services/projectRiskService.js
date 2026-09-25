import { env } from '../config/env.js';
import Project from '../models/Project.js';
import Milestone from '../models/Milestone.js';
import Funding from '../models/Funding.js';
import ProjectRiskAssessment from '../models/ProjectRiskAssessment.js';
import ApiError from '../utils/ApiError.js';
import { buildProjectScopeFilter } from './governmentScopeService.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 14000;

const SYSTEM_PROMPT = `You are an AI risk detection engine for JOHAR, a societal challenge-solving platform in Jharkhand, India.
Your role is to assess project execution risks to assist human project managers, university teams, and government authorities.
Important Principles:
- AI must ASSIST humans. It must NEVER automatically cancel, reject, or punish any project.
- You must analyze ONLY the supplied objective deterministic facts. Never invent unmentioned facts, budgets, or claims.
- riskLevel MUST be exactly one of: LOW, MEDIUM, HIGH, CRITICAL.
- riskScore is an integer 0-100 indicating risk severity (not a project performance ranking or score).
- riskFactors items MUST have:
  - "type": exactly one of "schedule", "milestone", "evidence", "verification", "dependency", "collaboration", "budget"
  - "severity": "low", "medium", "high", "critical"
  - "explanation": a concise factual explanation (e.g. "Actual progress of 20% lags expected 70% based on elapsed duration.")
- recommendedActions: actionable human suggestions (e.g. "Conduct local site review of blocked milestone", "Upload lab test certificate")
- Label output: "AI-assisted project risk assessment"

Respond with ONLY valid JSON, no markdown, in this exact format:
{
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskScore": 0,
  "summary": "2-3 sentences explaining the primary risk factors and current state",
  "riskFactors": [
    {
      "type": "schedule",
      "severity": "high",
      "explanation": "..."
    }
  ],
  "recommendedActions": ["action 1", "action 2"],
  "missingInformation": []
}`;

function extractJson(content) {
  if (!content) throw new Error('Empty AI response');
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('AI response is not valid JSON');
  }
}

/**
 * 1. Collects deterministic, objective signals from existing database data.
 */
export function collectDeterministicSignals(project, milestones = [], fundings = []) {
  const now = Date.now();
  const actualProgress = Number(project.currentProgress || 0);

  // Schedule signals
  let expectedProgress = 0;
  let progressGap = 0;
  let projectDaysOverdue = 0;

  if (project.startDate && project.expectedEndDate) {
    const start = new Date(project.startDate).getTime();
    const end = new Date(project.expectedEndDate).getTime();
    const totalDuration = end - start;

    if (totalDuration > 0 && now > start) {
      const elapsed = Math.max(0, now - start);
      expectedProgress = Math.min(100, Math.round((elapsed / totalDuration) * 100));
      progressGap = Math.max(0, expectedProgress - actualProgress);
    }

    if (now > end && project.status !== 'completed' && project.status !== 'deployed') {
      projectDaysOverdue = Math.floor((now - end) / (1000 * 60 * 60 * 24));
    }
  }

  // Milestones signals
  let completedMilestones = 0;
  let delayedMilestones = 0;
  let blockedMilestones = 0;
  let pendingVerificationMilestones = 0;
  let changesRequestedMilestones = 0;
  let missingEvidenceMilestones = 0;

  for (const m of milestones) {
    const isCompleted =
      m.status === 'completed' ||
      m.executionStatus === 'completed' ||
      m.verificationStatus === 'verified';

    if (isCompleted) completedMilestones += 1;

    if (!isCompleted && m.dueDate && new Date(m.dueDate).getTime() < now) {
      delayedMilestones += 1;
    }

    if (m.executionStatus === 'blocked' || m.status === 'blocked') {
      blockedMilestones += 1;
    }

    if (m.verificationStatus === 'submitted' || m.verificationStatus === 'under_review') {
      pendingVerificationMilestones += 1;
    }

    if (m.verificationStatus === 'changes_requested') {
      changesRequestedMilestones += 1;
    }

    // Missing evidence: if marked completed or submitted, but has no evidence items attached
    const hasEvidence = Array.isArray(m.evidence) && m.evidence.length > 0;
    if ((isCompleted || m.verificationStatus === 'submitted') && !hasEvidence) {
      missingEvidenceMilestones += 1;
    }
  }

  // Budget signals
  const estimatedBudget = project.estimatedBudget?.amount || 0;
  const actualBudget = project.actualBudget?.amount || 0;
  const totalFundingCommitments = fundings.reduce((sum, f) => sum + (f.amount || 0), 0);
  const budgetOverrun =
    actualBudget > estimatedBudget && estimatedBudget > 0 ? actualBudget - estimatedBudget : 0;

  // Collaboration signals
  const hasUniversity = Boolean(project.university);
  const industryPartnersCount = project.industryPartners?.length || 0;
  const teamMembersCount = project.teamMembers?.length || 0;

  return {
    actualProgress,
    expectedProgress,
    progressGap,
    projectDaysOverdue,
    daysOverdue: projectDaysOverdue,
    projectStatus: project.status,
    totalMilestones: milestones.length,
    completedMilestones,
    delayedMilestones,
    blockedMilestones,
    pendingVerificationMilestones,
    pendingVerification: pendingVerificationMilestones,
    changesRequestedMilestones,
    missingEvidenceMilestones,
    missingEvidence: missingEvidenceMilestones,
    estimatedBudget,
    actualBudget,
    totalFundingCommitments,
    budgetOverrun,
    hasUniversity,
    industryPartnersCount,
    teamMembersCount,
  };
}

/**
 * 2. Deterministic risk calculation baseline (used standalone or as reliable fallback).
 */
export function computeDeterministicRisk(signals) {
  let score = 5;
  const factors = [];
  const actions = [];
  const missingInfo = [];

  // Schedule risk
  if (signals.projectDaysOverdue > 14) {
    score += 35;
    factors.push({
      type: 'schedule',
      severity: 'critical',
      explanation: `Project is ${signals.projectDaysOverdue} days past expected completion date.`,
    });
    actions.push('Schedule emergency timeline review with project team');
  } else if (signals.projectDaysOverdue > 0) {
    score += 20;
    factors.push({
      type: 'schedule',
      severity: 'high',
      explanation: `Project is ${signals.projectDaysOverdue} days past expected completion date.`,
    });
    actions.push('Review overdue deliverables and finalize remaining pilot tasks');
  } else if (signals.progressGap >= 30) {
    score += 25;
    factors.push({
      type: 'schedule',
      severity: 'high',
      explanation: `Actual progress (${signals.actualProgress}%) is lagging expected schedule (${signals.expectedProgress}%) by ${signals.progressGap}%.`,
    });
    actions.push('Evaluate resource allocation to close the schedule progress gap');
  } else if (signals.progressGap >= 15) {
    score += 15;
    factors.push({
      type: 'schedule',
      severity: 'medium',
      explanation: `Actual progress (${signals.actualProgress}%) is slightly behind expected schedule (${signals.expectedProgress}%).`,
    });
    actions.push('Monitor upcoming milestone timelines closely');
  }

  // Milestone risk
  if (signals.blockedMilestones > 0) {
    score += 25;
    factors.push({
      type: 'milestone',
      severity: 'high',
      explanation: `${signals.blockedMilestones} milestone(s) are currently marked as blocked by team.`,
    });
    actions.push('Review blocked milestone dependencies with university faculty mentor');
  }

  if (signals.delayedMilestones > 0) {
    score += Math.min(20, signals.delayedMilestones * 10);
    factors.push({
      type: 'milestone',
      severity: signals.delayedMilestones > 1 ? 'high' : 'medium',
      explanation: `${signals.delayedMilestones} milestone(s) have passed their due dates without completion.`,
    });
    actions.push('Reschedule or expedite overdue milestones');
  }

  // Evidence risk
  if (signals.missingEvidenceMilestones > 0) {
    score += 15;
    factors.push({
      type: 'evidence',
      severity: 'medium',
      explanation: `${signals.missingEvidenceMilestones} completed/submitted milestone(s) lack completion evidence attachments.`,
    });
    actions.push('Upload verification reports, field photos, or test certificates as completion evidence');
  }

  // Verification risk
  if (signals.changesRequestedMilestones > 0) {
    score += 10;
    factors.push({
      type: 'verification',
      severity: 'medium',
      explanation: `${signals.changesRequestedMilestones} milestone(s) have revisions requested by verifying authorities.`,
    });
    actions.push('Review and address requested revisions from the verifying authority');
  }

  // Budget risk
  if (signals.budgetOverrun > 0) {
    score += 15;
    factors.push({
      type: 'budget',
      severity: 'medium',
      explanation: `Actual expenses exceed estimated budget by ₹${signals.budgetOverrun.toLocaleString('en-IN')}.`,
    });
    actions.push('Review project expenditures against allocated budget');
  }

  // Collaboration check
  if (!signals.hasUniversity && signals.projectStatus !== 'proposed') {
    missingInfo.push('University partner profile not linked');
  }

  const riskScore = Math.min(100, Math.max(0, score));

  let riskLevel = 'LOW';
  if (riskScore >= 75) riskLevel = 'CRITICAL';
  else if (riskScore >= 50) riskLevel = 'HIGH';
  else if (riskScore >= 25) riskLevel = 'MEDIUM';

  const summary =
    riskLevel === 'LOW'
      ? 'Project is progressing according to schedule with no critical blockers detected.'
      : riskLevel === 'MEDIUM'
        ? `Moderate execution risks detected: ${factors.map((f) => f.explanation).slice(0, 2).join(' ')}`
        : `Elevated project risks identified: ${factors.map((f) => f.explanation).slice(0, 2).join(' ')}`;

  return {
    riskLevel,
    riskScore,
    summary,
    riskFactors: factors,
    recommendedActions: actions.length > 0 ? actions : ['Continue ongoing project monitoring'],
    missingInformation: missingInfo,
  };
}

/**
 * 3. Calls Groq API to interpret structured deterministic facts into nuanced assessment.
 */
export async function analyzeProjectWithGroq(signals, projectTitle) {
  if (!env.GROQ_API_KEY) return null;

  const userContent = JSON.stringify({
    projectTitle,
    ...signals,
  });

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 750,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`[projectRiskService] Groq API returned status ${response.status}`);
      return null;
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    const parsed = extractJson(content);

    // Validate riskLevel
    const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const riskLevel = String(parsed.riskLevel || '').toUpperCase();
    if (!validLevels.includes(riskLevel)) return null;

    const riskScore = Math.min(100, Math.max(0, Number(parsed.riskScore) || 50));

    const riskFactors = Array.isArray(parsed.riskFactors)
      ? parsed.riskFactors.map((rf) => ({
          type: String(rf.type || 'general').toLowerCase(),
          severity: String(rf.severity || 'medium').toLowerCase(),
          explanation: String(rf.explanation || '').trim(),
        }))
      : [];

    const recommendedActions = Array.isArray(parsed.recommendedActions)
      ? parsed.recommendedActions.map((a) => String(a).trim()).filter(Boolean)
      : [];

    const missingInformation = Array.isArray(parsed.missingInformation)
      ? parsed.missingInformation.map((m) => String(m).trim()).filter(Boolean)
      : [];

    return {
      riskLevel,
      riskScore,
      summary: String(parsed.summary || '').trim(),
      riskFactors,
      recommendedActions,
      missingInformation,
    };
  } catch (err) {
    console.warn(`[projectRiskService] Groq AI analysis failed or timed out: ${err.message}`);
    return null;
  }
}

// Track concurrent in-flight risk analyses to avoid duplicate Groq calls
const activeAssessments = new Map();

/**
 * 4. Generates and records an AI-assisted project risk assessment.
 * Avoids duplicate concurrent requests and respects cooldown for automated triggers.
 */
export async function assessProjectRisk(projectId, user = null, options = {}) {
  const pIdStr = String(projectId);
  if (activeAssessments.has(pIdStr)) {
    return activeAssessments.get(pIdStr);
  }

  const assessmentPromise = (async () => {
    const project = await Project.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    // If not forced (e.g. automated event trigger), avoid calling AI if recent analysis exists (5 min cooldown)
    if (!options.force) {
      const recent = await ProjectRiskAssessment.findOne({ project: projectId })
        .sort({ generatedAt: -1 });
      if (recent && (Date.now() - new Date(recent.generatedAt).getTime()) < 5 * 60 * 1000) {
        return recent;
      }
    }

    const [milestones, fundings] = await Promise.all([
      Milestone.find({ project: project._id }).lean(),
      Funding.find({ project: project._id }).lean(),
    ]);

    const signals = collectDeterministicSignals(project, milestones, fundings);

    // First try Groq AI; if unavailable, use deterministic signals
    const groqAssessment = await analyzeProjectWithGroq(signals, project.title);
    const finalAssessmentData = groqAssessment || computeDeterministicRisk(signals);

    const assessment = await ProjectRiskAssessment.create({
      project: project._id,
      riskLevel: finalAssessmentData.riskLevel,
      riskScore: finalAssessmentData.riskScore,
      summary: finalAssessmentData.summary,
      riskFactors: finalAssessmentData.riskFactors,
      recommendedActions: finalAssessmentData.recommendedActions,
      missingInformation: finalAssessmentData.missingInformation,
      progressAtAssessment: project.currentProgress || 0,
      analysisVersion: groqAssessment ? 'v1-groq' : 'v1-deterministic',
      isAiGenerated: Boolean(groqAssessment),
      signals,
      generatedAt: new Date(),
      generatedBy: user?._id || undefined,
    });

    return assessment;
  })();

  activeAssessments.set(pIdStr, assessmentPromise);
  try {
    return await assessmentPromise;
  } finally {
    activeAssessments.delete(pIdStr);
  }
}

/**
 * Non-blocking event-triggered risk assessment.
 * Does not block caller or throw unhandled exceptions.
 */
export function triggerProjectRiskUpdateOnEvent(projectId, eventReason = '') {
  if (!projectId) return;
  setImmediate(async () => {
    try {
      await assessProjectRisk(projectId, null, { force: false });
    } catch (err) {
      console.warn(`[projectRiskService] Event-triggered risk update for ${projectId} (${eventReason}): ${err.message}`);
    }
  });
}

/**
 * 5. Returns latest risk assessment and historical trend.
 */
export async function getProjectRiskHistory(projectId, autoGenerateIfMissing = true, user = null) {
  let latest = await ProjectRiskAssessment.findOne({ project: projectId })
    .sort({ generatedAt: -1 })
    .populate('generatedBy', 'name role');

  if (!latest && autoGenerateIfMissing) {
    latest = await assessProjectRisk(projectId, user);
  }

  const history = await ProjectRiskAssessment.find({ project: projectId })
    .sort({ generatedAt: -1 })
    .limit(10)
    .select('riskLevel riskScore progressAtAssessment isAiGenerated generatedAt')
    .lean();

  return {
    latest,
    history,
    trend: history.map((h) => ({
      riskLevel: h.riskLevel,
      riskScore: h.riskScore,
      progress: h.progressAtAssessment,
      date: h.generatedAt,
      isAi: h.isAiGenerated,
    })),
  };
}

/**
 * 6. Returns risk overview summary across scoped projects.
 */
export async function getProjectsRiskSummary(query = {}, user = null) {
  const { status, riskLevel, district, department, university, industry, search, limit = 25, page = 1 } = query;

  const additionalFilters = {};
  if (status) additionalFilters.status = status;
  if (university) additionalFilters.university = university;
  if (industry) additionalFilters.industryPartners = industry;
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
  if (search?.trim()) {
    additionalFilters.$text = { $search: search.trim() };
  }

  const scopeFilter = buildProjectScopeFilter(user, additionalFilters);

  const projects = await Project.find(scopeFilter)
    .populate('university', 'name district')
    .populate('governmentOwnership.assignedAuthority', 'name email department')
    .lean();

  const projectIds = projects.map((p) => p._id);

  // Fetch latest risk assessments for these projects
  const assessments = await ProjectRiskAssessment.find({
    project: { $in: projectIds },
  })
    .sort({ generatedAt: -1 })
    .lean();

  const assessmentByProject = new Map();
  for (const a of assessments) {
    const pId = a.project.toString();
    if (!assessmentByProject.has(pId)) {
      assessmentByProject.set(pId, a);
    }
  }

  // For projects without assessment yet, calculate deterministic signals
  const allMilestones = await Milestone.find({ project: { $in: projectIds } }).lean();
  const milestonesByProject = new Map();
  for (const m of allMilestones) {
    const pId = m.project.toString();
    if (!milestonesByProject.has(pId)) milestonesByProject.set(pId, []);
    milestonesByProject.get(pId).push(m);
  }

  let projectsWithRisk = projects.map((proj) => {
    let assess = assessmentByProject.get(proj._id.toString());
    const mList = milestonesByProject.get(proj._id.toString()) || [];
    const signals = collectDeterministicSignals(proj, mList);

    if (!assess) {
      assess = computeDeterministicRisk(signals);
      assess.generatedAt = null;
      assess.isAiGenerated = false;
    }

    return {
      project: {
        _id: proj._id,
        title: proj.title,
        status: proj.status,
        currentProgress: proj.currentProgress || 0,
        startDate: proj.startDate,
        expectedEndDate: proj.expectedEndDate,
        university: proj.university,
        governmentOwnership: proj.governmentOwnership,
        deploymentDetails: proj.deploymentDetails,
      },
      signals,
      assessment: assess,
    };
  });

  if (riskLevel) {
    projectsWithRisk = projectsWithRisk.filter(
      (p) => p.assessment?.riskLevel === riskLevel.toUpperCase()
    );
  }

  // Summary counts
  const summary = {
    total: projectsWithRisk.length,
    critical: projectsWithRisk.filter((p) => p.assessment?.riskLevel === 'CRITICAL').length,
    high: projectsWithRisk.filter((p) => p.assessment?.riskLevel === 'HIGH').length,
    medium: projectsWithRisk.filter((p) => p.assessment?.riskLevel === 'MEDIUM').length,
    low: projectsWithRisk.filter((p) => p.assessment?.riskLevel === 'LOW').length,
  };

  const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const parsedPage = Math.max(1, Number(page) || 1);
  const skip = (parsedPage - 1) * parsedLimit;
  const paginated = projectsWithRisk.slice(skip, skip + parsedLimit);

  return {
    summary,
    projects: paginated,
    pagination: {
      total: projectsWithRisk.length,
      page: parsedPage,
      pages: Math.ceil(projectsWithRisk.length / parsedLimit) || 1,
      limit: parsedLimit,
    },
  };
}
