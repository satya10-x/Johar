import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20000;
const MAX_OUTPUT_TOKENS = 800;

const SYSTEM_PROMPT = `You are an analysis engine for JOHAR, a civic platform for the state of Jharkhand, India.
You analyze societal problems reported by citizens. Jharkhand context includes: rural and tribal communities,
forest-dependent livelihoods, agriculture, water access, mining-affected areas, rural infrastructure,
public service delivery, and linguistic diversity (Hindi, Nagpuri, Santhali, Ho, Kurukh, Mundari and others).

Rules:
- Analyze ONLY the supplied challenge information. Never invent facts.
- If the input lacks information for a field, use an empty string or empty array rather than guessing.
- Never invent affected population numbers or medical/legal/political claims.
- "category" MUST be exactly one of: education, healthcare, agriculture, water, sanitation, environment,
  energy, roads_infrastructure, rural_livelihood, accessibility, public_services, waste_management,
  employment, other. Pick the closest match.
- "severity" MUST be one of: low, medium, high, critical.
- "priorityScore" is an integer 0-100 estimating urgency and social impact (affected people, urgency,
  public importance, geographic reach). It is only a prioritization signal for later human review.
- Keep text concise. Respond in English.

Respond with ONLY a valid JSON object, no markdown, in this exact shape:
{
  "summary": "2-3 sentence neutral summary",
  "category": "<one of the allowed categories>",
  "subCategory": "short specific sub-category or empty",
  "severity": "low|medium|high|critical",
  "priorityScore": 0,
  "skillsRequired": ["e.g. civil engineering"],
  "solutionDomains": ["e.g. water supply engineering"],
  "tags": ["lowercase short tags"],
  "jharkhandContext": "1-3 sentences on relevant Jharkhand-specific aspects, or empty if not enough info"
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

function toCleanString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 10);
}

export function sanitizeAiAnalysis(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Malformed AI response structure');
  }

  let priorityScore = Number(raw.priorityScore);
  if (!Number.isFinite(priorityScore)) priorityScore = 0;
  priorityScore = Math.min(100, Math.max(0, Math.round(priorityScore)));

  const severity = ['low', 'medium', 'high', 'critical'].includes(raw.severity)
    ? raw.severity
    : 'medium';

  return {
    summary: toCleanString(raw.summary, 1000),
    category: toCleanString(raw.category, 50),
    subCategory: toCleanString(raw.subCategory, 120),
    severity,
    priorityScore,
    skillsRequired: toStringArray(raw.skillsRequired),
    solutionDomains: toStringArray(raw.solutionDomains),
    tags: toStringArray(raw.tags).map((t) => t.toLowerCase()),
    jharkhandContext: toCleanString(raw.jharkhandContext, 1000),
  };
}

export async function analyzeChallenge({ title, description, category, district, affectedPopulation }) {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI analysis is not configured on the server');
  }

  const input = {
    title,
    description,
    reportedCategory: category,
    district,
    affectedPopulation: affectedPopulation ?? null,
  };

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(input) },
        ],
        temperature: 0.1,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ApiError(504, 'AI analysis timed out');
    }
    throw new ApiError(502, 'Could not reach AI service');
  }

  if (!response.ok) {
    console.error(`[groq] request failed with status ${response.status}`);
    throw new ApiError(502, 'AI analysis failed');
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  return sanitizeAiAnalysis(parsed);
}

const DUPLICATE_SYSTEM_PROMPT = `You are a duplicate-detection engine for JOHAR, a civic platform for Jharkhand, India.
You compare a newly reported societal challenge against existing reports and decide whether they describe
the SAME underlying problem at the same place/community.

