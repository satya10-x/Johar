import multer from 'multer';

import ApiError from '../utils/ApiError.js';

const ALLOWED_MIME = {
  images: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  videos: ['video/mp4', 'video/webm', 'video/quicktime'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allAllowed = Object.values(ALLOWED_MIME).flat();
  if (!allAllowed.includes(file.mimetype)) {
    return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
  }
  cb(null, true);
}

export const uploadChallengeMedia = multer({
  storage,
  fileFilter,
  limits: {
    files: 10,
    fileSize: 25 * 1024 * 1024,
  },
}).fields([
  { name: 'images', maxCount: 5 },
  { name: 'videos', maxCount: 2 },
  { name: 'documents', maxCount: 3 },
]);

export function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return next(new ApiError(400, `Upload error: ${err.message}`));
  }
  next(err);
}

export { ALLOWED_MIME };
