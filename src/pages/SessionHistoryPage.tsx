import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessions } from '../hooks/usePatrolSessions';
import { useRoutes } from '../hooks/usePatrolSessions';
import { useUsers } from '../hooks/useUsers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatDuration(secs?: number) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

export function SessionHistoryPage() {
  const [filters, setFilters] = useState({
    guardId: '',
    routeId: '',
    status: '',
    shift: '',
    severityFilter: 'ALL', // 'ALL' | 'EMERGENCY' | 'ISSUE_FOUND' | 'NORMAL'
    from: '',
    to: '',
    page: 1,
  });

  const { data: routes } = useRoutes();
  const { data: users } = useUsers();
  const { data, isLoading, error } = useSessions({
    guardId: filters.guardId || undefined,
    routeId: filters.routeId || undefined,
    status: filters.status || undefined,
    shift: filters.shift || undefined,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(filters.to + 'T23:59:59').toISOString() : undefined,
    page: filters.page,
  });

  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ imageUrl: string; mediaType: string } | null>(null);

  const rawSessions: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages: number = data?.totalPages ?? 1;

  // Filter by severity locally if selected
  const sessions = rawSessions.filter((s: any) => {
    if (filters.severityFilter === 'ALL') return true;
    const logs = s.sessionLogs ?? [];
    if (filters.severityFilter === 'EMERGENCY') return logs.some((l: any) => l.severity === 'EMERGENCY');
    if (filters.severityFilter === 'ISSUE_FOUND') return logs.some((l: any) => l.severity === 'ISSUE_FOUND');
    if (filters.severityFilter === 'NORMAL') return logs.every((l: any) => l.severity === 'NORMAL');
    return true;
  });

  const exportPdf = (session: any) => {
    if (!session) return;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Patrol Session Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Guard: ${session.guard?.name}`, 14, 30);
    doc.text(`Route: ${session.route?.name}`, 14, 36);
    doc.text(`Shift: ${session.shift ?? '—'}`, 14, 42);
    doc.text(`Started: ${new Date(session.startTime).toLocaleString()}`, 14, 48);
    doc.text(`Duration: ${formatDuration(session.durationSeconds)}`, 14, 54);
    doc.text(`Completion: ${Math.round(session.completionRate)}% (${session.completedCount}/${session.totalCount})`, 14, 60);

    const rows = (session.sessionLogs ?? []).map((log: any) => [
      new Date(log.scannedAt).toLocaleString(),
      log.checkpoint?.name ?? '—',
      log.isVerified ? 'VERIFIED' : 'UNVERIFIED',
      log.severity,
      log.distanceMeters ? `${Math.round(log.distanceMeters)}m` : '—',
      log.remarks ?? '',
    ]);

    autoTable(doc, {
      startY: 68,
      head: [['Time', 'Checkpoint', 'Verified', 'Status', 'Distance', 'Remarks']],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`patrol-report-${session.id.slice(0, 8)}.pdf`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Patrol History</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Grouped patrol sessions with route, guard, taken time, and incident reports.
          </p>
        </div>
        <div className="text-xs text-gray-400 font-mono bg-surface-800 px-3 py-1.5 rounded-full border border-white/5">
          {total} total patrol sessions
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {/* Guard */}
        <select
          className="input text-xs"
          value={filters.guardId}
          onChange={(e) => setFilters((f) => ({ ...f, guardId: e.target.value, page: 1 }))}
        >
          <option value="">All Guards</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        {/* Route */}
        <select
          className="input text-xs"
          value={filters.routeId}
          onChange={(e) => setFilters((f) => ({ ...f, routeId: e.target.value, page: 1 }))}
        >
          <option value="">All Routes</option>
          {routes?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {/* Shift */}
        <select
          className="input text-xs"
          value={filters.shift}
          onChange={(e) => setFilters((f) => ({ ...f, shift: e.target.value, page: 1 }))}
        >
          <option value="">All Shifts</option>
          <option value="Morning">Morning</option>
          <option value="Evening">Evening</option>
          <option value="Night">Night</option>
        </select>

        {/* Health / Incident Severity */}
        <select
          className="input text-xs"
          value={filters.severityFilter}
          onChange={(e) => setFilters((f) => ({ ...f, severityFilter: e.target.value, page: 1 }))}
        >
          <option value="ALL">All Incidents</option>
          <option value="EMERGENCY">🚨 Emergency</option>
          <option value="ISSUE_FOUND">⚠️ Issue Found</option>
          <option value="NORMAL">✅ Normal Only</option>
        </select>

        {/* From Date */}
        <input
          type="date"
          className="input text-xs"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value, page: 1 }))}
        />

        {/* To Date & Reset */}
        <div className="flex gap-2">
          <input
            type="date"
            className="input text-xs flex-1 min-w-0"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value, page: 1 }))}
          />
          <button
            onClick={() =>
              setFilters({
                guardId: '',
                routeId: '',
                status: '',
                shift: '',
                severityFilter: 'ALL',
                from: '',
                to: '',
                page: 1,
              })
            }
            className="btn-secondary px-3 text-xs shrink-0"
            title="Reset Filters"
          >
            ✕
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="p-16 text-center text-gray-500">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
          Loading patrol history…
        </div>
      )}

      {error && <div className="card p-6 text-center text-red-400 text-sm">Failed to load patrol history.</div>}

      {!isLoading && sessions.length === 0 && (
        <div className="card p-16 text-center space-y-2">
          <div className="text-4xl">📋</div>
          <p className="text-white font-semibold text-lg">No Patrol Sessions Found</p>
          <p className="text-gray-500 text-sm">No patrols match your selected filter criteria.</p>
        </div>
      )}

      {/* Grouped Patrol Cards Grid */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sessions.map((s: any) => {
            const logs = s.sessionLogs ?? [];
            const emergencyLogs = logs.filter((l: any) => l.severity === 'EMERGENCY');
            const issueLogs = logs.filter((l: any) => l.severity === 'ISSUE_FOUND');
            const hasEmergency = emergencyLogs.length > 0;
            const hasIssue = issueLogs.length > 0;
            const isCompleted = s.status === 'COMPLETED';

            return (
              <div
                key={s.id}
                onClick={() => setSelectedSession(s)}
                className={`card p-5 space-y-4 cursor-pointer hover:scale-[1.01] transition-all duration-200 ${
                  hasEmergency
                    ? 'border-2 border-red-500/70 bg-red-950/20 shadow-lg shadow-red-950/30'
                    : hasIssue
                    ? 'border-2 border-amber-500/60 bg-amber-950/20 shadow-md shadow-amber-950/20'
                    : 'border border-white/5 hover:border-brand-500/30 bg-surface-800'
                }`}
              >
                {/* Header: Guard & Route */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-600/30 border border-brand-500/30 flex items-center justify-center text-brand-200 font-bold text-sm shrink-0">
                      {s.guard?.name?.[0]?.toUpperCase() ?? 'G'}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-snug">{s.route?.name}</h3>
                      <p className="text-xs text-gray-400 font-medium">
                        By <span className="text-gray-200 font-semibold">{s.guard?.name}</span> · {s.shift ? `${s.shift} Shift` : 'Standard'}
                      </p>
                    </div>
                  </div>

                  {/* Severity Badge */}
                  {hasEmergency ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-600/30 text-red-300 border border-red-500/50 shrink-0 flex items-center gap-1">
                      🚨 EMERGENCY
                    </span>
                  ) : hasIssue ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-600/30 text-amber-300 border border-amber-500/50 shrink-0 flex items-center gap-1">
                      ⚠️ ISSUE
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                      ✅ NORMAL
                    </span>
                  )}
                </div>

                {/* Duration & Time stats */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-surface-900/60 p-3 rounded-xl border border-white/5">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-semibold">Taken Time / Duration</p>
                    <p className="text-white font-mono font-bold mt-0.5">{formatDuration(s.durationSeconds)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-semibold">Started At</p>
                    <p className="text-gray-300 font-mono text-[11px] mt-0.5">
                      {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(s.startTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Completion Coverage</span>
                    <span className="text-white font-bold">
                      {s.completedCount}/{s.totalCount} ({Math.round(s.completionRate)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        hasEmergency
                          ? 'bg-gradient-to-r from-red-600 to-amber-500'
                          : isCompleted
                          ? 'bg-gradient-to-r from-brand-600 to-emerald-400'
                          : 'bg-gradient-to-r from-brand-600 to-amber-400'
                      }`}
                      style={{ width: `${s.completionRate}%` }}
                    />
                  </div>
                </div>

                {/* Emergency / Issue Alert snippet preview on main card */}
                {hasEmergency && emergencyLogs[0] && (
                  <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-200 space-y-1">
                    <p className="font-bold text-red-300">🚨 Emergency at: {emergencyLogs[0].checkpoint?.name}</p>
                    {emergencyLogs[0].remarks && <p className="italic text-[11px]">"{emergencyLogs[0].remarks}"</p>}
                  </div>
                )}

                {hasIssue && !hasEmergency && issueLogs[0] && (
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                    <p className="font-bold text-amber-300">⚠️ Issue at: {issueLogs[0].checkpoint?.name}</p>
                    {issueLogs[0].remarks && <p className="italic text-[11px]">"{issueLogs[0].remarks}"</p>}
                  </div>
                )}

                {/* Footer Action */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-mono text-[11px]">{logs.length} scanned checkpoints</span>
                  <span className="text-brand-400 font-semibold group-hover:text-brand-300 flex items-center gap-1">
                    View Full Details →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-400 pt-4">
          <p>
            Page {filters.page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
              disabled={filters.page <= 1}
              className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              onClick={() => setFilters((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))}
              disabled={filters.page >= totalPages}
              className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ─── FULL DETAILS MODAL ─── */}
      {selectedSession && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={() => setSelectedSession(null)}
        >
          <div
            className="card w-full max-w-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-xs text-brand-400 font-bold uppercase tracking-wider">Patrol Details</span>
                <h2 className="text-xl font-bold text-white mt-0.5">{selectedSession.route?.name}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Guarded by <span className="text-gray-200 font-semibold">{selectedSession.guard?.name}</span> ({selectedSession.guard?.email})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportPdf(selectedSession)} className="btn-secondary text-xs py-1.5 px-3">
                  📄 Export PDF
                </button>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="w-8 h-8 rounded-full bg-surface-700 text-gray-400 hover:text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Session Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-surface-900/60 border border-white/5">
                <p className="text-lg font-bold text-brand-400">{Math.round(selectedSession.completionRate)}%</p>
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Completion</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-900/60 border border-white/5">
                <p className="text-lg font-bold text-white">
                  {selectedSession.completedCount}/{selectedSession.totalCount}
                </p>
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Checkpoints</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-900/60 border border-white/5">
                <p className="text-lg font-bold text-emerald-400">{formatDuration(selectedSession.durationSeconds)}</p>
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Taken Time</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-900/60 border border-white/5">
                <p className="text-lg font-bold text-amber-400">
                  {(selectedSession.sessionLogs ?? []).filter((l: any) => l.severity !== 'NORMAL').length}
                </p>
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Incidents</p>
              </div>
            </div>

            {/* Checkpoint Coverage Checklist */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Checkpoint Coverage</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedSession.route?.checkpoints?.map((rc: any, idx: number) => {
                  const log = (selectedSession.sessionLogs ?? []).find((l: any) => l.checkpointId === rc.checkpointId);
                  const isDone = !!log;
                  return (
                    <div
                      key={rc.id || idx}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs ${
                        isDone
                          ? log.severity === 'EMERGENCY'
                            ? 'bg-red-950/30 border-red-500/30 text-red-200'
                            : log.severity === 'ISSUE_FOUND'
                            ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          : 'bg-surface-900/40 border-white/5 text-gray-500'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isDone
                            ? log.severity === 'EMERGENCY'
                              ? 'bg-red-600 text-white'
                              : log.severity === 'ISSUE_FOUND'
                              ? 'bg-amber-600 text-white'
                              : 'bg-emerald-500 text-white'
                            : 'bg-surface-700 text-gray-500'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{rc.checkpoint?.name}</p>
                        {log && (
                          <p className="text-[10px] opacity-70">
                            {new Date(log.scannedAt).toLocaleTimeString()} · {Math.round(log.distanceMeters ?? 0)}m
                          </p>
                        )}
                      </div>
                      {isDone && (
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-black/30">
                          {log.severity}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Timeline */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                Full Scan Timeline ({selectedSession.sessionLogs?.length ?? 0})
              </h3>
              {(!selectedSession.sessionLogs || selectedSession.sessionLogs.length === 0) ? (
                <p className="text-xs text-gray-500 italic">No checkpoint scans logged for this session.</p>
              ) : (
                <div className="space-y-3">
                  {selectedSession.sessionLogs.map((log: any, idx: number) => {
                    const isEmerg = log.severity === 'EMERGENCY';
                    const isIss = log.severity === 'ISSUE_FOUND';
                    return (
                      <div
                        key={log.id || idx}
                        className={`p-3 rounded-xl border text-xs space-y-2 ${
                          isEmerg
                            ? 'bg-red-950/30 border-red-500/40 text-red-200'
                            : isIss
                            ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                            : 'bg-surface-900/60 border-white/5 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1.5">
                            <span>{isEmerg ? '🚨' : isIss ? '⚠️' : '📍'}</span>
                            {log.checkpoint?.name}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">
                            {new Date(log.scannedAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              isEmerg
                                ? 'bg-red-600/30 text-red-300 border border-red-500/40'
                                : isIss
                                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {log.severity}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              log.isVerified
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {log.isVerified ? '✓ GPS Verified' : '⚠️ Unverified GPS'}
                          </span>

                          {log.distanceMeters != null && (
                            <span className="text-gray-400">{Math.round(log.distanceMeters)}m from checkpoint</span>
                          )}
                        </div>

                        {log.remarks && (
                          <p className="p-2 rounded bg-black/30 italic text-gray-200">"{log.remarks}"</p>
                        )}

                        {log.images && log.images.length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            {/* Audio clips first inline */}
                            {log.images.filter((img: any) => img.mediaType === 'AUDIO').map((img: any) => (
                              <div key={img.id} className="bg-surface-900/80 p-2 rounded-xl border border-white/5 flex items-center gap-2 max-w-xs">
                                <span className="text-base shrink-0">🎙️</span>
                                <audio src={img.imageUrl} controls className="flex-1 h-8 max-w-full" />
                              </div>
                            ))}

                            {/* Image & Video grids */}
                            {log.images.filter((img: any) => img.mediaType !== 'AUDIO').length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {log.images.filter((img: any) => img.mediaType !== 'AUDIO').map((img: any) => {
                                  const isVideo = img.mediaType === 'VIDEO';
                                  const isFile = img.mediaType === 'FILE';
                                  return (
                                    <button
                                      key={img.id}
                                      type="button"
                                      onClick={() => setPreviewMedia({ imageUrl: img.imageUrl, mediaType: img.mediaType || 'IMAGE' })}
                                      className="group relative w-16 h-16 rounded-lg overflow-hidden bg-surface-900 border border-white/10 hover:border-brand-500 transition-all flex items-center justify-center"
                                    >
                                      {isVideo ? (
                                        <>
                                          <video src={img.imageUrl} className="w-full h-full object-cover opacity-75" />
                                          <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white text-[10px]">▶</div>
                                          </div>
                                        </>
                                      ) : isFile ? (
                                        <div className="flex flex-col items-center justify-center text-center p-1">
                                          <span className="text-lg">📎</span>
                                          <span className="text-[7px] text-gray-400 mt-0.5 truncate w-12">File</span>
                                        </div>
                                      ) : (
                                        <img
                                          src={img.imageUrl}
                                          alt="Evidence"
                                          className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                                        />
                                      )}
                                    </button>
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
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-between items-center">
              <Link
                to={`/sessions/${selectedSession.id}`}
                className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
              >
                Open Full Permalink →
              </Link>
              <button onClick={() => setSelectedSession(null)} className="btn-secondary text-xs py-1.5 px-4">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Media Preview Modal */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-surface-800 rounded-2xl overflow-hidden border border-white/10 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewMedia(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/60 hover:bg-black/90 rounded-full text-white flex items-center justify-center font-bold text-sm transition-colors"
            >
              ✕
            </button>
            <h3 className="text-sm font-semibold text-white">Evidence Attachment</h3>
            <div className="flex justify-center items-center max-h-[70vh]">
              {previewMedia.mediaType === 'AUDIO' ? (
                <div className="py-12 px-6 flex flex-col items-center gap-4 bg-surface-900 rounded-xl w-full max-w-md border border-white/5">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-3xl">
                    🎙️
                  </div>
                  <audio src={previewMedia.imageUrl} controls autoPlay className="w-full" />
                  <p className="text-xs text-gray-400">Voice Recording / Audio Note</p>
                </div>
              ) : previewMedia.mediaType === 'VIDEO' ? (
                <video src={previewMedia.imageUrl} controls autoPlay className="w-full max-h-[60vh] rounded-lg bg-black" />
              ) : previewMedia.mediaType === 'FILE' ? (
                <div className="py-12 px-6 flex flex-col items-center gap-4 bg-surface-900 rounded-xl w-full max-w-md border border-white/5 text-center">
                  <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-400 text-3xl">
                    📎
                  </div>
                  <p className="text-sm font-medium text-white">Document Attachment</p>
                  <a
                    href={previewMedia.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary text-xs px-4 py-2"
                  >
                    Download File
                  </a>
                </div>
              ) : (
                <img src={previewMedia.imageUrl} alt="Evidence Preview" className="max-w-full max-h-[60vh] object-contain rounded-lg" />
              )}
            </div>
            <p className="text-center text-[10px] text-gray-500">Click outer area to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