Rules:
- The same problem reported with different wording IS a duplicate (e.g. "broken hand pump" vs "no water from the village pump for months").
- Different problems in the same area, or similar problems in clearly different villages/wards, are NOT duplicates.
- Judge using title, description, category, sub-category, district and tags.
- "similarity" MUST be one of: high, medium, low.
- "confidence" is an integer 0-100 that any listed match is truly the same problem.
- Respond with ONLY valid JSON: {"isDuplicate": true/false, "confidence": 0, "matches": [{"index": 0, "similarity": "high", "reason": "short reason"}]}
- Only include matches worth reviewing (similarity high or medium). If none, return an empty matches array.`;

export async function detectDuplicates(newChallenge, candidates) {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI analysis is not configured on the server');
  }

  const candidateList = candidates.map((c, index) => ({
    index,
    title: c.title,
    description: String(c.description).slice(0, 400),
    category: c.category,
    subCategory: c.subCategory || '',
    district: c.district,
    tags: c.tags || [],
  }));

  const input = {
    newChallenge: {
      title: newChallenge.title,
      description: String(newChallenge.description).slice(0, 600),
      category: newChallenge.category,
      subCategory: newChallenge.subCategory || '',
      district: newChallenge.district,
      tags: newChallenge.tags || [],
    },
    existingChallenges: candidateList,
  };

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: DUPLICATE_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(input) },
        ],
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ApiError(504, 'Duplicate detection timed out');
    }
    throw new ApiError(502, 'Could not reach AI service');
  }

  if (!response.ok) {
    console.error(`[groq] duplicate check failed with status ${response.status}`);
    throw new ApiError(502, 'AI analysis failed');
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  return sanitizeDuplicateResult(parsed);
}

export function sanitizeDuplicateResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Malformed AI response structure');
  }

  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.min(100, Math.max(0, Math.round(confidence)));

  const matches = Array.isArray(raw.matches) ? raw.matches : [];
  const similarChallenges = matches
    .filter(
      (m) =>
        m &&
        Number.isInteger(m.index) &&
        ['high', 'medium'].includes(m.similarity)
    )
    .slice(0, 5)
    .map((m) => ({
      index: m.index,
      similarity: m.similarity,
      reason: toCleanString(m.reason, 300),
    }));

  return {
    isDuplicate: Boolean(raw.isDuplicate) && similarChallenges.length > 0 && confidence >= 60,
    confidence,
    matches: similarChallenges,
  };
}

const MATCH_SYSTEM_PROMPT = `You are a university-matching engine for JOHAR, a civic platform for Jharkhand, India.
You compare one societal challenge against a list of universities and rank how well each university's
capabilities fit the challenge.

Rules:
- Use ONLY the supplied information about each university. Never invent departments, labs, research
  areas, expertise or faculty that are not listed.
- Consider: challenge category, sub-category, required skills, solution domains, tags, description vs
  university research areas, expertise, departments, facilities and previous projects.
