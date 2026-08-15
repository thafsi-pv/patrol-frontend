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

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function getBestAudioMimeType(): string {
  const types = ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function getBestVideoMimeType(): string {
  const types = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function extForMime(mime: string): string {
  if (mime.startsWith('audio/mp4') || mime.startsWith('audio/aac')) return 'm4a';
  if (mime.startsWith('video/mp4')) return 'mp4';
  if (mime.startsWith('audio/ogg')) return 'ogg';
  if (mime.startsWith('video/webm') || mime.startsWith('audio/webm')) return 'webm';
  return 'audio';
}

const hasMediaRecorder = () => typeof MediaRecorder !== 'undefined';

export function MediaAttachmentMenu({ onAddAttachment, disabled }: MediaAttachmentMenuProps) {
  const [activeModal, setActiveModal] = useState<'none' | 'voice' | 'video'>('none');

  // Voice
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioTranscript, setAudioTranscript] = useState('');
  const [hasSpeechAPI, setHasSpeechAPI] = useState(false);
  const [hasAudioData, setHasAudioData] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  // Video
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [hasVideoData, setHasVideoData] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoTimerRef = useRef<any>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasSpeechAPI(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isRecording]);

  useEffect(() => {
    if (isVideoRecording) {
      videoTimerRef.current = setInterval(() => setVideoTime(t => t + 1), 1000);
    } else {
      clearInterval(videoTimerRef.current);
    }
    return () => clearInterval(videoTimerRef.current);
  }, [isVideoRecording]);

  const handlePhotosFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(file => {
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
  };

  const startVoiceRecording = async () => {
    setVoiceError(null);
    if (!hasMediaRecorder()) {
      setVoiceError('Voice recording not supported. Update iOS to 14.3+ or use Chrome.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = getBestAudioMimeType();
      let mr: MediaRecorder;
      try { mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream); }
      catch { mr = new MediaRecorder(stream); }
      mediaRecorderRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) { audioChunksRef.current.push(e.data); setHasAudioData(true); } };
      mr.start();
      setIsRecording(true); setRecordingTime(0); setHasAudioData(false);
      if (hasSpeechAPI) {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        try {
          const r = new SR();
          r.continuous = true; r.interimResults = true; r.lang = 'en-US';
          r.onresult = (ev: any) => { let cur = ''; for (let i = 0; i < ev.results.length; i++) cur += ev.results[i][0].transcript; setAudioTranscript(cur); };
          r.onerror = () => {};
          r.start(); recognitionRef.current = r;
        } catch {}
      }
    } catch (err: any) {
      setVoiceError(err?.name === 'NotAllowedError' ? 'Microphone permission denied.' : err?.name === 'NotFoundError' ? 'No microphone found.' : `Microphone error: ${err?.message}`);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()); }
    try { recognitionRef.current?.stop(); } catch {}
    setIsRecording(false);
  };

  const handleSaveVoiceNote = () => {
    if (audioChunksRef.current.length > 0 || hasAudioData) {
      const mimeType = getBestAudioMimeType() || 'audio/webm';
      const ext = extForMime(mimeType);
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const file = new File([blob], `voice_note_${Date.now()}.${ext}`, { type: mimeType });
      onAddAttachment({ id: Math.random().toString(36).substring(2, 9), type: 'audio', file, previewUrl: URL.createObjectURL(blob), name: `Voice Note (${recordingTime}s)`, textNote: audioTranscript.trim() ? `Transcript: "${audioTranscript.trim()}"` : undefined });
    }
    setActiveModal('none'); setAudioTranscript(''); setRecordingTime(0); setVoiceError(null); setHasAudioData(false); audioChunksRef.current = [];
  };

  const closeVoiceModal = () => {
    stopVoiceRecording(); setActiveModal('none'); setVoiceError(null); setAudioTranscript(''); setRecordingTime(0); setHasAudioData(false); audioChunksRef.current = [];
  };

  const openVideoModal = async () => {
    setVideoError(null); setVideoReady(false); setHasVideoData(false); setIsVideoRecording(false); setVideoTime(0); videoChunksRef.current = [];
    setActiveModal('video');
    if (!hasMediaRecorder()) { setVideoError('Video recording not supported on this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
      streamRef.current = stream;
      setVideoReady(true);
      setTimeout(() => { if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream; }, 80);
    } catch (err: any) {
      setVideoError(err?.name === 'NotAllowedError' ? 'Camera permission denied. Please allow camera access.' : `Camera error: ${err?.message}`);
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;
    videoChunksRef.current = [];
    const mimeType = getBestVideoMimeType();
    let mr: MediaRecorder;
    try { mr = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current); }
    catch { mr = new MediaRecorder(streamRef.current); }
    videoMediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) { videoChunksRef.current.push(e.data); setHasVideoData(true); } };
    mr.start(); setHasVideoData(false); setIsVideoRecording(true); setVideoTime(0);
  };

  const stopVideoRecording = () => { videoMediaRecorderRef.current?.stop(); setIsVideoRecording(false); };

  const saveVideoNote = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoChunksRef.current.length > 0 || hasVideoData) {
      const mimeType = getBestVideoMimeType() || 'video/mp4';
      const ext = extForMime(mimeType);
      const blob = new Blob(videoChunksRef.current, { type: mimeType });
      const file = new File([blob], `video_note_${Date.now()}.${ext}`, { type: mimeType });
      onAddAttachment({ id: Math.random().toString(36).substring(2, 9), type: 'video', file, previewUrl: URL.createObjectURL(blob), name: `Video Note (${videoTime}s)` });
    }
    setHasVideoData(false); videoChunksRef.current = []; setActiveModal('none'); setIsVideoRecording(false); setVideoTime(0); setVideoReady(false);
  };

  const closeVideoModal = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setActiveModal('none'); setIsVideoRecording(false); setVideoError(null); setVideoReady(false); setHasVideoData(false); setVideoTime(0); videoChunksRef.current = [];
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <>
      {/* Hidden file input */}
      <input ref={photoInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handlePhotosFilesChange} />

      {/* ── Inline icon buttons ── */}
      <div className="flex items-center gap-1.5">
        {/* Attachment */}
        <button type="button" disabled={disabled} onClick={() => photoInputRef.current?.click()} title="Add Photo or File"
          className="w-9 h-9 rounded-xl bg-surface-800 hover:bg-brand-600/20 border border-white/10 hover:border-brand-500/40 text-gray-400 hover:text-brand-400 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40">
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Voice */}
        <button type="button" disabled={disabled} onClick={() => { setActiveModal('voice'); startVoiceRecording(); }} title="Record Voice Note"
          className="w-9 h-9 rounded-xl bg-surface-800 hover:bg-emerald-600/20 border border-white/10 hover:border-emerald-500/40 text-gray-400 hover:text-emerald-400 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

        {/* Video */}
        <button type="button" disabled={disabled} onClick={openVideoModal} title="Record Video"
          className="w-9 h-9 rounded-xl bg-surface-800 hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/40 text-gray-400 hover:text-purple-400 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/40">
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* ── MODAL: Voice Recording ── */}
      {activeModal === 'voice' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#181a20] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl text-white overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex items-center gap-2.5">
                {isRecording && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />}
                <h3 className="text-base font-bold">Voice Recording</h3>
              </div>
              <button type="button" onClick={closeVoiceModal} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {voiceError && (
              <div className="mx-5 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs space-y-1">
                <p className="font-semibold">Recording unavailable</p>
                <p>{voiceError}</p>
                {isIOS() && <p className="text-amber-300 text-[10px] mt-1">iOS: Settings → Safari → Microphone → Allow</p>}
              </div>
            )}

            {!voiceError && (
              <div className="mx-5 mb-4 py-8 flex flex-col items-center gap-4 bg-surface-900/60 rounded-2xl border border-white/5 relative overflow-hidden">
                {isRecording && (
                  <>
                    <span className="absolute inset-0 m-auto w-28 h-28 rounded-full border border-red-500/25 animate-ping pointer-events-none" style={{ animationDuration: '1.6s' }} />
                    <span className="absolute inset-0 m-auto w-36 h-36 rounded-full border border-red-500/12 animate-ping pointer-events-none" style={{ animationDuration: '2.2s' }} />
                  </>
                )}
                <div className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-red-500/20 ring-4 ring-red-500/30' : hasAudioData ? 'bg-emerald-500/20 ring-2 ring-emerald-500/30' : 'bg-surface-700'}`}>
                  <svg className={`w-9 h-9 transition-colors ${isRecording ? 'text-red-400' : hasAudioData ? 'text-emerald-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="relative z-10 text-3xl font-mono font-bold tracking-widest text-white">{fmt(recordingTime)}</div>
                <p className="relative z-10 text-xs text-gray-400 font-medium">
                  {isRecording ? '🔴 Listening… speak now' : hasAudioData ? '✅ Ready to attach' : 'Ready to record'}
                </p>
              </div>
            )}

            {hasSpeechAPI && audioTranscript && (
              <div className="mx-5 mb-4 p-3 bg-surface-900 rounded-xl text-xs text-gray-300 border border-white/5">
                <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Live Transcript</span>
                <p className="italic leading-relaxed">{audioTranscript}</p>
              </div>
            )}

            <div className="p-5 pt-2 flex gap-3">
              {!voiceError && (
                <>
                  {isRecording ? (
                    <button type="button" onClick={stopVoiceRecording} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                      Stop
                    </button>
                  ) : (
                    <button type="button" onClick={startVoiceRecording} className="flex-1 py-3 rounded-xl bg-surface-700 hover:bg-surface-600 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Re-record
                    </button>
                  )}
                  <button type="button" disabled={isRecording || !hasAudioData} onClick={handleSaveVoiceNote} className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-all">
                    Attach
                  </button>
                </>
              )}
              {voiceError && (
                <button type="button" onClick={() => { setVoiceError(null); startVoiceRecording(); }} className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 font-semibold text-sm">
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Video Recorder ── */}
      {activeModal === 'video' && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ height: '100dvh' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              {isVideoRecording ? (
                <span className="flex items-center gap-2 bg-red-600/90 px-3 py-1 rounded-full text-xs font-bold text-white">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  REC {fmt(videoTime)}
                </span>
              ) : (
                <h3 className="text-base font-bold text-white">Record Video</h3>
              )}
            </div>
            <button type="button" onClick={closeVideoModal}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Camera view */}
          <div className="flex-1 relative bg-black overflow-hidden">
            {videoError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-red-200 font-bold">Camera Unavailable</p>
                  <p className="text-red-400/80 text-sm mt-1">{videoError}</p>
                  {isIOS() && <p className="text-amber-300 text-xs mt-2">iOS: Settings → Safari → Camera → Allow. Requires HTTPS.</p>}
                </div>
              </div>
            )}

            {!videoError && !videoReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Starting camera…</p>
              </div>
            )}

            {!videoError && (
              <video ref={videoPreviewRef} autoPlay playsInline muted
                className={`w-full h-full object-cover transition-opacity duration-500 ${videoReady ? 'opacity-100' : 'opacity-0'}`} />
            )}

            {/* REC badge overlay */}
            {isVideoRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-red-500/30">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-bold text-sm font-mono">{fmt(videoTime)}</span>
              </div>
            )}

            {/* Done overlay */}
            {hasVideoData && !isVideoRecording && (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-emerald-300 font-bold">Recording complete!</p>
                <p className="text-gray-400 text-sm">Duration: {fmt(videoTime)}</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="shrink-0 px-6 py-5 border-t border-white/10 bg-[#111318] flex items-center justify-center gap-4"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
            {/* Start recording */}
            {!videoError && !isVideoRecording && !hasVideoData && videoReady && (
              <button type="button" onClick={startVideoRecording}
                className="w-18 h-18 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-2xl shadow-red-900/60 transition-all active:scale-90 focus:outline-none"
                style={{ width: 72, height: 72 }}>
                <span className="w-8 h-8 rounded-full bg-white block" />
              </button>
            )}
            {/* Stop recording */}
            {!videoError && isVideoRecording && (
              <button type="button" onClick={stopVideoRecording}
                className="w-18 h-18 rounded-full bg-white flex items-center justify-center shadow-2xl transition-all active:scale-90 focus:outline-none"
                style={{ width: 72, height: 72 }}>
                <span className="w-8 h-8 rounded-lg bg-red-600 block" />
              </button>
            )}
            {/* After recording: Retake + Attach */}
            {!videoError && hasVideoData && !isVideoRecording && (
              <div className="flex gap-3 w-full">
                <button type="button"
                  onClick={() => { setHasVideoData(false); videoChunksRef.current = []; setVideoTime(0); if (videoReady) startVideoRecording(); }}
                  className="flex-1 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Retake
                </button>
                <button type="button" onClick={saveVideoNote}
                  className="flex-1 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white shadow-lg shadow-brand-900/40">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  Attach Video
                </button>
              </div>
            )}
            {videoError && (
              <button type="button" onClick={closeVideoModal} className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 font-semibold text-sm text-white">
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
