import Challenge from '../models/Challenge.js';

import { detectDuplicates } from './groqService.js';

const CANDIDATE_LIMIT = 15;
const MAX_AI_CANDIDATES = 8;
const DUPLICATE_CONFIDENCE_THRESHOLD = 60;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(coordA, coordB) {
  const [lng1, lat1] = coordA;
  const [lng2, lat2] = coordB;
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function distanceLabel(newChallenge, candidate) {
  const newCoords = newChallenge.location?.coordinates;
  const candCoords = candidate.location?.coordinates;
  if (
    Array.isArray(newCoords) &&
    Array.isArray(candCoords) &&
    newCoords.length === 2 &&
    candCoords.length === 2
  ) {
    const km = haversineKm(newCoords, candCoords);
    return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
  }
  return candidate.district === newChallenge.district ? 'Same district' : 'Nearby';
}

function keywordOverlapScore(a, b) {
  const words = (doc) =>
    new Set(
      `${doc.title} ${doc.description} ${(doc.tags || []).join(' ')}`
        .toLowerCase()
        .replace(/[^a-z\u0900-\u097F\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
  const setA = words(a);
  const setB = words(b);
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared += 1;
  return shared / Math.min(setA.size, setB.size);
}

async function findCandidates(challenge) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const filter = {
    _id: { $ne: challenge._id },
    status: { $nin: ['rejected'] },
    createdAt: { $gte: ninetyDaysAgo },
    $or: [{ district: challenge.district }, { category: challenge.category }],
  };

  const candidates = await Challenge.find(filter)
    .select('title description category subCategory district tags location aiSummary createdAt')
    .sort({ createdAt: -1 })
    .limit(CANDIDATE_LIMIT)
    .lean();

  // rank by lexical overlap and keep the strongest few for the AI call
  return candidates
    .map((c) => ({
      ...c,
      _overlap:
        keywordOverlapScore(challenge, c) +
        (c.category === challenge.category ? 0.15 : 0) +
        (c.subCategory && c.subCategory === challenge.subCategory ? 0.3 : 0),
    }))
    .sort((a, b) => b._overlap - a._overlap)
    .slice(0, MAX_AI_CANDIDATES);
}

export async function runDuplicateCheck(challengeId) {
  const challenge = await Challenge.findById(challengeId).select('+location');
  if (!challenge) {
    throw Object.assign(new Error('Challenge not found'), { statusCode: 404 });
  }

  const candidates = await findCandidates(challenge);

  let result;
  if (!candidates.length) {
    result = { isDuplicate: false, confidence: 0, similarChallenges: [], checkedAt: new Date() };
  } else {
    const aiResult = await detectDuplicates(challenge, candidates);
    const similarChallenges = aiResult.matches
      .filter((m) => candidates[m.index])
      .map((m) => {
        const c = candidates[m.index];
        return {
          challenge: c._id,
          title: c.title,
          district: c.district,
          distanceLabel: distanceLabel(challenge, c),
          similarity: m.similarity,
          reason: m.reason,
        };
      });

    result = {
      checkedAt: new Date(),
      isDuplicate: aiResult.isDuplicate && aiResult.confidence >= DUPLICATE_CONFIDENCE_THRESHOLD,
      confidence: aiResult.confidence,
      similarChallenges,
    };
  }

  await Challenge.updateOne({ _id: challenge._id }, { $set: { duplicateCheck: result } });
  return result;
}

// Runs in the background but resolves with the result so callers can optionally wait.
export function queueDuplicateCheck(challengeId) {
  return runDuplicateCheck(challengeId).catch((err) => {
    console.error(`[ai] duplicate check failed for ${challengeId}: ${err.message}`);
    return null;
  });
}
