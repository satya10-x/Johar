import { useEffect, useRef, useState } from 'react';
import { transcribeAudio, analyzeVoiceTranscript } from '../services/voiceService.js';

const SPOKEN_LANGUAGES = [
  { code: 'hi', label: 'हिन्दी (Hindi)', note: 'Native Speech Recognition' },
  { code: 'en', label: 'English', note: 'Native Speech Recognition' },
  { code: 'nag', label: 'नागपुरी / सादरी (Nagpuri)', note: 'Phonetic Recognition' },
  { code: 'san', label: 'संथाली (Santhali)', note: 'Phonetic Recognition' },
  { code: 'mundari', label: 'मुण्डारी (Mundari)', note: 'Phonetic Recognition' },
  { code: 'ho', label: 'हो (Ho)', note: 'Phonetic Recognition' },
  { code: 'kur', label: 'कुड़ुख़ (Kurukh)', note: 'Phonetic Recognition' },
  { code: '', label: 'Auto-Detect / अन्य', note: 'Automatic detection' },
];

const MAX_RECORDING_SECONDS = 120; // 2 minutes max

export default function VoiceRecorder({ onDraftGenerated, onCancel, districtHint = '' }) {
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  const [step, setStep] = useState('idle'); // 'idle' | 'recording' | 'recorded' | 'transcribing' | 'structuring'
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Check browser support
  const isSupported =
    typeof window !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function';

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  async function startRecording() {
    setError('');
    setStatusMessage('');
    audioChunksRef.current = [];

    if (!isSupported) {
      setError('Audio recording is not supported in this browser. Please use a modern browser or enter text manually.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Prefer standard webm audio, fallback to whatever mimeType the browser supports
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg', ''];
      const mimeType = mimeTypes.find((t) => !t || MediaRecorder.isTypeSupported(t)) || '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Stop all audio tracks to turn off microphone indicator
        stream.getTracks().forEach((track) => track.stop());

        const blobType = mimeType || 'audio/webm';
        const finalBlob = new Blob(audioChunksRef.current, { type: blobType });

        if (finalBlob.size === 0) {
          setError('No audio was captured. Please try recording again.');
          setStep('idle');
          return;
        }

        const newAudioUrl = URL.createObjectURL(finalBlob);
        setAudioBlob(finalBlob);
        setAudioUrl(newAudioUrl);
        setStep('recorded');
      };

      recorder.start(250); // Slice data every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);
      setStep('recording');

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= MAX_RECORDING_SECONDS - 1) {
            stopRecording();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError(
          'Microphone permission was denied. Please allow microphone access in your browser settings to record your challenge.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found on your device.');
      } else {
        setError(`Could not access microphone: ${err.message || 'Unknown error'}`);
      }
      setStep('idle');
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  function resetRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setRecordingSeconds(0);
    setIsRecording(false);
    setError('');
    setStatusMessage('');
    setStep('idle');
  }

  async function processVoice() {
    if (!audioBlob) {
      setError('Please record your voice first.');
      return;
    }

    setError('');
    setStep('transcribing');
    setStatusMessage('Transcribing speech to text...');

    try {
      // Step 1: Transcribe audio using Groq Whisper
      const transcriptionResult = await transcribeAudio(audioBlob, selectedLanguage);
      const transcript = (transcriptionResult.transcript || '').trim();

      if (!transcript) {
        throw new Error('No clear speech was detected. Please try recording again.');
      }

      setStep('structuring');
      setStatusMessage('Analyzing and structuring your problem into a challenge draft...');

      // Step 2: Convert transcript into structured challenge fields using Groq AI
      const structuredDraft = await analyzeVoiceTranscript({
        transcript,
        detectedLanguage: transcriptionResult.detectedLanguage,
        userLanguage: selectedLanguage || transcriptionResult.detectedLanguage || 'hi',
        district: districtHint,
      });

      // Pass the generated draft and original transcript metadata back to parent
      onDraftGenerated({
        ...structuredDraft,
        originalTranscript: transcript,
        detectedLanguage: transcriptionResult.detectedLanguage || selectedLanguage || 'hi',
      });
    } catch (err) {
      console.error('Voice processing failed:', err);
      setError(
        err.response?.data?.message ||
        err.message ||
        'Could not process voice recording. Please retry or enter details manually.'
      );
      setStep('recorded');
    }
  }

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="rounded-xl border-[3px] border-nb-ink bg-white p-6 shadow-[4px_4px_0_#111]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-gray-100 pb-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-nb-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nb-yellow border-2 border-nb-ink text-sm">
              🎙️
            </span>
            Report by Voice (आवाज़ से दर्ज करें)
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Speak your issue in your own words. We will transcribe and create an editable challenge draft.
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-gray-500 hover:text-nb-ink underline"
          >
            Switch to manual typing
          </button>
        )}
      </div>

      {/* Language Selector */}
      <div className="mt-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
          Spoken Language / बोली जाने वाली भाषा:
        </label>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SPOKEN_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            return (
              <button
                key={lang.code || 'auto'}
                type="button"
                onClick={() => setSelectedLanguage(lang.code)}
                disabled={isRecording || step === 'transcribing' || step === 'structuring'}
                className={`flex flex-col items-start rounded-lg border-2 p-2.5 text-left transition-all ${
                  isSelected
                    ? 'border-nb-ink bg-nb-yellow/40 shadow-[2px_2px_0_#111] font-bold text-nb-ink'
                    : 'border-gray-200 bg-white hover:border-gray-400 text-gray-700'
                } disabled:opacity-50`}
              >
                <span className="text-xs">{lang.label}</span>
                <span className="mt-0.5 text-[10px] text-gray-500 font-normal">
                  {lang.note}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Recording / Audio Preview Area */}
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/60 p-6 text-center">
        {step === 'idle' && (
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={startRecording}
              className="group flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-nb-ink bg-red-500 text-white shadow-[4px_4px_0_#111] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none"
              title="Click to start recording"
            >
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            <p className="mt-3 text-sm font-semibold text-gray-800">
              Click to Start Recording
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Speak clearly about the problem, location, and who is affected (up to 2 minutes)
            </p>
          </div>
        )}

        {step === 'recording' && (
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-24 w-24 animate-ping rounded-full bg-red-400 opacity-60" />
              <button
                type="button"
                onClick={stopRecording}
                className="relative flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-nb-ink bg-red-600 text-white shadow-[4px_4px_0_#111]"
                title="Click to stop recording"
              >
                <div className="h-6 w-6 rounded-sm bg-white" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
              <span className="font-mono text-lg font-bold text-red-600">
                {formatTimer(recordingSeconds)}
              </span>
              <span className="text-xs text-gray-500">/ 02:00</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-gray-700">
              Recording in progress... Click the square button when finished.
            </p>
          </div>
        )}

        {step === 'recorded' && audioUrl && (
          <div className="flex w-full max-w-md flex-col items-center">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs">✓</span>
              Recording complete ({formatTimer(recordingSeconds)})
            </div>

            <audio controls src={audioUrl} className="mt-3 w-full" />

            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={resetRecording}
                className="rounded-lg border-2 border-nb-ink bg-white px-4 py-2 text-xs font-bold text-nb-ink shadow-[2px_2px_0_#111] hover:bg-gray-100"
              >
                🔄 Re-record
              </button>
              <button
                type="button"
                onClick={processVoice}
                className="rounded-lg border-2 border-nb-ink bg-johar-green-700 px-5 py-2 text-xs font-bold text-white shadow-[3px_3px_0_#111] hover:bg-johar-green-600"
              >
                ✨ Transcribe & Generate Challenge Draft →
              </button>
            </div>
          </div>
        )}

        {(step === 'transcribing' || step === 'structuring') && (
          <div className="flex flex-col items-center py-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-johar-green-700 border-t-transparent" />
            <p className="mt-4 text-sm font-bold text-nb-ink">
              {statusMessage}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {step === 'transcribing'
                ? 'Recognizing speech and dialects using Whisper AI...'
                : 'Mapping facts, category, district, and severity using Groq...'}
            </p>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="mt-4 rounded-lg border-2 border-red-300 bg-red-50 p-3 text-xs text-red-700">
          <p className="font-semibold">Recording Note / Error:</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Helpful Hint */}
      <div className="mt-4 rounded-lg bg-johar-earth-50/60 p-3 text-[11px] text-gray-600">
        <span className="font-bold text-johar-earth-700">💡 Tip: </span>
        You can speak naturally in Hindi, Nagpuri, Santhali, Mundari, Ho, Kurukh, or English.
        Mention your <strong>district/village</strong>, <strong>what is broken</strong>, and <strong>how many people are affected</strong>.
      </div>
    </div>
  );
}
