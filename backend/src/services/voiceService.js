import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { CHALLENGE_CATEGORIES } from '../models/Challenge.js';

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TRANSCRIPTION_TIMEOUT_MS = 30000;
const STRUCTURING_TIMEOUT_MS = 25000;

// 24 official districts of Jharkhand for grounding
const JHARKHAND_DISTRICTS = [
  'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum',
  'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara',
  'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu',
  'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela-Kharsawan', 'Simdega',
  'West Singhbhum',
];

// ISO 639-1 language mapping for Whisper where supported
const WHISPER_SUPPORTED_LANGUAGES = {
  hi: 'hi',
  en: 'en',
  bn: 'bn',
  od: 'or',
};

// System prompt for structuring citizen voice transcript
const STRUCTURING_SYSTEM_PROMPT = `You are an expert civic intake and structuring assistant for JOHAR, a digital platform for Jharkhand, India.
Citizens report local societal problems using voice in Hindi, English, Nagpuri, Santhali, Mundari, Ho, Kurukh, or mixed local dialects.
Your job is to convert the citizen's voice transcript into a well-structured challenge draft for human review.

Rules:
1. Base the fields ONLY on the citizen's transcript. Never invent nonexistent facts, statistics, or political accusations.
2. "category" MUST be exactly one of:
   ${CHALLENGE_CATEGORIES.join(', ')}
   Choose the closest match.
3. "severity" MUST be one of: low, medium, high, critical.
   - critical: immediate life/health hazard (e.g. collapsed bridge, severe disease outbreak, toxic spill)
   - high: major daily hardship (e.g. broken main water pump, hospital lacking essential medicines)
   - medium: chronic civic difficulty (e.g. road potholes, irregular electricity, school repairs)
   - low: minor or aesthetic issue
4. "district": If the transcript mentions a specific district or recognizable locality in Jharkhand, match it to one of:
   ${JHARKHAND_DISTRICTS.join(', ')}
   If the district cannot be determined from the transcript, return an empty string "".
5. "title": A clear, concise title (under 120 characters) describing the problem.
6. "description": A coherent, complete paragraph (under 2000 characters) preserving the citizen's specific details, location hints, and timeline.
7. "affectedPopulation": An integer estimate if mentioned in the transcript, otherwise null.
8. "tags": An array of 3-6 lowercase relevant keywords.
9. "standardizedText": If the transcript is in a regional/tribal language or mixed dialect, provide a clean, standardized Hindi translation/summary preserving the exact meaning. If already in clear Hindi or English, provide an empty string "".
10. "standardizedLanguage": "hi" if standardized into Hindi, "en" if in English, otherwise "".

Respond with ONLY a valid JSON object in this exact shape:
{
  "title": "Concise title",
  "description": "Clean description based on transcript",
  "category": "one of the allowed categories",
  "subCategory": "short specific sub-category or empty string",
  "district": "district name or empty string",
  "language": "language code (e.g. hi, en, nag, san, kur, ho, mundari)",
  "affectedPopulation": 0 or null,
  "severity": "low|medium|high|critical",
  "tags": ["tag1", "tag2"],
  "standardizedText": "Clean Hindi/English standardized version or empty string",
  "standardizedLanguage": "hi|en|"
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
 * Transcribe an uploaded audio buffer using Groq Whisper.
 */
export async function transcribeAudio({ buffer, originalName, mimeType, languageHint }) {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI speech-to-text service is not configured on the server');
  }

  if (!buffer || buffer.length === 0) {
    throw new ApiError(400, 'Audio file is empty');
  }

  const filename = originalName || 'voice_recording.webm';
  const fileType = mimeType || 'audio/webm';
  const audioFile = new File([buffer], filename, { type: fileType });

  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', '0');

  // If a known ISO language code is provided and supported by Whisper, supply it as hint
  if (languageHint && WHISPER_SUPPORTED_LANGUAGES[languageHint]) {
    formData.append('language', WHISPER_SUPPORTED_LANGUAGES[languageHint]);
  }

  // Supply context prompt for Jharkhand vocabulary
  formData.append(
    'prompt',
    'Civic problem report from Jharkhand. Topics: water, handpump, roads, electricity, school, hospital, village, tola, block, panchayat. Languages: Hindi, Nagpuri, Santhali, Mundari, Ho, Kurukh.'
  );

  let response;
  try {
    response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: formData,
      signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ApiError(504, 'Audio transcription timed out. Please try a shorter recording.');
    }
    throw new ApiError(502, `Could not connect to transcription service: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`[groq whisper] failed with status ${response.status}: ${errorText}`);
    throw new ApiError(502, 'Speech transcription failed. Please try speaking clearly or enter text manually.');
  }

  const payload = await response.json();
  const transcript = (payload.text || '').trim();

  if (!transcript) {
    throw new ApiError(400, 'No clear speech could be detected in the audio. Please try recording again.');
  }

  // Whisper verbose_json returns the language name e.g. "hindi", "english"
  let detectedLanguage = (payload.language || '').toLowerCase().trim();
  if (detectedLanguage === 'hindi') detectedLanguage = 'hi';
  else if (detectedLanguage === 'english') detectedLanguage = 'en';
  else if (detectedLanguage === 'bengali') detectedLanguage = 'bn';
  else if (detectedLanguage === 'oriya' || detectedLanguage === 'odia') detectedLanguage = 'od';

  return {
    transcript,
    detectedLanguage: detectedLanguage || languageHint || 'hi',
    duration: payload.duration ? Math.round(payload.duration) : null,
    // Per requirement: if provider does not supply confidence score, return null instead of inventing
    confidence: null,
  };
}

