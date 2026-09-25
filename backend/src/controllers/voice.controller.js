import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { transcribeAudio, analyzeVoiceTranscript } from '../services/voiceService.js';

export const transcribe = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Audio file is required');
  }

  const { originalname, mimetype, buffer, size } = req.file;

  if (!size || size === 0) {
    throw new ApiError(400, 'Uploaded audio file is empty');
  }

  const languageHint = req.body?.language || req.query?.language;

  const result = await transcribeAudio({
    buffer,
    originalName: originalname,
    mimeType: mimetype,
    languageHint,
  });

  res.json({
    success: true,
    transcript: result.transcript,
    detectedLanguage: result.detectedLanguage,
    duration: result.duration,
    confidence: result.confidence,
  });
});

export const analyze = asyncHandler(async (req, res) => {
  const { transcript, detectedLanguage, userLanguage, district } = req.body;

  if (!transcript || !String(transcript).trim()) {
    throw new ApiError(400, 'Transcript text is required');
  }

  const structured = await analyzeVoiceTranscript({
    transcript: String(transcript).trim(),
    detectedLanguage,
    userLanguage,
    districtHint: district,
  });

  res.json({
    success: true,
    ...structured,
  });
});
