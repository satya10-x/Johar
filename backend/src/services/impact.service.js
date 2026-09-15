import Project from '../models/Project.js';
import Challenge, { CHALLENGE_CATEGORIES } from '../models/Challenge.js';
import University from '../models/University.js';

import ApiError from '../utils/ApiError.js';
import { summarizeImpact as summarizeImpactAI, matchSolutionToChallenges as matchReplicationAI } from './groqService.js';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const SOLUTION_STATUSES = ['deployed', 'completed'];

// ---------- helpers ----------

function num(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function str(value, max) {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s ? s.slice(0, max) : undefined;
}

function sanitizeMetrics(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((m) => ({
      metric: str(m?.metric, 120),
      unit: str(m?.unit, 60),
      before: num(m?.before),
      after: num(m?.after),
    }))
    .filter((m) => m.metric);
}

function sanitizeDistricts(raw) {
  if (!Array.isArray(raw)) return undefined;
  const cleaned = [...new Set(raw.map((d) => String(d).trim()).filter(Boolean))];
  return cleaned.length ? cleaned.slice(0, 30) : undefined;
}

export function sanitizeImpactBody(body = {}) {
  const payload = {};
  if (body.peopleBenefited !== undefined) payload.peopleBenefited = num(body.peopleBenefited);
  if (body.householdsBenefited !== undefined) payload.householdsBenefited = num(body.householdsBenefited);
  if (body.villagesCovered !== undefined) payload.villagesCovered = num(body.villagesCovered);
  if (body.communitySatisfaction !== undefined) {
    const s = num(body.communitySatisfaction);
    if (s !== undefined && (s < 0 || s > 100)) {
      throw new ApiError(400, 'communitySatisfaction must be between 0 and 100');
    }
    payload.communitySatisfaction = s;
  }
  if (body.implementationCost !== undefined) payload.implementationCost = num(body.implementationCost);
  if (body.estimatedSavings !== undefined) payload.estimatedSavings = num(body.estimatedSavings);
  if (body.jobsCreated !== undefined) payload.jobsCreated = num(body.jobsCreated);
  if (body.incomeImprovement !== undefined) payload.incomeImprovement = str(body.incomeImprovement, 300);
  if (body.timeSaved !== undefined) payload.timeSaved = str(body.timeSaved, 300);
  if (body.resourcesSaved !== undefined) payload.resourcesSaved = str(body.resourcesSaved, 300);
  if (body.environmentalImpact !== undefined) payload.environmentalImpact = str(body.environmentalImpact, 1000);
  if (body.impactSummary !== undefined) payload.impactSummary = str(body.impactSummary, 2000);
  if (body.metrics !== undefined) payload.metrics = sanitizeMetrics(body.metrics) || [];
  if (body.districtsCovered !== undefined) payload.districtsCovered = sanitizeDistricts(body.districtsCovered) || [];
  return payload;
}

// ---------- 5. indicative impact score ----------

export function computeImpactScore(impact) {
  if (!impact) return 0;
  let score = 0;

  // reach — people benefited (log scale), capped at 25
  const people = impact.peopleBenefited || 0;
  score += Math.min(25, Math.round((Math.log10(people + 1) / Math.log10(100000)) * 25));

  // measurable improvement — before/after metrics that improved, capped at 20
  const improved = (impact.metrics || []).filter(
    (m) => Number.isFinite(m.before) && Number.isFinite(m.after) && m.after > m.before
  ).length;
  score += Math.min(20, improved * 7);

  // community satisfaction — up to 15
  if (Number.isFinite(impact.communitySatisfaction)) {
    score += Math.round((impact.communitySatisfaction / 100) * 15);
  }

  // geographic reach — districts (10) + villages (5)
  score += Math.min(10, (impact.districtsCovered?.length || 0) * 5);
  score += Math.min(5, Math.round(Math.log10((impact.villagesCovered || 0) + 1) * 5));

  // adoption & economic signals — jobs, income, time saved, up to 15
  let econ = 0;
  if ((impact.jobsCreated || 0) > 0) econ += 6;
  if (impact.incomeImprovement) econ += 5;
  if (impact.timeSaved) econ += 4;
  score += Math.min(15, econ);

  // sustainability signals — resources/environment notes, up to 10
  let sustain = 0;
  if (impact.resourcesSaved) sustain += 5;
  if (impact.environmentalImpact) sustain += 5;
  score += Math.min(10, sustain);

  return Math.max(0, Math.min(100, score));
}

// deterministic fallback summary — uses ONLY stored values
function templateSummary(project, impact) {
  const parts = [];

  const places = [];
  if (impact.villagesCovered) places.push(`${impact.villagesCovered} village${impact.villagesCovered === 1 ? '' : 's'}`);
  if (impact.districtsCovered?.length) places.push(`${impact.districtsCovered.length} district${impact.districtsCovered.length === 1 ? '' : 's'}`);
  if (places.length) parts.push(`Implemented across ${places.join(' and ')}`);

  if (impact.peopleBenefited) {
    parts.push(`benefited approximately ${impact.peopleBenefited.toLocaleString('en-IN')} people`);
  } else if (impact.householdsBenefited) {
    parts.push(`benefited approximately ${impact.householdsBenefited.toLocaleString('en-IN')} households`);
  }

  const improvements = (impact.metrics || [])
    .filter((m) => Number.isFinite(m.before) && Number.isFinite(m.after))
    .slice(0, 2)
    .map((m) => `${m.metric} changed from ${m.before}${m.unit ? ` ${m.unit}` : ''} to ${m.after}${m.unit ? ` ${m.unit}` : ''}`);
  if (improvements.length) parts.push(improvements.join(' and '));

  if (impact.jobsCreated) parts.push(`created ${impact.jobsCreated} job${impact.jobsCreated === 1 ? '' : 's'}`);

  let sentence = parts.join('. ');
  if (sentence) sentence += '.';
  else if (impact.impactSummary) return impact.impactSummary;

  return sentence || null;
}

async function getProjectOr404(id) {
  const idStr = String(id || '');
  if (!idStr.match(OBJECT_ID_RE)) throw new ApiError(400, 'Invalid project ID format');
  const project = await Project.findById(idStr).populate('challenge', 'title category district subCategory tags aiClassification description');
  if (!project) throw new ApiError(404, 'Project not found');
  return project;
}

// ---------- 3. impact CRUD ----------

export async function getProjectImpact(id, user) {
  const project = await getProjectOr404(id);
  const isManager = user ? await canManageProjectUser(user, project) : false;

  // public users only see impact for deployed/completed solutions
  if (!isManager && !SOLUTION_STATUSES.includes(project.status)) {
    throw new ApiError(404, 'Impact information is not available for this project yet');
  }
  if (!project.impact) {
    return { impact: null, impactScore: 0 };
  }
  const obj = project.impact.toObject();
  delete obj.updatedBy;
  return {
    impact: obj,
    impactScore: obj.impactScore ?? 0,
    aiAssisted: Boolean(obj.aiSummary),
    canEdit: isManager,
  };
}

async function canManageProjectUser(user, project) {
  if (user.role === 'admin') return true;
  if (!project.university) return false;
  const uni = await University.findById(project.university).select('createdBy');
  return Boolean(uni?.createdBy && uni.createdBy.toString() === user._id.toString());
}

export async function saveImpact(id, user, body, { isPatch = false } = {}) {
  const project = await getProjectOr404(id);
  if (!(await canManageProjectUser(user, project))) {
    throw new ApiError(403, 'Only the project university or an admin can manage impact data');
  }

  const updates = sanitizeImpactBody(body);

  if (!project.impact) {
    if (isPatch && Object.keys(updates).length === 0) {
      throw new ApiError(404, 'No impact record exists yet — create one first');
    }
    project.impact = {};
  }

  for (const [key, value] of Object.entries(updates)) {
    project.impact[key] = value === undefined ? project.impact[key] : value;
  }
  project.impact.updatedBy = user._id;
  project.impact.scoreComputedAt = new Date();
  project.impact.impactScore = computeImpactScore(project.impact);

  // keep a factual template summary available when nothing better exists
  if (!project.impact.aiSummary && !project.impact.impactSummary) {
    project.impact.impactSummary = templateSummary(project, project.impact);
  }

  await project.save();

  const obj = project.impact.toObject();
  delete obj.updatedBy;
  return { impact: obj, impactScore: obj.impactScore ?? 0 };
}

export async function regenerateImpactSummary(id, user) {
  const project = await getProjectOr404(id);
  if (!(await canManageProjectUser(user, project))) {
    throw new ApiError(403, 'Only the project university or an admin can manage impact data');
  }
  if (!project.impact) {
    throw new ApiError(400, 'Record impact data first, then generate a summary');
  }

  const profile = {
    title: project.title,
    district: project.deploymentDetails?.district,
    districtsCovered: project.impact.districtsCovered || [],
    villagesCovered: project.impact.villagesCovered,
    peopleBenefited: project.impact.peopleBenefited,
    householdsBenefited: project.impact.householdsBenefited,
    jobsCreated: project.impact.jobsCreated,
    metrics: project.impact.metrics || [],
    incomeImprovement: project.impact.incomeImprovement,
    timeSaved: project.impact.timeSaved,
  };

  try {
    const summary = await summarizeImpactAI(profile);
    project.impact.aiSummary = summary;
    project.impact.aiSummaryGeneratedAt = new Date();
  } catch (err) {
    console.error(`[ai] impact summary failed: ${err.message}`);
    // fall back to the deterministic template so a summary always exists
    project.impact.impactSummary =
      templateSummary(project, project.impact) || project.impact.impactSummary;
  }

  await project.save();
  const obj = project.impact.toObject();
  delete obj.updatedBy;
  return { impact: obj, impactScore: obj.impactScore ?? 0 };
}

// ---------- 7/8. solution record & discovery ----------

function solutionCard(project) {
  const challenge = project.challenge || {};
  const impact = project.impact || {};
  return {
    _id: project._id,
    title: project.title,
    problemSolved: challenge.title || null,
    category: challenge.category || null,
    district: challenge.district || null,
    description: String(project.description || '').slice(0, 220),
    technologies: project.technologies || [],
    university: project.university?.name || null,
    industryPartners: (project.industryPartners || []).map((p) => p.companyName),
    deploymentStatus: project.status,
    completionDate: project.completionDate,
    implementationCost: impact.implementationCost,
    estimatedSavings: impact.estimatedSavings,
    impactScore: impact.impactScore ?? 0,
    peopleBenefited: impact.peopleBenefited,
    districtsCovered: impact.districtsCovered || [],
    villagesCovered: impact.villagesCovered,
    hasImpactData: Boolean(project.impact),
  };
}

export async function listSolutions(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  const filter = { status: { $in: SOLUTION_STATUSES }, challenge: { $exists: true } };

  if (query.status && SOLUTION_STATUSES.includes(query.status)) {
    filter.status = query.status;
  }
  if (query.category && CHALLENGE_CATEGORIES.includes(query.category)) {
    const ids = await Challenge.find({ category: query.category }).distinct('_id');
    filter.challenge = { $in: ids };
  }
  if (query.district) {
    const ids = await Challenge.find({ district: query.district }).distinct('_id');
    // no challenges in this district → no solutions can match
    if (!ids.length) {
      return {
        solutions: [],
        pagination: { page, limit, total: 0, totalPages: 1, hasNextPage: false },
      };
    }
    filter.challenge = filter.challenge
      ? { $in: filter.challenge.$in.filter((cid) => ids.some((id2) => id2.equals(cid))) }
      : { $in: ids };
  }
  if (query.technology) {
    filter.technologies = {
      $regex: String(query.technology).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      $options: 'i',
    };
  }

  const minScore = num(query.minImpactScore);
  const sort = minScore !== undefined ? { 'impact.impactScore': -1 } : { 'impact.impactScore': -1, createdAt: -1 };

  const pipeline = [
    { $match: filter },
    ...(minScore !== undefined
      ? [{ $match: { 'impact.impactScore': { $gte: minScore } } }]
      : []),
  ];

  const [docs, total] = await Promise.all([
    Project.aggregate([
      ...pipeline,
      { $sort: sort },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $lookup: { from: 'challenges', localField: 'challenge', foreignField: '_id', as: 'challenge' } },
      { $unwind: '$challenge' },
      { $lookup: { from: 'universities', localField: 'university', foreignField: '_id', as: 'university' } },
      {
        $addFields: {
          universityName: { $arrayElemAt: ['$university.name', 0] },
        },
      },
    ]),
    Project.aggregate([...pipeline, { $count: 'total' }]),
  ]);

  const cards = docs.map((p) =>
    solutionCard({
      ...p,
      university: { name: p.universityName },
    })
  );

  return {
    solutions: cards,
    pagination: {
      page,
      limit,
      total: total[0]?.total || 0,
      totalPages: Math.ceil((total[0]?.total || 0) / limit) || 1,
      hasNextPage: page * limit < (total[0]?.total || 0),
    },
  };
}

