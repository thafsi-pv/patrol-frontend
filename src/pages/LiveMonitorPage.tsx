import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useActiveSessions, useSessionStats } from '../hooks/usePatrolSessions';

function formatDuration(startTime: string) {
  const secs = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export function LiveMonitorPage() {
  const {
    data: sessions,
    isLoading,
    error,
    dataUpdatedAt,
    refetch: refetchSessions,
    isFetching: isFetchingSessions,
  } = useActiveSessions();
  const {
    data: stats,
    refetch: refetchStats,
    isFetching: isFetchingStats,
  } = useSessionStats();
  const [, setTick] = useState(0);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Re-render every second to update elapsed times
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedSessionIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isRefreshing = isFetchingSessions || isFetchingStats;
  const handleRefresh = () => {
    void refetchSessions();
    void refetchStats();
  };

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Patrol Monitor</h1>
          <p className="text-gray-500 mt-1 text-sm">Real-time view of all active patrols·</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-surface-800 px-3 py-1.5 rounded-full border border-white/5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            Refreshed at: {lastUpdated}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={isRefreshing ? 'inline-block animate-spin' : ''}>↻</span>
            {/* {isRefreshing ? 'Refreshing…' : 'Refresh'} */}
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active Patrols" value={stats.active} color="text-brand-400" />
          <StatCard label="Completed Today" value={stats.completedToday} color="text-emerald-400" sub={`of ${stats.totalToday} total`} />
          <StatCard label="Total Sessions" value={stats.totalToday} color="text-white" sub="today" />
          <StatCard label="Emergencies" value={stats.emergencies} color={stats.emergencies > 0 ? 'text-red-400 font-extrabold animate-pulse' : 'text-gray-400'} sub="today" />
        </div>
      )}

      {isLoading && (
        <div className="p-16 text-center text-gray-500">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
          Loading active sessions…
        </div>
      )}

      {error && (
        <div className="card p-6 text-center text-red-400 text-sm">Failed to load active sessions.</div>
      )}

      {!isLoading && sessions?.length === 0 && (
        <div className="card p-16 text-center space-y-2">
          <div className="text-4xl">🟢</div>
          <p className="text-white font-semibold text-lg">No Active Patrols</p>
          <p className="text-gray-500 text-sm">All guards are off-duty or patrols are completed.</p>
        </div>
      )}

      {sessions && sessions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {sessions.map(session => {
            const logs = session.sessionLogs ?? [];
            const lastLog = logs[0];
            const pct = session.completionRate;
            const isExpanded = !!expandedSessionIds[session.id];

            // Filter alert logs
            const emergencyLogs = logs.filter((l: any) => l.severity === 'EMERGENCY');
            const issueLogs = logs.filter((l: any) => l.severity === 'ISSUE_FOUND');
            const hasEmergency = emergencyLogs.length > 0;
            const hasIssue = issueLogs.length > 0;

            return (
              <div
                key={session.id}
                className={`card p-5 space-y-4 transition-all duration-300 ${hasEmergency
                  ? 'border-2 border-red-500/80 bg-red-950/20 shadow-xl shadow-red-950/40 ring-1 ring-red-500/50'
                  : hasIssue
                    ? 'border-2 border-amber-500/70 bg-amber-950/20 shadow-lg shadow-amber-950/30'
                    : 'border border-emerald-500/20 bg-surface-800'
                  }`}
              >
                {/* Guard & Route info header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-600/30 border border-brand-500/30 flex items-center justify-center text-brand-200 font-bold text-sm shrink-0">
                      {session.guard.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-bold text-white leading-snug">{session.guard.name}</p>
                      <p className="text-xs text-gray-400 font-medium">{session.route.name}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {hasEmergency ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-200 bg-red-600/40 px-2.5 py-1 rounded-full border border-red-500/60 animate-pulse shrink-0">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      🚨 EMERGENCY
                    </span>
                  ) : hasIssue ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-200 bg-amber-600/30 px-2.5 py-1 rounded-full border border-amber-500/50 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      ⚠️ ISSUE REPORTED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      LIVE PATROL
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 bg-surface-900/60 p-3 rounded-xl border border-white/5">
                  <div className="flex justify-between text-xs text-gray-400 font-semibold">
                    <span>Progress</span>
                    <span className="text-white">{session.completedCount}/{session.totalCount} checkpoints</span>
                  </div>
                  <div className="w-full h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${hasEmergency ? 'bg-gradient-to-r from-red-600 to-amber-500' : 'bg-gradient-to-r from-brand-500 to-emerald-400'
                        }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-400 font-mono pt-0.5">
                    <span>{Math.round(pct)}% complete</span>
                    <span>Elapsed: {formatDuration(session.startTime)}</span>
                  </div>
                </div>

                {/* 🚨 Emergency Callout Section on main card */}
                {hasEmergency && (
                  <div className="p-3.5 rounded-xl bg-red-600/20 border border-red-500/50 text-red-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-red-300">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm">🚨</span> EMERGENCY AT CHECKPOINT:
                      </span>
                    </div>
                    {emergencyLogs.map((log: any) => (
                      <div key={log.id} className="space-y-1.5 pt-1 border-t border-red-500/20">
                        <div className="flex items-center justify-between font-semibold">
                          <span>📍 {log.checkpoint?.name ?? 'Checkpoint'}</span>
                          <span className="text-[10px] text-red-300/80 font-mono">
                            {new Date(log.scannedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {log.remarks && (
                          <p className="p-2 rounded-lg bg-black/40 text-red-100 font-medium italic border border-red-500/30">
                            "{log.remarks}"
                          </p>
                        )}
                        {log.images && log.images.length > 0 && (
                          <div className="flex gap-2 pt-1">
                            {log.images.map((img: any) => (
                              <button
                                key={img.id}
                                type="button"
                                onClick={() => setPreviewImage(img.imageUrl)}
                                className="relative w-14 h-14 rounded-lg overflow-hidden border border-red-400/50 hover:scale-105 transition-transform"
                              >
                                <img src={img.imageUrl} alt="Emergency Evidence" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ⚠️ Issue Callout Section on main card */}
                {hasIssue && !hasEmergency && (
                  <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm">⚠️</span> ISSUE REPORTED AT:
                      </span>
                    </div>
                    {issueLogs.map((log: any) => (
                      <div key={log.id} className="space-y-1.5 pt-1 border-t border-amber-500/20">
                        <div className="flex items-center justify-between font-semibold">
                          <span>📍 {log.checkpoint?.name ?? 'Checkpoint'}</span>
                          <span className="text-[10px] text-amber-300/80 font-mono">
                            {new Date(log.scannedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {log.remarks && (
                          <p className="p-2 rounded-lg bg-black/30 text-amber-100 italic border border-amber-500/20">
                            "{log.remarks}"
                          </p>
                        )}
                        {log.images && log.images.length > 0 && (
                          <div className="flex gap-2 pt-1">
                            {log.images.map((img: any) => (
                              <button
                                key={img.id}
                                type="button"
                                onClick={() => setPreviewImage(img.imageUrl)}
                                className="relative w-14 h-14 rounded-lg overflow-hidden border border-amber-400/40 hover:scale-105 transition-transform"
                              >
                                <img src={img.imageUrl} alt="Issue Evidence" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Last scan info preview if no emergency/issue banner */}
                {!hasEmergency && !hasIssue && lastLog && (
                  <div className="p-3 rounded-xl bg-surface-900/60 text-xs text-gray-300 space-y-1 border border-white/5">
                    <div className="flex items-center justify-between text-gray-400">
                      <span>Last Scanned Checkpoint:</span>
                      <span className="font-mono text-[10px] text-gray-500">{new Date(lastLog.scannedAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <span>📍</span> {lastLog.checkpoint?.name}
                    </p>
                    {lastLog.remarks && <p className="text-gray-400 italic text-[11px]">"{lastLog.remarks}"</p>}
                  </div>
                )}

                {/* Card Action Controls: Inline Expand + Link */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(session.id)}
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 text-gray-300 hover:text-white"
                  >
                    <span>{isExpanded ? '▲ Hide Details' : `▼ Details (${logs.length} scans)`}</span>
                  </button>
                  <Link
                    to={`/sessions/${session.id}`}
                    className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                  >
                    Full Session Details →
                  </Link>
                </div>

                {/* Expanded Inline Timeline Details */}
                {isExpanded && (
                  <div className="pt-3 space-y-2 border-t border-white/10 animate-fade-in">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Scanned Checkpoints Timeline ({logs.length})
                    </p>
                    {logs.length === 0 ? (
                      <p className="text-xs text-gray-500 italic py-2">No checkpoints scanned yet in this patrol session.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {logs.map((log: any, idx: number) => {
                          const isEmerg = log.severity === 'EMERGENCY';
                          const isIss = log.severity === 'ISSUE_FOUND';
                          return (
                            <div
                              key={log.id || idx}
                              className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${isEmerg
                                ? 'bg-red-950/40 border-red-500/40 text-red-200'
                                : isIss
                                  ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                                  : 'bg-surface-900/60 border-white/5 text-gray-300'
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold flex items-center gap-1.5">
                                  <span>{isEmerg ? '🚨' : isIss ? '⚠️' : '📍'}</span>
                                  {log.checkpoint?.name}
                                </span>
                                <span className="text-[10px] font-mono text-gray-400">
                                  {new Date(log.scannedAt).toLocaleTimeString()}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap text-[10px]">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold ${isEmerg
                                    ? 'bg-red-600/30 text-red-300 border border-red-500/40'
                                    : isIss
                                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    }`}
                                >
                                  {log.severity}
                                </span>

                                <span
                                  className={`px-2 py-0.5 rounded font-semibold ${log.isVerified
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    }`}
                                >
                                  {log.isVerified ? '✓ GPS Verified' : '⚠️ Unverified GPS'}
                                </span>

                                {log.distanceMeters != null && (
                                  <span className="text-gray-400">
                                    {Math.round(log.distanceMeters)}m away
                                  </span>
                                )}
                              </div>

                              {log.remarks && (
                                <p className="text-[11px] italic bg-black/20 p-1.5 rounded text-gray-200">
                                  "{log.remarks}"
                                </p>
                              )}

                              {log.images && log.images.length > 0 && (
                                <div className="flex gap-2 pt-1">
                                  {log.images.map((img: any) => (
                                    <button
                                      key={img.id}
                                      type="button"
                                      onClick={() => setPreviewImage(img.imageUrl)}
                                      className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-brand-500 transition-colors"
                                    >
                                      <img src={img.imageUrl} alt="Log detail" className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-surface-800 rounded-2xl overflow-hidden border border-white/10 p-2 space-y-3">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/60 hover:bg-black/90 rounded-full text-white flex items-center justify-center font-bold text-sm transition-colors"
            >
              ✕
            </button>
            <img src={previewImage} alt="Evidence preview" className="w-full max-h-[80vh] object-contain rounded-xl" />
            <p className="text-center text-xs text-gray-400 font-mono">Tap anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
