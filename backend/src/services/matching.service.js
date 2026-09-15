import University from '../models/University.js';
import Challenge from '../models/Challenge.js';

import ApiError from '../utils/ApiError.js';
import { matchUniversities } from './groqService.js';

const CANDIDATE_LIMIT = 12;

function keywordsOf(challenge) {
  const ai = challenge.aiClassification || {};
  return [
    challenge.category,
    challenge.subCategory,
    ...(challenge.skillsRequired || []),
    ...(ai.solutionDomains || []),
    ...(challenge.tags || []),
    ...(ai.tags || []),
  ]
    .filter(Boolean)
    .map((k) => String(k).toLowerCase())
    .filter((k) => k.length > 3);
}

async function findCandidates(challenge) {
  const keywords = keywordsOf(challenge);
  const regex = keywords.slice(0, 8).join('|');

  const filter = {
    $or: [
      { districtsCovered: challenge.district },
      { expertise: { $regex: regex, $options: 'i' } },
      { researchAreas: { $regex: regex, $options: 'i' } },
      { departments: { $regex: regex, $options: 'i' } },
      { facilities: { $regex: regex, $options: 'i' } },
    ],
  };

  let candidates = await University.find(filter)
    .select('name departments researchAreas expertise facilities districtsCovered previousProjects')
    .limit(CANDIDATE_LIMIT)
    .lean();

  // broaden when the targeted filter finds too few
  if (candidates.length < 5) {
    const extra = await University.find({ _id: { $nin: candidates.map((c) => c._id) } })
      .select('name departments researchAreas expertise facilities districtsCovered previousProjects')
      .limit(CANDIDATE_LIMIT - candidates.length)
      .lean();
    candidates = candidates.concat(extra);
  }

  return candidates;
}

// Database-only scoring used as fallback and to enrich AI output.
function scoreCandidate(challenge, university) {
  const keywords = new Set(keywordsOf(challenge));
  const matchingAreas = new Set();
  let hits = 0;

  const fields = [
    ...(university.expertise || []),
    ...(university.researchAreas || []),
    ...(university.departments || []),
    ...(university.facilities || []),
  ];

  for (const item of fields) {
    const lower = String(item).toLowerCase();
    for (const keyword of keywords) {
      if (lower.includes(keyword) || keyword.includes(lower)) {
        matchingAreas.add(item);
        hits += 1;
        break;
      }
    }
  }

  let score = Math.min(85, hits * 18);
  if ((university.districtsCovered || []).includes(challenge.district)) {
    score += 10;
    matchingAreas.add(`Covers ${challenge.district} district`);
  }

  return {
    universityId: university._id.toString(),
    score: Math.min(100, score),
    matchingAreas: [...matchingAreas].slice(0, 4),
    reason:
      matchingAreas.size > 0
        ? `Relevant capabilities: ${[...matchingAreas].slice(0, 3).join(', ')}.`
        : 'No direct capability overlap found in listed profile.',
  };
}

export async function findUniversityMatchesForChallenge(challengeId, { force = false } = {}) {
  const challenge = await Challenge.findById(challengeId).populate('assignedUniversity', 'name');
  if (!challenge) throw Object.assign(new Error('Challenge not found'), { statusCode: 404 });

  const cached = challenge.universityMatches;
  if (!force && cached && Array.isArray(cached.matches) && cached.matches.length > 0) {
    return cached;
  }

  const candidates = await findCandidates(challenge);

  let matches;
  let generatedBy = 'database';
  try {
    matches = await matchUniversities(challenge, candidates);
    generatedBy = 'ai';
  } catch (err) {
    console.error(`[ai] university matching failed: ${err.message}`);
    matches = candidates
      .map((u) => scoreCandidate(challenge, u))
      .sort((a, b) => b.score - a.score);
  }

  // attach university names; keep only meaningful scores on top
  const withNames = matches
    .map((m) => {
      const uni = candidates.find(
        (c) => c._id.toString() === m.universityId
      );
      return uni
        ? {
            universityId: m.universityId,
            name: uni.name,
            score: m.score,
            matchingAreas: m.matchingAreas,
            reason: m.reason,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const result = {
    checkedAt: new Date(),
    generatedBy,
    matches: withNames,
  };

  await Challenge.updateOne({ _id: challenge._id }, { $set: { universityMatches: result } });
  return result;
}
