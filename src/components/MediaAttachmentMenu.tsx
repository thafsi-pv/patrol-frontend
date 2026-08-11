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

export function MediaAttachmentMenu({ onAddAttachment, disabled }: MediaAttachmentMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'voice' | 'text' | 'video'>('none');
  
  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioTranscript, setAudioTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  // Text Note state
  const [textNoteContent, setTextNoteContent] = useState('');

  // Video recording state
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const videoMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Hidden file inputs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // 2. Voice Recording & Speech-to-Text
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Web Speech API for real-time transcription if browser supports it
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
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
          recognition.start();
          recognitionRef.current = recognition;
        } catch (err) {
          console.warn('Speech recognition not available or denied:', err);
        }
      }
    } catch (err) {
      alert('Microphone access denied or not supported in this browser.');
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
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
      
      onAddAttachment({
        id: Math.random().toString(36).substring(2, 9),
        type: 'audio',
        file: audioFile,
        previewUrl: URL.createObjectURL(audioBlob),
        name: `Voice Note (${recordingTime}s)`,
        textNote: audioTranscript.trim() ? `Transcript: "${audioTranscript.trim()}"` : undefined,
      });
    }
    // Cleanup
    setActiveModal('none');
    setAudioTranscript('');
    setRecordingTime(0);
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

  // 4. Live Video Camera Handler
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('Camera access denied or not supported.');
      setActiveModal('none');
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;
    videoChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current);
    videoMediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };

    mediaRecorder.start();
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
    if (videoChunksRef.current.length > 0) {
      const videoBlob = new Blob(videoChunksRef.current, { type: 'video/mp4' });
      const videoFile = new File([videoBlob], `video_note_${Date.now()}.mp4`, { type: 'video/mp4' });

      onAddAttachment({
        id: Math.random().toString(36).substring(2, 9),
        type: 'video',
        file: videoFile,
        previewUrl: URL.createObjectURL(videoBlob),
        name: `Video Note (${new Date().toLocaleTimeString()})`,
      });
    }
    setActiveModal('none');
    setIsOpen(false);
  };

  const closeVideoModal = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setActiveModal('none');
    setIsVideoRecording(false);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Plus Button matching screenshot (+ circle) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-surface-800 hover:bg-surface-700 border border-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        title="Add image, voice, text or video"
      >
        <svg className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Hidden File Inputs */}
      <input
        ref={photoInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={handlePhotosFilesChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotosFilesChange}
      />

      {/* Popup Menu matching uploaded screenshot design */}
      {isOpen && (
        <div className="absolute bottom-12 left-0 z-50 w-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-1.5 space-y-1">
          {/* Option 1: Add Photos & Files */}
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-200 hover:text-white text-sm font-medium transition-colors text-left group"
          >
            <span className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-gray-300 group-hover:text-brand-400 group-hover:scale-105 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </span>
            <span>Add Photos & Files</span>
          </button>

          {/* Option 2: Record Voice / Voice Mode */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setActiveModal('voice');
              startVoiceRecording();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-200 hover:text-white text-sm font-medium transition-colors text-left group"
          >
            <span className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </span>
            <span>Voice Mode & Audio</span>
          </button>

          {/* Option 3: Add Text Note */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setActiveModal('text');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-200 hover:text-white text-sm font-medium transition-colors text-left group"
          >
            <span className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-all">
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
            <span className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </span>
            <span>Record Video</span>
          </button>
        </div>
      )}

      {/* ── MODAL: Voice Mode Recording ── */}
      {activeModal === 'voice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#181a20] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <h3 className="text-lg font-bold">Voice Mode Recording</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopVoiceRecording();
                  setActiveModal('none');
                }}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Pulse Visualizer & Timer */}
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
                {isRecording ? 'Listening... Speak now' : 'Recording stopped'}
              </p>
            </div>

            {/* Speech Transcript Output */}
            {audioTranscript && (
              <div className="p-3 bg-surface-900 rounded-lg text-xs text-gray-300 border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-500">Live Transcript:</span>
                <p className="italic">{audioTranscript}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 font-semibold text-sm transition-all"
                >
                  Stop Recording
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="flex-1 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 font-semibold text-sm transition-all"
                >
                  Re-record
                </button>
              )}

              <button
                type="button"
                disabled={isRecording || audioChunksRef.current.length === 0}
                onClick={handleSaveVoiceNote}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 font-semibold text-sm transition-all"
              >
                Attach Audio Clip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Text Note ── */}
      {activeModal === 'text' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#181a20] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Text Note</h3>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <textarea
              rows={4}
              value={textNoteContent}
              onChange={(e) => setTextNoteContent(e.target.value)}
              placeholder="Type detailed patrol remark or observations here..."
              className="w-full bg-surface-900 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 rounded-xl bg-surface-800 text-gray-300 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTextNote}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold"
              >
                Attach Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Video Recorder ── */}
      {activeModal === 'video' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#181a20] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Record Video Evidence</h3>
              <button
                type="button"
                onClick={closeVideoModal}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center">
              <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {isVideoRecording && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600/80 px-3 py-1 rounded-full text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  REC
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              {!isVideoRecording ? (
                <button
                  type="button"
                  onClick={startVideoRecording}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 font-semibold text-sm transition-all"
                >
                  Start Recording
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopVideoRecording}
                  className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold text-sm transition-all"
                >
                  Stop Recording
                </button>
              )}

              <button
                type="button"
                disabled={isVideoRecording || videoChunksRef.current.length === 0}
                onClick={saveVideoNote}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 font-semibold text-sm transition-all"
              >
                Attach Video Clip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