export async function getSolutionById(id) {
  const project = await getProjectOr404(id);
  if (!SOLUTION_STATUSES.includes(project.status)) {
    throw new ApiError(404, 'This project is not deployed yet, so it is not listed as a solution');
  }

  await project.populate([
    { path: 'university', select: 'name' },
    { path: 'industryPartners', select: 'companyName companyType' },
  ]);

  const card = solutionCard(project);
  const impact = project.impact ? project.impact.toObject() : null;
  if (impact) delete impact.updatedBy;

  return {
    solution: {
      ...card,
      description: project.description,
      proposedSolution: project.proposedSolution || null,
      objectives: project.objectives || [],
      technologies: project.technologies || [],
      implementationRequirements: [
        ...(project.objectives || []).slice(0, 5),
        ...(project.technologies || []).slice(0, 8),
      ],
      deploymentDetails: project.deploymentDetails
        ? { description: project.deploymentDetails.description, district: project.deploymentDetails.district }
        : null,
      impact,
      impactScore: impact?.impactScore ?? 0,
      projectId: project._id,
    },
  };
}

// ---------- 9. replication opportunities ----------

function keywordOverlapScore(solutionTerms, challenge) {
  const challengeTerms = new Set();
  const collect = (text) => {
    for (const w of String(text || '').toLowerCase().split(/[^a-z\u0900-\u097F]+/)) {
      if (w.length > 3) challengeTerms.add(w);
    }
  };
  collect(challenge.title);
  collect(challenge.subCategory);
  (challenge.tags || []).forEach(collect);
  (challenge.aiClassification?.solutionDomains || []).forEach(collect);
  (challenge.aiClassification?.skillsRequired || []).forEach(collect);

  let hits = 0;
  for (const term of challengeTerms) {
    if (solutionTerms.has(term)) hits += 1;
  }
  return Math.min(85, hits * 17);
}

