import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useRoutes, useStartPatrol, useScanCheckpoint, useEndPatrol, useSession, useMyActiveSession } from '../hooks/usePatrolSessions';
import { uploadImageToR2 } from '../hooks/useIncidents';

type FlowPhase = 'select-route' | 'active' | 'scan-qr' | 'checkpoint-form' | 'completed';

export function PatrolFlowPage() {
  const { data: routes, isLoading: routesLoading } = useRoutes();
  const { data: activeSessionData, isLoading: activeLoading } = useMyActiveSession();

  const startMutation = useStartPatrol();
  const scanMutation = useScanCheckpoint();
  const endMutation = useEndPatrol();

  const [phase, setPhase] = useState<FlowPhase>('select-route');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [shift, setShift] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto-resume existing active session on load or navigation back
  useEffect(() => {
    if (activeSessionData) {
      setSessionId(activeSessionData.id);
      if (phase === 'select-route') {
        setPhase('active');
      }
    }
  }, [activeSessionData]);

  // After successful QR scan
  const [scannedQr, setScannedQr] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'NORMAL' | 'ISSUE_FOUND' | 'EMERGENCY'>('NORMAL');
  const [remarks, setRemarks] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const scannerDivId = 'patrol-qr-scanner';

  // Fetch session details for progress, with active session fallback
  const targetSessionId = sessionId || activeSessionData?.id || '';
  const { data: sessionData, refetch: refetchSession } = useSession(targetSessionId);
  const session = sessionData || activeSessionData;

  // ─── QR scanner lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'scan-qr') return;
    const el = document.getElementById(scannerDivId);
    if (el) el.innerHTML = '';
    const scanner = new Html5Qrcode(scannerDivId);
    scannerRef.current = scanner;
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240, aspectRatio: 1.0 }, (text) => {
      scanner.stop().catch(() => {});
      setScannedQr(text);
      setPhase('checkpoint-form');
    }, undefined).catch(err => setError(`Camera error: ${err}`));
    return () => {
      try { if (scanner.isScanning) scanner.stop().catch(() => {}); else scanner.clear(); } catch {}
    };
  }, [phase]);

  // ─── Start patrol ────────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!selectedRouteId) { setError('Select a route'); return; }
    setError(null);
    try {
      const sess = await startMutation.mutateAsync({ routeId: selectedRouteId, shift: shift || undefined });
      setSessionId(sess.id);
      setPhase('active');
    } catch { setError('Failed to start patrol'); }
  };

  // ─── Handle photo selection ──────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setPhotoFiles(prev => [...prev, ...files]);
    setPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };

  // ─── Submit checkpoint form ───────────────────────────────────────────────────
  const [outOfRangeInfo, setOutOfRangeInfo] = useState<{ distanceStr: string; radiusStr: string; distanceVal: number; radiusVal: number; checkpoint: string } | null>(null);

  const formatDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)}m`);

  const handleCheckpointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedQr || !sessionId) return;
    setSubmitting(true);
    setError(null);
    setOutOfRangeInfo(null);
    try {
      // Get GPS
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 }));

      // Upload photos
      const images: { imageUrl: string; r2Key: string }[] = [];
      for (const file of photoFiles) {
        const img = await uploadImageToR2(file);
        images.push(img);
      }

      const result = await scanMutation.mutateAsync({
        sessionId,
        qrCode: scannedQr,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        severity,
        remarks: remarks || undefined,
        images: images.length ? images : undefined,
      });

      setLastScanResult(result);
      // Reset form
      setScannedQr(null); setSeverity('NORMAL'); setRemarks(''); setPhotoFiles([]); setPhotoPreviews([]);
      await refetchSession();
      setPhase('active');
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? err?.message ?? 'Scan submission failed';
      // Parse out-of-range info from the backend message (handles e.g. "1.25 km" or "450m")
      const distMatch = msg.match(/You are (.+?) away from "(.+?)"\. You must be within (.+?) to submit/);
      if (distMatch) {
        const parseVal = (str: string) => {
          const num = parseFloat(str);
          return str.includes('km') ? num * 1000 : num;
        };
        const dVal = parseVal(distMatch[1]);
        const rVal = parseVal(distMatch[3]);
        setOutOfRangeInfo({
          distanceStr: distMatch[1],
          checkpoint: distMatch[2],
          radiusStr: distMatch[3],
          distanceVal: dVal,
          radiusVal: rVal,
        });
      } else {
        setError(msg);
      }
    } finally { setSubmitting(false); }
  };

  // ─── End patrol ──────────────────────────────────────────────────────────────
  const handleEnd = async () => {
    if (!sessionId) return;
    if (!confirm('End this patrol session?')) return;
    setError(null);
    try {
      await endMutation.mutateAsync(sessionId);
      await refetchSession();
      setPhase('completed');
    } catch { setError('Failed to end patrol'); }
  };

  // ─── Progress helpers ────────────────────────────────────────────────────────
  const completedIds = new Set(session?.sessionLogs?.map((l: any) => l.checkpointId) ?? []);
  const routeCheckpoints = session?.route?.checkpoints ?? [];
  const completionPct = session ? Math.round(session.completionRate) : 0;
  const nextCheckpointObj = routeCheckpoints.find((rc: any) => !completedIds.has(rc.checkpointId));
  const nextCheckpoint = nextCheckpointObj?.checkpoint;

  const severityConfig = {
    NORMAL: { label: '✅ Normal', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    ISSUE_FOUND: { label: '⚠️ Issue Found', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
    EMERGENCY: { label: '🚨 Emergency', cls: 'border-red-500/40 bg-red-500/10 text-red-300' },
  };

  if (activeLoading && !session && !sessionId) {
    return (
      <div className="card p-12 text-center text-gray-400 max-w-lg mx-auto animate-fade-in">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
        Checking active patrol session…
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in space-y-6">
      {/* ── SELECT ROUTE ── */}
      {phase === 'select-route' && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Start Patrol</h1>
            <p className="text-gray-500 mt-1">Select a route and begin your patrol session.</p>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
          <div className="card p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Patrol Route *</label>
              {routesLoading ? <div className="text-gray-500 text-sm">Loading routes…</div> : (
                <select className="input text-sm" value={selectedRouteId} onChange={e => setSelectedRouteId(e.target.value)}>
                  <option value="">Select route</option>
                  {routes?.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.checkpoints.length} checkpoints)</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Shift</label>
              <select className="input text-sm" value={shift} onChange={e => setShift(e.target.value)}>
                <option value="">Select shift</option>
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
            </div>
            <button onClick={handleStart} disabled={startMutation.isPending} className="btn-primary w-full py-3">
              {startMutation.isPending ? 'Starting…' : '🚀 Start Patrol'}
            </button>
          </div>
        </div>
      )}

      {/* ── ACTIVE SESSION ── */}
      {phase === 'active' && session && (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-white">{session.route?.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{shift} Shift · Started {new Date(session.startTime).toLocaleTimeString()}</p>
          </div>

          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

          {lastScanResult && (
            <div className={`p-3 rounded-xl border text-xs font-medium ${lastScanResult.isVerified ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
              {lastScanResult.isVerified ? '✅ Checkpoint verified' : '⚠️ GPS out of range — logged as unverified'} · {Math.round(lastScanResult.distanceMeters ?? 0)}m away
            </div>
          )}

          {/* Progress bar */}
          <div className="card p-4 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-gray-400">
              <span>Progress</span>
              <span className="text-white">{session.completedCount}/{session.totalCount} checkpoints</span>
            </div>
            <div className="w-full h-2 bg-surface-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-600 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${completionPct}%` }} />
            </div>
            <p className="text-xs text-gray-500 text-right">{completionPct}% complete</p>
          </div>

          {/* Next Required Location Card */}
          {nextCheckpoint ? (
            <div className="card p-4 bg-gradient-to-r from-brand-900/60 to-surface-800 border-brand-500/40 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 border border-brand-500/30">
                  <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping shrink-0" />
                  Next Required Location
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {completedIds.size + 1} of {routeCheckpoints.length}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📍</span> {nextCheckpoint.name}
                </h3>
                {nextCheckpoint.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{nextCheckpoint.description}</p>
                )}
              </div>
              <button
                onClick={() => setPhase('scan-qr')}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 shadow-xl shadow-brand-600/20"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 0h.01M5 8v.01M3 12h.01M5 16H3m2 0h.01M5 16v.01" />
                </svg>
                Scan Next Location ({nextCheckpoint.name})
              </button>
            </div>
          ) : (
            <div className="card p-4 bg-emerald-500/10 border-emerald-500/30 text-center space-y-2">
              <p className="text-emerald-300 font-bold text-sm">🎉 All checkpoints completed!</p>
              <p className="text-xs text-gray-400">You have scanned all checkpoints in this route.</p>
            </div>
          )}

          {/* Checkpoint list */}
          <div className="card p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">All Route Checkpoints</p>
            {routeCheckpoints.map((rc: any, idx: number) => {
              const done = completedIds.has(rc.checkpointId);
              const isNext = nextCheckpointObj?.checkpointId === rc.checkpointId;
              return (
                <div
                  key={rc.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    done
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : isNext
                      ? 'bg-brand-500/15 border-brand-500/50 text-white shadow-md shadow-brand-500/10 ring-1 ring-brand-500/30'
                      : 'bg-surface-900/50 border-white/5 text-gray-400'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : isNext
                        ? 'bg-brand-500 text-white animate-pulse'
                        : 'bg-surface-700 text-gray-400'
                    }`}
                  >
                    {done ? '✓' : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${done ? 'text-emerald-200' : isNext ? 'text-white font-semibold' : 'text-gray-300'}`}>
                      {rc.checkpoint.name}
                    </p>
                  </div>
                  {done && <span className="ml-auto text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">DONE</span>}
                  {isNext && <span className="ml-auto text-[10px] text-brand-300 font-bold bg-brand-500/30 px-2 py-0.5 rounded-full border border-brand-500/40 animate-pulse">NEXT REQUIRED</span>}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button onClick={() => setPhase('scan-qr')} className="btn-primary w-full sm:flex-1 py-3.5 px-4 text-sm font-semibold flex items-center justify-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 0h.01M5 8v.01M3 12h.01M5 16H3m2 0h.01M5 16v.01" /></svg>
              <span>Scan Checkpoint QR</span>
            </button>
            <button onClick={handleEnd} disabled={endMutation.isPending} className="btn-secondary w-full sm:w-auto px-5 py-3.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20 font-semibold flex items-center justify-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
              <span>{endMutation.isPending ? 'Stopping…' : 'Stop Patrol'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── QR SCAN ── */}
      {phase === 'scan-qr' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setPhase('active')} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-lg font-bold text-white">Scan Checkpoint QR</h2>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
          <div className="card overflow-hidden"><div id={scannerDivId} className="w-full aspect-square bg-surface-900" /></div>
          <p className="text-center text-xs text-gray-600">Point the camera at the checkpoint QR code.</p>
        </div>
      )}

      {/* ── CHECKPOINT FORM ── */}
      {phase === 'checkpoint-form' && (
        <div className="space-y-4 relative">
          {/* Submission overlay — blocks all interaction */}
          {submitting && (
            <div className="absolute inset-0 z-20 rounded-2xl bg-surface-900/80 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-brand-500/30 border-t-brand-500 animate-spin" />
              <div className="text-center">
                <p className="text-white font-semibold text-sm">Submitting…</p>
                <p className="text-gray-400 text-xs mt-1">Please wait, uploading photos & verifying GPS</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setPhase('scan-qr'); setScannedQr(null); }}
              disabled={submitting}
              className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-lg font-bold text-white">Checkpoint Report</h2>
          </div>

          <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-mono">
            QR: {scannedQr}
          </div>

          {/* Out-of-Range Error Card */}
          {outOfRangeInfo && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/8 overflow-hidden animate-fade-in">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border-b border-red-500/20">
                <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-red-200 font-bold text-sm">Too Far Away — Submission Blocked</p>
                  <p className="text-red-400/80 text-xs mt-0.5">Move closer to "{outOfRangeInfo.checkpoint}"</p>
                </div>
              </div>

              {/* Distance meter */}
              <div className="p-4 flex items-center gap-5">
                {/* Circular ring indicator */}
                <div className="relative w-20 h-20 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke="#ef4444" strokeWidth="3"
                      strokeDasharray={`${Math.min((outOfRangeInfo.radiusVal / outOfRangeInfo.distanceVal) * 100, 100)} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-red-300 font-bold text-xs text-center px-1 leading-none">{outOfRangeInfo.distanceStr}</span>
                    <span className="text-red-500 text-[9px] mt-0.5">away</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Your distance</span>
                    <span className="text-red-300 font-bold">{outOfRangeInfo.distanceStr}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${Math.min((outOfRangeInfo.radiusVal / outOfRangeInfo.distanceVal) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Required radius</span>
                    <span className="text-emerald-400 font-bold">{outOfRangeInfo.radiusStr}</span>
                  </div>
                  <p className="text-[11px] text-red-400/70 pt-1">
                    You need to be <strong className="text-red-300">{formatDist(outOfRangeInfo.distanceVal - outOfRangeInfo.radiusVal)} closer</strong> to submit.
                    This attempt has been logged for admin review.
                  </p>
                </div>
              </div>

              {/* Retry button */}
              <div className="px-4 pb-4">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCheckpointSubmit as any}
                  className="w-full py-2.5 rounded-xl bg-red-600/20 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {submitting ? 'Checking location…' : 'Retry — Re-check My Location'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

          <form onSubmit={handleCheckpointSubmit} className="space-y-4">
            {/* Severity */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2">Status *</label>
              <div className="grid grid-cols-3 gap-2">
                {(['NORMAL', 'ISSUE_FOUND', 'EMERGENCY'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setSeverity(s)}
                    disabled={submitting}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${severity === s ? severityConfig[s].cls : 'border-white/10 bg-surface-900/50 text-gray-500 hover:border-white/20'}`}
                  >
                    {severityConfig[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Remarks {severity !== 'NORMAL' && '*'}</label>
              <textarea rows={2} className="input text-sm" value={remarks}
                onChange={e => setRemarks(e.target.value)}
                disabled={submitting}
                placeholder={severity === 'NORMAL' ? 'Optional remarks…' : 'Describe the issue or emergency…'}
              />
            </div>

            {/* Photo — optional unless issue/emergency */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2">
                Photo Evidence {severity !== 'NORMAL' ? '(Required)' : '(Optional)'}
              </label>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
              <input ref={galleryInputRef} id="patrol-gallery" type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button type="button" onClick={() => cameraInputRef.current?.click()}
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-brand-600/20 border border-brand-500/30 text-brand-300 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                  📷 Camera
                </button>
                <button type="button" onClick={() => galleryInputRef.current?.click()}
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-surface-700/50 border border-white/10 text-gray-200 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                  🖼️ Gallery
                </button>
              </div>
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {photoPreviews.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                      <img src={url} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => { setPhotoFiles(p => p.filter((_, j) => j !== i)); setPhotoPreviews(p => p.filter((_, j) => j !== i)); }}
                        disabled={submitting}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 rounded-full text-[10px] text-white flex items-center justify-center disabled:opacity-0 disabled:pointer-events-none">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setPhase('active')} disabled={submitting} className="btn-secondary text-xs flex-1 disabled:opacity-30 disabled:cursor-not-allowed">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary text-xs flex-1 py-3">
                {submitting ? 'Submitting…' : '✅ Submit & Continue'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── COMPLETED ── */}
      {phase === 'completed' && session && (
        <div className="space-y-6 text-center animate-scale-in">
          <div className="card p-8 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Patrol Completed!</h2>
              <p className="text-gray-400 text-sm mt-1">{session.route?.name}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full text-sm">
              <div className="text-center">
                <p className="text-white font-bold text-lg">{Math.round(session.completionRate)}%</p>
                <p className="text-gray-500 text-xs">Completion</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg">{session.completedCount}/{session.totalCount}</p>
                <p className="text-gray-500 text-xs">Checkpoints</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg">
                  {session.durationSeconds ? `${Math.floor(session.durationSeconds / 60)}m` : '—'}
                </p>
                <p className="text-gray-500 text-xs">Duration</p>
              </div>
            </div>
          </div>
          <button onClick={() => { setPhase('select-route'); setSessionId(null); setLastScanResult(null); }} className="btn-primary w-full py-3">
            Start Another Patrol
          </button>
        </div>
      )}
    </div>
  );
}
