import React, { useState, useRef, useEffect } from 'react';

export interface MediaAttachmentItem {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text' | 'file';
  file?: File;
  previewUrl: string;
  name: string;
  textNote?: string;
}

interface MediaAttachmentMenuProps {
  onAddAttachment: (item: MediaAttachmentItem) => void;
  disabled?: boolean;
}

// ─── iOS Safari / Browser compatibility helpers ───────────────────────────────

/** Returns true if running on iOS (iPhone/iPad) */
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Pick the best supported audio MIME type for MediaRecorder (prefer native WhatsApp Ogg Opus) */
function getBestAudioMimeType(): string {
  const types = ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return ''; // browser will choose
}

/** Pick the best supported video MIME type for MediaRecorder */
function getBestVideoMimeType(): string {
  const types = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

/** File extension for a MIME type */
function extForMime(mime: string): string {
  if (mime.startsWith('audio/mp4') || mime.startsWith('audio/aac')) return 'm4a';
  if (mime.startsWith('video/mp4')) return 'mp4';
  if (mime.startsWith('audio/ogg')) return 'ogg';
  if (mime.startsWith('video/webm') || mime.startsWith('audio/webm')) return 'webm';
  return 'audio';
}

/** Returns true if MediaRecorder API is available */
const hasMediaRecorder = () => typeof MediaRecorder !== 'undefined';

/** Returns true if Speech Recognition is available */
const hasSpeechRecognition = () =>
  !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );

// ─────────────────────────────────────────────────────────────────────────────