- "score" is an integer 0-100 measuring fit. A university with no relevant capability should score low.
- "matchingAreas" lists the specific overlapping capabilities (max 4, short phrases).
- "reason" is ONE concise sentence explaining the match.
- Respond with ONLY valid JSON:
{"matches":[{"universityId":"<id from input>","score":0,"matchingAreas":[],"reason":""}]}
- Include every university you were given, sorted by score, highest first.`;

export async function matchUniversities(challengeProfile, universities) {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI analysis is not configured on the server');
  }

  const input = {
    challenge: {
      title: challengeProfile.title,
      category: challengeProfile.category,
      subCategory: challengeProfile.subCategory || '',
      district: challengeProfile.district,
      skillsRequired: challengeProfile.skillsRequired || [],
      solutionDomains: challengeProfile.solutionDomains || [],
      tags: challengeProfile.tags || [],
      summary: challengeProfile.aiSummary || '',
      description: String(challengeProfile.description).slice(0, 600),
    },
    universities: universities.map((u) => ({
      universityId: u._id.toString(),
      name: u.name,
      departments: u.departments || [],
      researchAreas: u.researchAreas || [],
      expertise: u.expertise || [],
      facilities: u.facilities || [],
      districtsCovered: u.districtsCovered || [],
      previousProjects: (u.previousProjects || []).map((p) => p.title),
    })),
  };

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: MATCH_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(input) },
        ],
        temperature: 0.1,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ApiError(504, 'AI matching timed out');
    }
    throw new ApiError(502, 'Could not reach AI service');
  }

  if (!response.ok) {
    console.error(`[groq] university matching failed with status ${response.status}`);
    throw new ApiError(502, 'AI analysis failed');
  }

  const payload = await response.json();
  const parsed = extractJson(payload.choices?.[0]?.message?.content);
  return sanitizeMatchResult(parsed);
}

export function sanitizeMatchResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Malformed AI response structure');
  }
  const matches = Array.isArray(raw.matches) ? raw.matches : [];

  return matches
    .map((m) => {
      let score = Number(m.score);
      if (!Number.isFinite(score)) score = 0;
      score = Math.min(100, Math.max(0, Math.round(score)));
      return {
        universityId: typeof m.universityId === 'string' ? m.universityId : '',
        score,
        matchingAreas: toStringArray(m.matchingAreas),
        reason: toCleanString(m.reason, 300),
      };
    })
    .filter((m) => m.universityId)
    .sort((a, b) => b.score - a.score);
}

const INDUSTRY_MATCH_SYSTEM_PROMPT = `You are an industry-matching engine for JOHAR, a civic platform for Jharkhand, India.
You compare one university project (solving a societal challenge) against a list of companies and rank
how well each company can support the project.

Rules:
- Use ONLY the supplied information about each company. Never invent capabilities, technologies,
  funding capacity or previous projects that are not listed.
- Consider the project's description, objectives, technologies, required resources and challenge
  category vs each company's industries, expertise, technologies and collaboration types.
- "score" is an integer 0-100 measuring fit. Companies with no relevant capability score low.
- "matchingAreas" lists specific overlapping capabilities (max 4, short phrases).
- "reason" is ONE concise sentence explaining the match.
- Respond with ONLY valid JSON:
{"matches":[{"industryId":"<id from input>","score":0,"matchingAreas":[],"reason":""}]}
- Include every company you were given, sorted by score, highest first.`;

export async function matchIndustries(projectProfile, industries) {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI analysis is not configured on the server');
  }

  const input = {
    project: projectProfile,
    companies: industries.map((c) => ({
      industryId: c._id.toString(),
      companyName: c.companyName,
      companyType: c.companyType,
      industries: c.industries || [],
      expertise: c.expertise || [],
      technologies: c.technologies || [],
      collaborationTypes: c.collaborationTypes || [],
      previousCollaborations: (c.previousCollaborations || []).map((p) => p.title),
    })),
  };

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: INDUSTRY_MATCH_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(input) },
        ],
        temperature: 0.1,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ApiError(504, 'AI matching timed out');
    }
    throw new ApiError(502, 'Could not reach AI service');
  }

  if (!response.ok) {
    console.error(`[groq] industry matching failed with status ${response.status}`);
    throw new ApiError(502, 'AI analysis failed');
  }

  const payload = await response.json();
  const parsed = extractJson(payload.choices?.[0]?.message?.content);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.matches)) {
    throw new Error('Malformed AI response structure');
  }

  return parsed.matches
    .map((m) => {
      let score = Number(m.score);
      if (!Number.isFinite(score)) score = 0;
      score = Math.min(100, Math.max(0, Math.round(score)));
      return {
        industryId: typeof m.industryId === 'string' ? m.industryId : '',
        score,
        matchingAreas: toStringArray(m.matchingAreas),
        reason: toCleanString(m.reason, 300),
      };
    })
    .filter((m) => m.industryId)
    .sort((a, b) => b.score - a.score);
}

const IMPACT_SUMMARY_PROMPT = `You are a report-writing assistant for JOHAR, a civic platform for Jharkhand, India.
You turn recorded project impact data into ONE concise factual summary paragraph (2-3 sentences).

