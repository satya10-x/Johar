import mongoose from 'mongoose';

import Challenge, { CHALLENGE_CATEGORIES } from '../models/Challenge.js';
import Project, { PROJECT_STATUSES } from '../models/Project.js';
import Funding from '../models/Funding.js';
import University from '../models/University.js';
import Industry from '../models/Industry.js';
import CommunityValidation from '../models/CommunityValidation.js';
import CollaborationRequest from '../models/CollaborationRequest.js';
import Discussion from '../models/Discussion.js';

const ACTIVE_PROJECT_STATUSES = PROJECT_STATUSES.filter(
  (s) => !['proposed', 'completed', 'cancelled', 'deployed'].includes(s)
);
const ACTIVE_FUNDING_STATUSES = ['committed', 'approved', 'completed'];

// districts that have at least one project deployed/completed
const DEPLOYED_PROJECT_STATUSES = ['deployed', 'completed'];

function challengeMatch(district) {
  const match = {};
  if (district) match.district = district;
  return match;
}

async function challengeIdsInDistrict(district) {
  if (!district) return null;
  const rows = await Challenge.find({ district }).select('_id').lean();
  return rows.map((r) => r._id);
}

// ---------- 2. dashboard summary ----------

export async function getDashboardSummary(district) {
  const cMatch = challengeMatch(district);
  const challengeIds = await challengeIdsInDistrict(district);

  const projectMatch = challengeIds ? { challenge: { $in: challengeIds } } : {};

  const [
    totalChallenges,
    validatedChallenges,
    activeChallenges,
    resolvedChallenges,
    totalProjects,
    activeProjects,
    completedProjects,
    totalUniversities,
    totalIndustries,
    communityParticipants,
    fundingAgg,
    totalSolutions,
  ] = await Promise.all([
    Challenge.countDocuments(cMatch),
    Challenge.countDocuments({ ...cMatch, status: 'validated' }),
    Challenge.countDocuments({ ...cMatch, status: 'in_progress' }),
    Challenge.countDocuments({ ...cMatch, status: 'resolved' }),
    Project.countDocuments(projectMatch),
    Project.countDocuments({ ...projectMatch, status: { $in: ACTIVE_PROJECT_STATUSES } }),
    Project.countDocuments({ ...projectMatch, status: 'completed' }),
    University.countDocuments(),
    Industry.countDocuments(),
    getCommunityParticipantCount(challengeIds),
    Funding.aggregate([
      ...(challengeIds ? [{ $match: { project: { $in: challengeIds } } }] : []),
      { $match: { status: { $in: ACTIVE_FUNDING_STATUSES } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Project.countDocuments({ ...projectMatch, status: { $in: DEPLOYED_PROJECT_STATUSES } }),
  ]);

  return {
    totals: {
      totalChallenges,
      validatedChallenges,
      activeChallenges,
      resolvedChallenges,
      totalProjects,
      activeProjects,
      completedProjects,
      totalUniversities,
      totalIndustries,
      totalCommunityParticipants: communityParticipants,
      totalFunding: fundingAgg[0]?.total || 0,
      totalSolutions,
    },
  };
}

async function getCommunityParticipantCount(challengeIds) {
  const validationUsers = await CommunityValidation.distinct(
    'user',
    challengeIds ? { challenge: { $in: challengeIds } } : {}
  );
  const discussionMatch = challengeIds
    ? { relatedChallenge: { $in: challengeIds } }
    : {};
  const discussions = await Discussion.find(discussionMatch)
    .select('participants comments.user createdBy')
    .lean();

  const users = new Set(validationUsers.map((u) => String(u)));
  for (const d of discussions) {
    for (const p of d.participants || []) users.add(String(p));
    d.comments?.forEach((c) => c.user && users.add(String(c.user)));
    if (d.createdBy) users.add(String(d.createdBy));
  }
  return users.size;
}

// ---------- 3. challenge analytics ----------

export async function getChallengeAnalytics(district) {
  const match = challengeMatch(district);
  match.status = { $ne: 'rejected' };

  const monthStage = {
    $month: '$createdAt',
  };
  const yearStage = { $year: '$createdAt' };

  const [byCategory, byDistrict, bySeverity, byStatus, overTime] = await Promise.all([
    Challenge.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    Challenge.aggregate([
      { $match: match },
      { $group: { _id: '$district', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Challenge.aggregate([
      { $match: match },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    Challenge.aggregate([
      { $match: district ? { district } : {} },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Challenge.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: yearStage, month: monthStage },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          period: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              { $cond: [{ $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' }] },
            ],
          },
          count: 1,
        },
      },
    ]),
  ]);

  return {
    byCategory: fillCategories(byCategory),
    byDistrict: byDistrict.map((r) => ({ district: r._id, count: r.count })),
    bySeverity: bySeverity.map((r) => ({ severity: r._id, count: r.count })),
    byStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
    overTime,
  };
}

function fillCategories(rows) {
  const map = new Map(rows.map((r) => [r._id, r.count]));
  return CHALLENGE_CATEGORIES.map((c) => ({
    category: c,
    count: map.get(c) || 0,
  }));
}

// ---------- 4. priority challenges ----------

export async function getPriorityChallenges(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));

  const match = {};
  if (query.district) match.district = query.district;
  if (query.category && CHALLENGE_CATEGORIES.includes(query.category)) {
    match.category = query.category;
  }
  if (query.severity) match.severity = query.severity;
  if (query.status) match.status = query.status;

  const [rows, total] = await Promise.all([
    Challenge.find(match)
      .sort({ priorityScore: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('title category district severity status priorityScore communityValidation')
      .lean(),
    Challenge.countDocuments(match),
  ]);

  return {
    challenges: rows.map((c) => ({
      _id: c._id,
      title: c.title,
      category: c.category,
      district: c.district,
      severity: c.severity,
      status: c.status,
      priorityScore: c.priorityScore ?? 0,
      communityValidationScore: c.communityValidation
        ? Math.round(
            ((c.communityValidation.supportCount + 0.5 * c.communityValidation.commentCount) /
              (c.communityValidation.supportCount +
                0.5 * c.communityValidation.commentCount +
                c.communityValidation.disputeCount * 2 +
                3)) *
              100
          )
        : 0,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: page * limit < total,
    },
  };
}

// ---------- 5. university analytics ----------

export async function getUniversityAnalytics() {
  const universities = await University.aggregate([
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: 'university',
        as: 'projects',
      },
    },
    {
      $lookup: {
        from: 'challenges',
        localField: '_id',
        foreignField: 'assignedUniversity',
        as: 'assignedChallenges',
      },
    },
    {
      $project: {
        name: 1,
        verificationStatus: 1,
        districtsCovered: 1,
        assignedChallenges: { $size: '$assignedChallenges' },
        projectsCreated: { $size: '$projects' },
        activeProjects: {
          $size: {
            $filter: {
              input: '$projects',
              as: 'p',
              cond: { $in: ['$$p.status', ACTIVE_PROJECT_STATUSES] },
            },
          },
        },
        completedProjects: {
          $size: {
            $filter: {
              input: '$projects',
              as: 'p',
              cond: { $eq: ['$$p.status', 'completed'] },
            },
          },
        },
      },
    },
    { $sort: { projectsCreated: -1, name: 1 } },
  ]);

  const [total, verified, withActiveProjects] = await Promise.all([
    University.countDocuments(),
    University.countDocuments({ verificationStatus: 'verified' }),
    Project.distinct('university', { status: { $in: ACTIVE_PROJECT_STATUSES } }),
  ]);

  return {
    summary: {
      totalUniversities: total,
      verifiedUniversities: verified,
      universitiesWithActiveProjects: withActiveProjects.filter(Boolean).length,
    },
    universities: universities.map((u) => ({
      _id: u._id,
      name: u.name,
      verificationStatus: u.verificationStatus,
      districtsCovered: u.districtsCovered?.length || 0,
      assignedChallenges: u.assignedChallenges,
      projectsCreated: u.projectsCreated,
      activeProjects: u.activeProjects,
      completedProjects: u.completedProjects,
    })),
  };
}

// ---------- 6. industry analytics ----------

export async function getIndustryAnalytics() {
  const [summaryAgg, fundingByIndustry, collabCounts, supportedProjects] = await Promise.all([
    Industry.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          verified: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] },
          },
        },
      },
    ]),
    Funding.aggregate([
      { $match: { status: { $in: ACTIVE_FUNDING_STATUSES } } },
      {
        $group: {
          _id: '$industry',
          totalCommitted: { $sum: '$amount' },
          fundingCount: { $sum: 1 },
        },
      },
      { $sort: { totalCommitted: -1 } },
      { $limit: 15 },
      {
        $lookup: {
          from: 'industries',
          localField: '_id',
          foreignField: '_id',
          as: 'industry',
        },
      },
      {
        $project: {
          _id: 1,
          name: { $arrayElemAt: ['$industry.companyName', 0] },
          totalCommitted: 1,
          fundingCount: 1,
        },
      },
    ]),
    CollaborationRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Project.aggregate([
      { $unwind: '$industryPartners' },
      { $group: { _id: '$industryPartners', supportedProjects: { $sum: 1 } } },
      { $sort: { supportedProjects: -1 } },
      { $limit: 15 },
      {
        $lookup: {
          from: 'industries',
          localField: '_id',
          foreignField: '_id',
          as: 'industry',
        },
      },
      {
        $project: {
          _id: 1,
          name: { $arrayElemAt: ['$industry.companyName', 0] },
          supportedProjects: 1,
        },
      },
    ]),
  ]);

  const byStatus = Object.fromEntries(collabCounts.map((r) => [r._id, r.count]));

  return {
    summary: {
      totalIndustries: summaryAgg[0]?.total || 0,
      verifiedIndustries: summaryAgg[0]?.verified || 0,
      activeCollaborations: (byStatus.accepted || 0) + (byStatus.pending || 0),
      collaborationRequests: Object.values(byStatus).reduce((a, b) => a + b, 0),
      acceptedCollaborations: byStatus.accepted || 0,
      pendingCollaborations: byStatus.pending || 0,
      totalFundingCommitted: fundingByIndustry.reduce((s, f) => s + f.totalCommitted, 0),
    },
    fundingByIndustry,
    supportedProjects,
  };
}

// ---------- 7. project analytics ----------

export async function getProjectAnalytics(district) {
  const challengeIds = await challengeIdsInDistrict(district);
  const baseMatch = challengeIds ? { challenge: { $in: challengeIds } } : {};

  const [byStatus, byUniversity, progressAgg, completedCount, deployedCount] =
    await Promise.all([
      Project.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Project.aggregate([
        { $match: baseMatch },
        {
          $lookup: {
            from: 'universities',
            localField: 'university',
            foreignField: '_id',
            as: 'university',
          },
        },
        {
          $group: {
            _id: '$university',
            count: { $sum: 1 },
            avgProgress: { $avg: '$currentProgress' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
        {
          $project: {
            _id: { $arrayElemAt: ['$_id._id', 0] },
            name: { $arrayElemAt: ['$_id.name', 0] },
            count: 1,
            avgProgress: { $round: ['$avgProgress', 0] },
          },
        },
      ]),
      Project.aggregate([
        { $match: baseMatch },
        { $group: { _id: null, avgProgress: { $avg: '$currentProgress' } } },
      ]),
      Project.countDocuments({ ...baseMatch, status: 'completed' }),
      Project.countDocuments({ ...baseMatch, status: 'deployed' }),
    ]);

  // byCategory / byDistrict come via the linked challenge
  const challengeGroupPipeline = [
    { $match: baseMatch },
    {
      $lookup: {
        from: 'challenges',
        localField: 'challenge',
        foreignField: '_id',
        as: 'challenge',
      },
    },
    { $unwind: '$challenge' },
  ];

  const [byCategory, byDistrict] = await Promise.all([
    Project.aggregate([
      ...challengeGroupPipeline,
      { $group: { _id: '$challenge.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Project.aggregate([
      ...challengeGroupPipeline,
      { $group: { _id: '$challenge.district', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return {
    summary: {
      completedProjects: completedCount,
      deployedProjects: deployedCount,
      averageProgress: Math.round(progressAgg[0]?.avgProgress || 0),
    },
    byStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
    byCategory: byCategory.map((r) => ({ category: r._id, count: r.count })),
    byDistrict: byDistrict.map((r) => ({ district: r._id, count: r.count })),
    byUniversity: byUniversity,
  };
}

// ---------- 8. funding analytics ----------

export async function getFundingAnalytics(district) {
  const challengeIds = await challengeIdsInDistrict(district);
  const baseMatch = challengeIds ? { project: { $in: challengeIds } } : {};

  const [byStatus, byProject, byIndustry, totalAgg] = await Promise.all([
    Funding.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Funding.aggregate([
      { $match: { ...baseMatch, status: { $in: ACTIVE_FUNDING_STATUSES } } },
      {
        $group: {
          _id: '$project',
          totalAmount: { $sum: '$amount' },
          contributions: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 15 },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: '_id',
          as: 'project',
        },
      },
      {
        $project: {
          title: { $arrayElemAt: ['$project.title', 0] },
          status: { $arrayElemAt: ['$project.status', 0] },
          totalAmount: 1,
          contributions: 1,
        },
      },
    ]),
    Funding.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: '$industry',
          totalAmount: { $sum: '$amount' },
          contributions: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 15 },
      {
        $lookup: {
          from: 'industries',
          localField: '_id',
          foreignField: '_id',
          as: 'industry',
        },
      },
      {
        $project: {
          name: { $arrayElemAt: ['$industry.companyName', 0] },
          totalAmount: 1,
          contributions: 1,
        },
      },
    ]),
    Funding.aggregate([
      { $match: baseMatch },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const statusAmount = Object.fromEntries(
    byStatus.map((r) => [r._id, { count: r.count, amount: r.amount }])
  );

  return {
    summary: {
      totalCommitted:
        (statusAmount.committed?.amount || 0) +
        (statusAmount.approved?.amount || 0) +
        (statusAmount.completed?.amount || 0),
      approvedFunding: statusAmount.approved?.amount || 0,
      completedFunding: statusAmount.completed?.amount || 0,
      proposedFunding: statusAmount.proposed?.amount || 0,
      totalRecords: totalAgg[0]?.count || 0,
    },
    byStatus: byStatus.map((r) => ({ status: r._id, count: r.count, amount: r.amount })),
    byProject,
    byIndustry,
  };
}

// ---------- 9. community analytics ----------

export async function getCommunityAnalytics(district) {
  const challengeIds = await challengeIdsInDistrict(district);

  const validationMatch = challengeIds
    ? { challenge: { $in: challengeIds } }
    : {};
  const discussionMatch = challengeIds
    ? { relatedChallenge: { $in: challengeIds } }
    : {};

  const [validationTypeCounts, uniqueParticipants, discussionTotals, districtParticipation] =
    await Promise.all([
      CommunityValidation.aggregate([
        { $match: validationMatch },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      getCommunityParticipantCount(challengeIds),
      Discussion.aggregate([
        { $match: discussionMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            participants: { $sum: '$participantCount' },
            comments: { $sum: { $size: '$comments' } },
          },
        },
      ]),
      CommunityValidation.aggregate([
        ...(challengeIds ? [{ $match: validationMatch }] : []),
        {
          $lookup: {
            from: 'challenges',
            localField: 'challenge',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        { $unwind: '$challenge' },
        { $group: { _id: '$challenge.district', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 25 },
      ]),
    ]);

  const typeMap = Object.fromEntries(validationTypeCounts.map((r) => [r._id, r.count]));
  const discussionMap = Object.fromEntries(discussionTotals.map((r) => [r._id, r]));
  const allDiscussions = Object.values(discussionMap).reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      participants: acc.participants + r.participants,
      comments: acc.comments + r.comments,
    }),
    { count: 0, participants: 0, comments: 0 }
  );

  return {
    summary: {
      totalValidations: validationTypeCounts.reduce((a, r) => a + r.count, 0),
      totalSupporters: typeMap.support || 0,
      totalDisputes: typeMap.dispute || 0,
      totalComments: (typeMap.comment || 0) + allDiscussions.comments,
      totalDiscussions: allDiscussions.count,
      activeDiscussions: discussionMap.active?.count || 0,
      discussionParticipants: allDiscussions.participants,
      totalCommunityParticipants: uniqueParticipants,
    },
    districtWiseParticipation: districtParticipation.map((r) => ({
      district: r._id,
      count: r.count,
    })),
  };
}

// ---------- 10. district overview ----------

export async function getDistrictOverview() {
  const [challengeRows, projectRows, communityRows, discussionRows] = await Promise.all([
    Challenge.aggregate([
      {
        $group: {
          _id: '$district',
          challenges: { $sum: 1 },
          highPriority: {
            $sum: {
              $cond: [
                { $in: ['$severity', ['high', 'critical']] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Project.aggregate([
      {
        $lookup: {
          from: 'challenges',
          localField: 'challenge',
          foreignField: '_id',
          as: 'challenge',
        },
      },
      { $unwind: '$challenge' },
      {
        $group: {
          _id: '$challenge.district',
          activeProjects: {
            $sum: {
              $cond: [{ $in: ['$status', ACTIVE_PROJECT_STATUSES] }, 1, 0],
            },
          },
          completedProjects: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          deployedSolutions: {
            $sum: { $cond: [{ $in: ['$status', DEPLOYED_PROJECT_STATUSES] }, 1, 0] },
          },
        },
      },
    ]),
    CommunityValidation.aggregate([
      {
        $lookup: {
          from: 'challenges',
          localField: 'challenge',
          foreignField: '_id',
          as: 'challenge',
        },
      },
      { $unwind: '$challenge' },
      { $group: { _id: '$challenge.district', participation: { $sum: 1 } } },
    ]),
    Discussion.aggregate([
      { $group: { _id: '$district', discussions: { $sum: 1 } } },
    ]),
  ]);

  const merged = new Map();
  function ensure(district) {
    if (!merged.has(district)) {
      merged.set(district, {
        district,
        challenges: 0,
        highPriorityChallenges: 0,
        activeProjects: 0,
        completedProjects: 0,
        communityParticipation: 0,
        discussions: 0,
        deployedSolutions: 0,
      });
    }
    return merged.get(district);
  }

  challengeRows.forEach((r) => {
    const d = ensure(r._id);
    d.challenges = r.challenges;
    d.highPriorityChallenges = r.highPriority;
  });
  projectRows.forEach((r) => {
    const d = ensure(r._id);
    d.activeProjects = r.activeProjects;
    d.completedProjects = r.completedProjects;
    d.deployedSolutions = r.deployedSolutions;
  });
  communityRows.forEach((r) => {
    ensure(r._id).communityParticipation = r.participation;
  });
  discussionRows.forEach((r) => {
    ensure(r._id).discussions = r.discussions;
  });

  return {
    districts: [...merged.values()].sort((a, b) => b.challenges - a.challenges),
  };
}

// ---------- 13. impact & replication overview ----------

export async function getImpactOverview() {
  const [totalsAgg, avgScoreAgg, topSolutions, districtsReached, replicationReady] =
    await Promise.all([
      Project.aggregate([
        { $match: { status: { $in: ['deployed', 'completed'] }, impact: { $exists: true } } },
        {
          $group: {
            _id: null,
            peopleBenefited: { $sum: { $ifNull: ['$impact.peopleBenefited', 0] } },
            deployedSolutions: { $sum: 1 },
          },
        },
      ]),
    Project.aggregate([
      { $match: { 'impact.impactScore': { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$impact.impactScore' } } },
    ]),
    Project.aggregate([
      { $match: { status: { $in: ['deployed', 'completed'] }, 'impact.impactScore': { $gt: 0 } } },
      { $sort: { 'impact.impactScore': -1, 'impact.peopleBenefited': -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'challenges',
          localField: 'challenge',
          foreignField: '_id',
          as: 'challenge',
        },
      },
      {
        $project: {
          title: 1,
          status: 1,
          impactScore: '$impact.impactScore',
          peopleBenefited: '$impact.peopleBenefited',
          districtsCovered: '$impact.districtsCovered',
          challengeDistrict: { $arrayElemAt: ['$challenge.district', 0] },
        },
      },
    ]),
    Project.distinct('deploymentDetails.district', {
      status: { $in: ['deployed', 'completed'] },
      'deploymentDetails.district': { $ne: null },
    }),
    // replication-ready = deployed/completed with meaningful recorded impact
    Project.countDocuments({
      status: { $in: ['deployed', 'completed'] },
      'impact.impactScore': { $gte: 40 },
    }),
  ]);

  return {
    totalPeopleBenefited: totalsAgg[0]?.peopleBenefited || 0,
    totalDeployedSolutions: totalsAgg[0]?.deployedSolutions || 0,
    averageImpactScore: Math.round(avgScoreAgg[0]?.avg || 0),
    districtsReached: districtsReached.filter(Boolean).length,
    solutionsWithReplicationOpportunities: replicationReady,
    topImpactfulSolutions: topSolutions.map((p) => ({
      _id: p._id,
      title: p.title,
      status: p.status,
      impactScore: p.impactScore ?? 0,
      peopleBenefited: p.peopleBenefited ?? null,
      districtsCovered: p.districtsCovered?.length || (p.challengeDistrict ? 1 : 0),
    })),
  };
}

// ---------- 14. recent activity ----------

export async function getRecentActivity(district, limit = 12) {
  const cMatch = challengeMatch(district);
  const projectMatch = await challengeIdsInDistrict(district).then(
    (ids) => (ids ? { challenge: { $in: ids } } : {})
  );
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // last 90 days

  const [newChallenges, validations, newProjects, acceptedCollabs, completedProjects, newDiscussions] =
    await Promise.all([
      Challenge.find(cMatch)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('title createdAt')
        .lean()
        .then((rows) =>
          rows.map((r) => ({
            type: 'challenge_submitted',
            label: `New challenge submitted: ${r.title}`,
            at: r.createdAt,
            link: `/challenges/${r._id}`,
          }))
        ),
      CommunityValidation.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('challenge', 'title district')
        .populate('user', 'name role')
        .lean()
        .then((rows) =>
          rows
            .filter((r) => r.challenge && (!district || r.challenge.district === district))
            .map((r) => ({
              type: `challenge_${r.type === 'comment' ? 'commented' : r.type === 'dispute' ? 'disputed' : 'validated'}`,
              label: `${r.user?.name || 'Someone'} ${r.type === 'comment' ? 'commented on' : r.type} challenge: ${r.challenge.title}`,
              at: r.createdAt,
              link: `/challenges/${r.challenge._id}`,
            }))
        ),
      Project.find(projectMatch)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('title createdAt')
        .lean()
        .then((rows) =>
          rows.map((r) => ({
            type: 'project_started',
            label: `New project started: ${r.title}`,
            at: r.createdAt,
            link: `/projects/${r._id}`,
          }))
        ),
      CollaborationRequest.find({ status: 'accepted', respondedAt: { $gte: since } })
        .sort({ respondedAt: -1 })
        .limit(limit)
        .populate('industry', 'companyName')
        .populate('project', 'title')
        .lean()
        .then((rows) =>
          rows.map((r) => ({
            type: 'collaboration_accepted',
            label: `${r.industry?.companyName || 'An industry'} collaboration accepted for: ${r.project?.title || 'a project'}`,
            at: r.respondedAt,
            link: r.project ? `/projects/${r.project._id}` : null,
          }))
        ),
      Project.find({
        ...projectMatch,
        status: 'completed',
        completionDate: { $ne: null },
      })
        .sort({ completionDate: -1 })
        .limit(limit)
        .select('title completionDate')
        .lean()
        .then((rows) =>
          rows.map((r) => ({
            type: 'project_completed',
            label: `Project completed: ${r.title}`,
            at: r.completionDate,
            link: `/projects/${r._id}`,
          }))
        ),
      Discussion.find(district ? { district } : {})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('title createdAt')
        .lean()
        .then((rows) =>
          rows.map((r) => ({
            type: 'discussion_started',
            label: `Local Samvaad started: ${r.title}`,
            at: r.createdAt,
            link: `/samvaad/${r._id}`,
          }))
        ),
    ]);

  return {
    activities: [...newChallenges, ...validations, ...newProjects, ...acceptedCollabs, ...completedProjects, ...newDiscussions]
      .filter((a) => a.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, limit),
  };
}
