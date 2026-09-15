import getCloudinary from '../config/cloudinary.js';

import ApiError from '../utils/ApiError.js';

const RESOURCE_TYPE_MAP = {
  images: 'image',
  videos: 'video',
  documents: 'raw',
};

export async function uploadMedia(filesByType) {
  const cloudinary = getCloudinary();
  if (!cloudinary) {
    throw new ApiError(
      503,
      'Media upload is not configured on the server. Please submit the challenge without attachments.'
    );
  }

  const uploaded = { images: [], videos: [], documents: [] };

  for (const [type, files] of Object.entries(filesByType)) {
    for (const file of files || []) {
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: RESOURCE_TYPE_MAP[type],
              folder: `johar/challenges/${type}`,
            },
            (err, res) => (err ? reject(err) : resolve(res))
          );
          stream.end(file.buffer);
        });

        uploaded[type].push({
          url: result.secure_url,
          publicId: result.public_id,
          originalName: file.originalname,
        });
      } catch (err) {
        throw new ApiError(502, `Media upload failed: ${err.message}`);
      }
    }
  }

  return uploaded;
}

export async function deleteMedia(publicIds) {
  const cloudinary = getCloudinary();
  if (!cloudinary || !publicIds?.length) return;

  await Promise.allSettled(
    publicIds.map((publicId) => cloudinary.uploader.destroy(publicId))
  );
}