/**
 * Convert raw voice transcript into structured Challenge draft.
 */
export async function analyzeVoiceTranscript({ transcript, detectedLanguage, userLanguage, districtHint }) {
  if (!env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI structuring service is not configured on the server');
  }

  const text = String(transcript || '').trim();
  if (!text) {
    throw new ApiError(400, 'Transcript is required for structuring');
  }

  const userContext = {
    transcript: text,
    detectedLanguage: detectedLanguage || null,
    statedLanguage: userLanguage || null,
    districtHint: districtHint || null,
  };

  let response;
  try {
    response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: STRUCTURING_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(userContext) },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(STRUCTURING_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ApiError(504, 'AI structuring timed out');
    }
    throw new ApiError(502, 'Could not reach AI service');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`[groq voice analyze] failed with status ${response.status}: ${errorText}`);
    throw new ApiError(502, 'AI structuring failed');
  }

  const payload = await response.json();
  const rawContent = payload.choices?.[0]?.message?.content;
  const parsed = extractJson(rawContent);

  // Validate and sanitize the structured draft
  const category = CHALLENGE_CATEGORIES.includes(parsed.category)
    ? parsed.category
    : 'other';

  const severity = ['low', 'medium', 'high', 'critical'].includes(parsed.severity)
    ? parsed.severity
    : 'medium';

  const district = JHARKHAND_DISTRICTS.includes(parsed.district)
    ? parsed.district
    : (districtHint && JHARKHAND_DISTRICTS.includes(districtHint) ? districtHint : '');

  let affectedPopulation = Number(parsed.affectedPopulation);
  if (!Number.isFinite(affectedPopulation) || affectedPopulation < 0) {
    affectedPopulation = null;
  }

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 8)
    : [];

  return {
    title: String(parsed.title || text.slice(0, 80)).trim().slice(0, 150),
    description: String(parsed.description || text).trim().slice(0, 4000),
    category,
    subCategory: String(parsed.subCategory || '').trim().slice(0, 100),
    district,
    language: userLanguage || detectedLanguage || 'hi',
    affectedPopulation,
    severity,
    tags,
    standardizedText: String(parsed.standardizedText || '').trim().slice(0, 2000),
    standardizedLanguage: String(parsed.standardizedLanguage || '').trim().slice(0, 10),
  };
}
