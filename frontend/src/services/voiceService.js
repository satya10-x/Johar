import api from './api.js';

/**
 * Transcribe recorded audio blob to text via POST /api/voice/transcribe
 */
export async function transcribeAudio(audioBlob, languageHint = '') {
  const formData = new FormData();
  // Name the file based on mime type or default to webm
  const extension = audioBlob.type.includes('wav') ? 'wav' : audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
  formData.append('audio', audioBlob, `recording.${extension}`);
  if (languageHint) {
    formData.append('language', languageHint);
  }

  const response = await api.post('/voice/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 35000,
  });

  return response.data;
}

/**
 * Convert raw voice transcript into structured Challenge draft via POST /api/voice/analyze
 */
export async function analyzeVoiceTranscript(data) {
  const response = await api.post('/voice/analyze', data, {
    timeout: 30000,
  });
  return response.data;
}