export async function findReplicationOpportunities(id, { force = false } = {}) {
  const project = await getProjectOr404(id);
  if (!SOLUTION_STATUSES.includes(project.status)) {
    throw new ApiError(400, 'Only deployed or completed solutions can be evaluated for replication');
  }

  const sourceChallenge = project.challenge;
  const excludeDistricts = new Set(
    [
      sourceChallenge?.district,
      ...(project.impact?.districtsCovered || []),
      project.deploymentDetails?.district,
    ].filter(Boolean)
  );

  // database filtering first — same category, still open, different districts
  const candidates = await Challenge.find({
    category: sourceChallenge?.category,
    status: { $nin: ['resolved', 'rejected'] },
    _id: { $ne: sourceChallenge?._id },
    district: { $nin: [...excludeDistricts] },
  })
    .sort({ priorityScore: -1, createdAt: -1 })
    .limit(15)
    .lean();

  if (candidates.length === 0) {
    return { opportunities: [], generatedBy: 'database', checkedAt: new Date() };
  }

  const solutionTerms = new Set();
  const collectSol = (text) => {
    for (const w of String(text || '').toLowerCase().split(/[^a-z\u0900-\u097F]+/)) {
      if (w.length > 3) solutionTerms.add(w);
    }
  };
  collectSol(project.title);
  collectSol(project.proposedSolution);
  collectSol(project.description);
  (project.technologies || []).forEach((t) => String(t).toLowerCase().split(/\s+/).forEach(collectSol));

  let matches;
  let generatedBy = 'database';
  try {
    matches = await matchReplicationAI(
      {
        title: project.title,
        description: project.description,
        proposedSolution: project.proposedSolution,
        technologies: project.technologies || [],
        category: sourceChallenge?.category,
        sourceDistrict: sourceChallenge?.district,
        implementedDistricts: project.impact?.districtsCovered || [],
        impactSummary: project.impact?.aiSummary || project.impact?.impactSummary || '',
      },
      candidates
    );
    generatedBy = 'ai';
  } catch (err) {
    console.error(`[ai] replication matching failed: ${err.message}`);
    matches = candidates.map((c) => ({
      challengeId: c._id.toString(),
      score: keywordOverlapScore(solutionTerms, c),
      reason: 'Shares problem keywords with this solution.',
    }));
  }

  const opportunities = matches
    .map((m) => {
      const c = candidates.find((x) => x._id.toString() === m.challengeId);
      if (!c) return null;
      return {
        challengeId: c._id,
        title: c.title,
        district: c.district,
        severity: c.severity,
        priorityScore: c.priorityScore ?? 0,
        affectedPopulation: c.affectedPopulation || null,
        matchScore: m.score,
        reason: m.reason,
      };
    })
    .filter(Boolean)
    .filter((o) => o.matchScore >= 40)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 8);

  return { opportunities, generatedBy, checkedAt: new Date() };
}