export function MediaAttachmentMenu({ onAddAttachment, disabled }: MediaAttachmentMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'voice' | 'text' | 'video'>('none');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioTranscript, setAudioTranscript] = useState('');
  const [hasSpeechAPI, setHasSpeechAPI] = useState(false);
  const [hasAudioData, setHasAudioData] = useState(false); // tracks if chunks arrived
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  // Text Note state
  const [textNoteContent, setTextNoteContent] = useState('');

  // Video recording state
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hasVideoData, setHasVideoData] = useState(false); // tracks if chunks arrived
  const videoMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Hidden file inputs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasSpeechAPI(hasSpeechRecognition());
  }, []);

  // Close popup menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Timer for voice recording
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  // 1. Photos & Files Handler
  const handlePhotosFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');

      onAddAttachment({
        id: Math.random().toString(36).substring(2, 9),
        type: isVideo ? 'video' : isAudio ? 'audio' : isImage ? 'image' : 'file',
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      });
    });
    e.target.value = '';
    setIsOpen(false);
  };

  // 2. Voice Recording — with iOS Safari compatibility
  const startVoiceRecording = async () => {
    setVoiceError(null);

    // iOS Safari: MediaRecorder is supported from iOS 14.3+, but webm is NOT.
    // We pick the best available MIME type.
    if (!hasMediaRecorder()) {
      setVoiceError(
        'Voice recording is not supported on this browser. Please update iOS to 14.3+ or use Safari on iOS.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = getBestAudioMimeType();
      const recorderOptions = mimeType ? { mimeType } : undefined;

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = recorderOptions
          ? new MediaRecorder(stream, recorderOptions)
          : new MediaRecorder(stream);
      } catch {
        // Some iOS versions throw on unsupported mime even after isTypeSupported check
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          setHasAudioData(true); // triggers re-render so Attach button enables
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setHasAudioData(false); // reset on new recording

      // Speech-to-text — NOT supported on iOS Safari
      if (hasSpeechAPI) {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';
          recognition.onresult = (event: any) => {
            let current = '';
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript;
            }
            setAudioTranscript(current);
          };
          recognition.onerror = () => {}; // silent
          recognition.start();
          recognitionRef.current = recognition;
        } catch (err) {
          console.warn('Speech recognition failed to start:', err);
        }
      }
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
          : err?.name === 'NotFoundError'
          ? 'No microphone found on this device.'
          : `Microphone error: ${err?.message || 'Unknown error'}`;
      setVoiceError(msg);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsRecording(false);
  };

  const handleSaveVoiceNote = () => {
    if (audioChunksRef.current.length > 0 || hasAudioData) {
      const mimeType = getBestAudioMimeType() || 'audio/webm';
      const ext = extForMime(mimeType);
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      const audioFile = new File([audioBlob], `voice_note_${Date.now()}.${ext}`, { type: mimeType });

      onAddAttachment({
        id: Math.random().toString(36).substring(2, 9),
        type: 'audio',
        file: audioFile,
        previewUrl: URL.createObjectURL(audioBlob),
        name: `Voice Note (${recordingTime}s)`,
        textNote: audioTranscript.trim() ? `Transcript: "${audioTranscript.trim()}"` : undefined,
      });
    }
    setActiveModal('none');
    setAudioTranscript('');
    setRecordingTime(0);
    setVoiceError(null);
    setHasAudioData(false);
    audioChunksRef.current = [];
    setIsOpen(false);
  };

  // 3. Text Note Handler
  const handleSaveTextNote = () => {
    if (!textNoteContent.trim()) return;
    onAddAttachment({
      id: Math.random().toString(36).substring(2, 9),
      type: 'text',
      previewUrl: '',
      name: `Note: ${textNoteContent.slice(0, 20)}...`,
      textNote: textNoteContent.trim(),
    });
    setTextNoteContent('');
    setActiveModal('none');
    setIsOpen(false);
  };

  // 4. Video Camera — iOS Safari uses video/mp4
  const startCamera = async () => {
    setVideoError(null);

    if (!hasMediaRecorder()) {
      setVideoError('Video recording is not supported on this browser/OS version.');
      setActiveModal('none');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access.'
          : `Camera error: ${err?.message || 'Unknown error'}`;
      setVideoError(msg);
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;
    videoChunksRef.current = [];

    const mimeType = getBestVideoMimeType();
    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);
    } catch {
      mediaRecorder = new MediaRecorder(streamRef.current);
    }

    videoMediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        videoChunksRef.current.push(e.data);
        setHasVideoData(true); // triggers re-render so Attach button enables
      }
    };
    mediaRecorder.start();
    setHasVideoData(false); // reset on new recording
    setIsVideoRecording(true);
  };

  const stopVideoRecording = () => {
    if (videoMediaRecorderRef.current && isVideoRecording) {
      videoMediaRecorderRef.current.stop();
    }
    setIsVideoRecording(false);
  };

  const saveVideoNote = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (videoChunksRef.current.length > 0 || hasVideoData) {
      const mimeType = getBestVideoMimeType() || 'video/mp4';
      const ext = extForMime(mimeType);
      const videoBlob = new Blob(videoChunksRef.current, { type: mimeType });
      const videoFile = new File(
        [videoBlob],
        `video_note_${Date.now()}.${ext}`,
        { type: mimeType }
      );
      onAddAttachment({
        id: Math.random().toString(36).substring(2, 9),
        type: 'video',
        file: videoFile,
        previewUrl: URL.createObjectURL(videoBlob),
        name: `Video Note (${new Date().toLocaleTimeString()})`,
      });
    }
    setHasVideoData(false);
    videoChunksRef.current = [];
    setActiveModal('none');
    setIsOpen(false);
  };

  const closeVideoModal = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setActiveModal('none');
    setIsVideoRecording(false);
    setVideoError(null);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Plus Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-surface-800 hover:bg-surface-700 border border-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        title="Add image, voice, text or video"
      >
        <svg
          className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Hidden File Input */}
      <input
        ref={photoInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={handlePhotosFilesChange}
      />

      {/* Popup Menu */}
      {isOpen && (
        <div className="absolute bottom-12 left-0 z-50 w-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-1.5 space-y-1 animate-in fade-in duration-150">

          {/* Option 1: Add Photos & Files */}
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-200 hover:text-white text-sm font-medium transition-colors text-left group"
          >
            <span className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-gray-300 group-hover:text-brand-400 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </span>
            <span>Add Photos & Files</span>
          </button>

          {/* Option 2: Voice Mode — show iOS warning inline */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setActiveModal('voice');
              startVoiceRecording();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-200 hover:text-white text-sm font-medium transition-colors text-left group"
          >
            <span className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-emerald-400 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <span>Voice Mode & Audio</span>
              {isIOS() && (
                <p className="text-[10px] text-amber-400 mt-0.5 leading-tight">
                  Requires iOS 14.3+ & HTTPS
                </p>
              )}
            </div>
          </button>

          {/* Option 3: Text Note */}
          <button
            type="button"
            onClick={() => { setIsOpen(false); setActiveModal('text'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-200 hover:text-white text-sm font-medium transition-colors text-left group"
          >
            <span className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-amber-400 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </span>
            <span>Text Note</span>
          </button>

          {/* Option 4: Record Video */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setActiveModal('video');
              startCamera();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-200 hover:text-white text-sm font-medium transition-colors text-left group"
          >
            <span className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-purple-400 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <span>Record Video</span>
              {isIOS() && (
                <p className="text-[10px] text-amber-400 mt-0.5 leading-tight">
                  Requires iOS 14.3+ & HTTPS
                </p>
              )}
            </div>
          </button>
        </div>
      )}

      {/* ── MODAL: Voice Mode Recording ── */}
      {activeModal === 'voice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#181a20] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isRecording && <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />}
                <h3 className="text-lg font-bold">Voice Mode Recording</h3>
              </div>
              <button
                type="button"
                onClick={() => { stopVoiceRecording(); setActiveModal('none'); setVoiceError(null); }}
                className="text-gray-400 hover:text-white text-sm"
              >✕</button>
            </div>

            {/* Error (mic denied, not supported, etc.) */}
            {voiceError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs space-y-1">
                <p className="font-semibold">⚠️ Recording unavailable</p>
                <p>{voiceError}</p>
                {isIOS() && (
                  <p className="text-amber-300 text-[10px] mt-1">
                    iOS tip: Make sure you are using HTTPS and have granted microphone permission in <strong>Settings → Safari → Microphone</strong>.
                  </p>
                )}
              </div>
            )}

            {/* iOS info banner when no error yet (pre-recording) */}
            {!voiceError && isIOS() && !hasSpeechAPI && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                <p className="font-semibold mb-0.5">ℹ️ iOS Safari Note</p>
                <p>Live speech-to-text transcription is not available on iOS Safari. Your voice will be recorded as an audio file.</p>
              </div>
            )}

            {/* Pulse Visualizer & Timer */}
            {!voiceError && (
              <div className="py-6 flex flex-col items-center justify-center space-y-4 bg-surface-900/60 rounded-xl border border-white/5">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500/20 text-red-400 ring-4 ring-red-500/30 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="text-2xl font-mono font-bold tracking-wider">
                  {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-xs text-gray-400">
                  {isRecording ? 'Listening… Speak now' : 'Ready to record'}
                </p>
              </div>
            )}

            {/* Live transcript (Chrome/desktop only) */}
            {hasSpeechAPI && audioTranscript && (
              <div className="p-3 bg-surface-900 rounded-lg text-xs text-gray-300 border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-500">Live Transcript:</span>
                <p className="italic">{audioTranscript}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {!voiceError && (
                <>
                  {isRecording ? (
                    <button
                      type="button"
                      onClick={stopVoiceRecording}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 font-semibold text-sm transition-all"
                    >Stop Recording</button>
                  ) : (
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="flex-1 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 font-semibold text-sm transition-all"
                    >Re-record</button>
                  )}
                  <button
                    type="button"
                    disabled={isRecording || !hasAudioData}
                    onClick={handleSaveVoiceNote}
                    className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 font-semibold text-sm transition-all"
                  >Attach Audio Clip</button>
                </>
              )}
              {voiceError && (
                <button
                  type="button"
                  onClick={() => { setVoiceError(null); startVoiceRecording(); }}
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 font-semibold text-sm"
                >Try Again</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Text Note ── */}
      {activeModal === 'text' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#181a20] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Text Note</h3>
              <button type="button" onClick={() => setActiveModal('none')} className="text-gray-400 hover:text-white text-sm">✕</button>
            </div>
            <textarea
              rows={4}
              value={textNoteContent}
              onChange={(e) => setTextNoteContent(e.target.value)}
              placeholder="Type detailed patrol remark or observations here..."
              className="w-full bg-surface-900 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setActiveModal('none')} className="px-4 py-2 rounded-xl bg-surface-800 text-gray-300 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={handleSaveTextNote} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold">Attach Note</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Video Recorder ── */}
      {activeModal === 'video' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#181a20] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Record Video Evidence</h3>
              <button type="button" onClick={closeVideoModal} className="text-gray-400 hover:text-white text-sm">✕</button>
            </div>

            {videoError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                <p className="font-semibold">⚠️ Camera unavailable</p>
                <p>{videoError}</p>
                {isIOS() && (
                  <p className="text-amber-300 text-[10px] mt-1">
                    iOS tip: Allow camera access in <strong>Settings → Safari → Camera</strong> and ensure this site uses HTTPS.
                  </p>
                )}
              </div>
            )}

            {!videoError && (
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {isVideoRecording && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600/80 px-3 py-1 rounded-full text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    REC
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {!videoError && !isVideoRecording && (
                <button type="button" onClick={startVideoRecording} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 font-semibold text-sm">Start Recording</button>
              )}
              {!videoError && isVideoRecording && (
                <button type="button" onClick={stopVideoRecording} className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold text-sm">Stop Recording</button>
              )}
              <button
                type="button"
                disabled={isVideoRecording || !hasVideoData}
                onClick={saveVideoNote}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 font-semibold text-sm"
              >Attach Video Clip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
