import { Router } from 'express';
import multer from 'multer';

import { transcribe, analyze } from '../controllers/voice.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import ApiError from '../utils/ApiError.js';

const ALLOWED_AUDIO_MIME = [
  'audio/webm',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'video/webm',
];

const storage = multer.memoryStorage();

function audioFileFilter(req, file, cb) {
  if (!ALLOWED_AUDIO_MIME.includes(file.mimetype)) {
    return cb(
      new ApiError(
        400,
        `Unsupported audio format (${file.mimetype}). Please upload a webm, wav, mp3, or m4a file.`
      )
    );
  }
  cb(null, true);
}

const uploadAudio = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: {
    files: 1,
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
}).single('audio');

function handleAudioUpload(req, res, next) {
  uploadAudio(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(400, 'Audio file exceeds 25MB limit'));
      }
      return next(new ApiError(400, `Upload error: ${err.message}`));
    }
    if (err) return next(err);
    next();
  });
}

const router = Router();

// Speech-to-text endpoint
router.post('/transcribe', requireAuth, handleAudioUpload, transcribe);

// Structured analysis endpoint
router.post('/analyze', requireAuth, analyze);

export default router;
