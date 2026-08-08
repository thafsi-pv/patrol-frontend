import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../hooks/usePatrolSessions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading, error } = useSession(id ?? '');
  const [selectedFailedLog, setSelectedFailedLog] = useState<any>(null);

  const formatDuration = (secs?: number) => {
    if (!secs) return '—';
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  };

  const severityBadge = (s: string) => {
    switch (s) {
      case 'EMERGENCY': return 'bg-red-500/15 text-red-400 border-red-500/20';
      case 'ISSUE_FOUND': return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
      default: return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    }
  };

  const exportPdf = () => {
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
    doc.text(`Completion: ${Math.round(session.completionRate)}%  (${session.completedCount}/${session.totalCount})`, 14, 60);

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

    doc.save(`patrol-report-${id?.slice(0, 8)}.pdf`);
  };

  if (isLoading) return (
    <div className="p-16 text-center text-gray-500">
      <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
      Loading session…
    </div>
  );

  if (error || !session) return (
    <div className="card p-12 text-center text-red-400 text-sm">Session not found.</div>
  );

  const completedIds = new Set(session.sessionLogs?.map((l: any) => l.checkpointId) ?? []);
  const failedAuditLogs: any[] = session.auditLogs ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{session.route?.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {session.guard?.name} · {session.shift ?? '—'} shift · {new Date(session.startTime).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${session.status === 'IN_PROGRESS' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-brand-500/15 text-brand-400 border-brand-500/20'}`}>
            {session.status.replace('_', ' ')}
          </span>
          <button onClick={exportPdf} className="btn-secondary text-xs">
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Completion', value: `${Math.round(session.completionRate)}%`, color: 'text-brand-400' },
          { label: 'Checkpoints', value: `${session.completedCount}/${session.totalCount}`, color: 'text-white' },
          { label: 'Duration', value: formatDuration(session.durationSeconds), color: 'text-emerald-400' },
          { label: 'Out-of-Range Attempts', value: failedAuditLogs.length, color: failedAuditLogs.length > 0 ? 'text-red-400' : 'text-gray-400' },
        ].map(stat => (
          <div key={stat.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Out-of-range attempt banner if present */}
      {failedAuditLogs.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96l-6.96-12.04a2 2 0 00-3.5 0L3.25 16.04A2 2 0 005.07 19z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-200">
                {failedAuditLogs.length} Out-of-Range Scan Attempt{failedAuditLogs.length > 1 ? 's' : ''} Blocked
              </p>
              <p className="text-xs text-red-400/80 mt-0.5">
                The guard attempted to scan one or more checkpoints outside the permitted GPS radius.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedFailedLog(failedAuditLogs[0])}
            className="px-3 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600/40 text-red-200 text-xs font-semibold border border-red-500/30 transition-all flex items-center gap-1.5"
          >
            <span>⚠️ View Error Log</span>
          </button>
        </div>
      )}

      {/* Checkpoint completion map */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Checkpoint Coverage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {session.route?.checkpoints?.map((rc: any, idx: number) => {
            const done = completedIds.has(rc.checkpointId);
            const log = session.sessionLogs?.find((l: any) => l.checkpointId === rc.checkpointId);
            
            // Find if there are out of range attempts for this checkpoint
            const checkpointFailedLogs = failedAuditLogs.filter((al: any) =>
              al.details?.includes(`"${rc.checkpoint?.name}"`) || al.details?.includes(rc.checkpoint?.name)
            );
            const hasFailedAttempt = checkpointFailedLogs.length > 0;

            return (
              <div
                key={rc.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  hasFailedAttempt
                    ? 'border-red-500/40 bg-red-500/10'
                    : done
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-white/5 bg-surface-900/40'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : hasFailedAttempt
                      ? 'bg-red-500 text-white'
                      : 'bg-surface-700 text-gray-500'
                  }`}
                >
                  {hasFailedAttempt ? '!' : done ? '✓' : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm font-medium truncate ${hasFailedAttempt ? 'text-red-200' : done ? 'text-emerald-200' : 'text-gray-500'}`}>
                      {rc.checkpoint?.name}
                    </p>
                  </div>
                  {log && <p className="text-[11px] text-gray-600">{new Date(log.scannedAt).toLocaleTimeString()} · {Math.round(log.distanceMeters ?? 0)}m</p>}
                  {!log && hasFailedAttempt && (
                    <p className="text-[11px] text-red-400/80 font-medium">Scan attempted out of range</p>
                  )}
                </div>

                {hasFailedAttempt && (
                  <button
                    onClick={() => setSelectedFailedLog(checkpointFailedLogs[0])}
                    className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[10px] font-bold flex items-center gap-1 shrink-0"
                    title="View out-of-range scan error details"
                  >
                    <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96l-6.96-12.04a2 2 0 00-3.5 0L3.25 16.04A2 2 0 005.07 19z" />
                    </svg>
                    Error Log
                  </button>
                )}

                {log && !hasFailedAttempt && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${severityBadge(log.severity)}`}>
                    {log.severity.replace('_', ' ')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scan log timeline */}
      {session.sessionLogs && session.sessionLogs.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Scan Timeline</h2>
          <div className="space-y-4">
            {session.sessionLogs.map((log: any, i: number) => (
              <div key={log.id} className="flex gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${log.isVerified ? 'bg-emerald-500 text-white' : 'bg-amber-500/30 text-amber-300'}`}>
                    {i + 1}
                  </div>
                  {i < session.sessionLogs.length - 1 && <div className="w-px flex-1 bg-white/5" />}
                </div>
                <div className="pb-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{log.checkpoint?.name}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${severityBadge(log.severity)}`}>
                      {log.severity.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(log.scannedAt).toLocaleTimeString()}
                    {log.distanceMeters != null && ` · ${Math.round(log.distanceMeters)}m from checkpoint`}
                    {log.gpsAccuracyMeters != null && ` · GPS ±${Math.round(log.gpsAccuracyMeters)}m`}
                  </p>
                  {log.remarks && <p className="text-xs text-gray-400 mt-1 italic">"{log.remarks}"</p>}
                  {log.scannedLatitude && (
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      Guard location: {log.scannedLatitude.toFixed(6)}, {log.scannedLongitude.toFixed(6)}
                    </p>
                  )}
                  {log.images && log.images.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {log.images.map((img: any, j: number) => (
                        <a key={img.id ?? j} href={img.imageUrl} target="_blank" rel="noreferrer">
                          <img src={img.imageUrl} className="w-16 h-16 rounded-lg object-cover border border-white/10 hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Out of Range Error Log Modal */}
      {selectedFailedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-lg w-full p-6 border-red-500/40 bg-surface-900 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedFailedLog(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96l-6.96-12.04a2 2 0 00-3.5 0L3.25 16.04A2 2 0 005.07 19z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Out-of-Range Scan Log</h3>
                <p className="text-xs text-red-400">Blocked Attempt Audit Record</p>
              </div>
            </div>

            <div className="space-y-3 bg-surface-950 p-4 rounded-xl border border-white/10 text-xs">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-400">Action:</span>
                <span className="text-red-300 font-mono font-bold">{selectedFailedLog.action}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-400">Timestamp:</span>
                <span className="text-gray-200 font-medium">{new Date(selectedFailedLog.createdAt).toLocaleString()}</span>
              </div>
              {selectedFailedLog.ipAddress && (
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-400">IP Address:</span>
                  <span className="text-gray-300 font-mono">{selectedFailedLog.ipAddress}</span>
                </div>
              )}
              {selectedFailedLog.deviceId && (
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-400">Device ID:</span>
                  <span className="text-gray-300 font-mono">{selectedFailedLog.deviceId}</span>
                </div>
              )}
              <div className="space-y-1 pt-1">
                <span className="text-gray-400 block">Details:</span>
                <p className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 leading-relaxed font-mono">
                  {selectedFailedLog.details}
                </p>
              </div>
            </div>

            {/* List all failed logs in session if multiple */}
            {failedAuditLogs.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400">All Out-of-Range Attempts in this Session:</p>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {failedAuditLogs.map((al: any) => (
                    <button
                      key={al.id}
                      onClick={() => setSelectedFailedLog(al)}
                      className={`w-full text-left p-2 rounded-lg text-xs font-mono border transition-all ${
                        al.id === selectedFailedLog.id
                          ? 'bg-red-500/20 border-red-500/40 text-red-200 font-semibold'
                          : 'bg-surface-800/60 border-white/5 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {new Date(al.createdAt).toLocaleTimeString()} - {al.details?.slice(0, 50)}...
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedFailedLog(null)}
              className="btn-primary w-full py-2.5"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