Rules:
- Use ONLY the numbers and facts supplied. Never invent or estimate any value.
- If a value is absent, simply do not mention that aspect.
- Do not add adjectives like "remarkable" or claims of official verification.
- Respond with ONLY valid JSON: {"summary": "..."}`;

export async function summarizeImpact(projectProfile) {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI analysis is not configured on the server');
  }

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: IMPACT_SUMMARY_PROMPT },
          { role: 'user', content: JSON.stringify(projectProfile) },
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ApiError(504, 'AI summary timed out');
    }
    throw new ApiError(502, 'Could not reach AI service');
  }

  if (!response.ok) {
    console.error(`[groq] impact summary failed with status ${response.status}`);
    throw new ApiError(502, 'AI summary failed');
  }

  const payload = await response.json();
  const parsed = extractJson(payload.choices?.[0]?.message?.content);
  const summary = toCleanString(parsed.summary, 1200);
  if (!summary) throw new Error('AI returned an empty summary');
  return summary;
}

const REPLICATION_PROMPT = `You are a solution-replication engine for JOHAR, a civic platform for Jharkhand, India.
You compare ONE successfully deployed solution against open societal challenges and rank which
challenges could plausibly be addressed by replicating this same solution in their district.

Rules:
- Use ONLY the supplied information about the solution and each challenge. Never invent facts.
- Consider problem type, category, sub-category, required skills, tags, description context and geography.
- "score" is an integer 0-100 for replication fit. Challenges needing a fundamentally different
  kind of intervention must score low (below 40).
- "reason" is ONE concise sentence grounded only in the supplied data.
- Respond with ONLY valid JSON:
{"matches":[{"challengeId":"<id from input>","score":0,"reason":""}]}
- Only include challenges worth reviewing (score >= 40). If none qualify, return an empty matches array.`;

export async function matchSolutionToChallenges(solutionProfile, challenges) {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI analysis is not configured on the server');
  }

  const input = {
    solution: {
      title: solutionProfile.title,
      description: String(solutionProfile.description).slice(0, 600),
      proposedSolution: String(solutionProfile.proposedSolution || '').slice(0, 400),
      technologies: solutionProfile.technologies || [],
      category: solutionProfile.category,
      sourceDistrict: solutionProfile.sourceDistrict,
      implementedDistricts: solutionProfile.implementedDistricts || [],
      impactSummary: solutionProfile.impactSummary || '',
    },
    challenges: challenges.map((c, index) => ({
      index,
      challengeId: c._id.toString(),
      title: c.title,
      category: c.category,
      subCategory: c.subCategory || '',
      district: c.district,
      description: String(c.description).slice(0, 350),
      tags: c.tags || [],
      skillsRequired: (c.aiClassification && c.aiClassification.skillsRequired) || [],
      solutionDomains: (c.aiClassification && c.aiClassification.solutionDomains) || [],
    })),
  };

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: REPLICATION_PROMPT },
          { role: 'user', content: JSON.stringify(input) },
        ],
        temperature: 0.1,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ApiError(504, 'Replication matching timed out');
    }
    throw new ApiError(502, 'Could not reach AI service');
  }

  if (!response.ok) {
    console.error(`[groq] replication matching failed with status ${response.status}`);
    throw new ApiError(502, 'Replication matching failed');
  }

  const payload = await response.json();
  const parsed = extractJson(payload.choices?.[0]?.message?.content);
  const matches = Array.isArray(parsed.matches) ? parsed.matches : [];

  return matches
    .map((m) => {
      let score = Number(m.score);
      if (!Number.isFinite(score)) score = 0;
      score = Math.min(100, Math.max(0, Math.round(score)));
      return {
        challengeId: typeof m.challengeId === 'string' ? m.challengeId : '',
        score,
        reason: toCleanString(m.reason, 300),
      };
    })
    .filter((m) => m.challengeId)
    .sort((a, b) => b.score - a.score);
}
