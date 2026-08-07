import { useState } from 'react';
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
  const { data: sessions, isLoading, error, dataUpdatedAt } = useActiveSessions();
  const { data: stats } = useSessionStats();
  const [, setTick] = useState(0);

  // Re-render every second to update elapsed times
  useState(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  });

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Patrol Monitor</h1>
          <p className="text-gray-500 mt-1 text-sm">Real-time view of all active patrols · Refreshes every 60s</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Last updated: {lastUpdated}
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active Patrols" value={stats.active} color="text-brand-400" />
          <StatCard label="Completed Today" value={stats.completedToday} color="text-emerald-400" sub={`of ${stats.totalToday} total`} />
          <StatCard label="Total Sessions" value={stats.totalToday} color="text-white" sub="today" />
          <StatCard label="Emergencies" value={stats.emergencies} color={stats.emergencies > 0 ? 'text-red-400' : 'text-gray-400'} sub="today" />
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
        <div className="card p-16 text-center">
          <div className="text-4xl mb-4">🟢</div>
          <p className="text-white font-semibold">No Active Patrols</p>
          <p className="text-gray-500 text-sm mt-1">All guards are off-duty or patrols are completed.</p>
        </div>
      )}

      {sessions && sessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sessions.map(session => {
            const lastLog = session.sessionLogs?.[0];
            const pct = session.completionRate;
            return (
              <div key={session.id} className="card p-5 space-y-4 border border-emerald-500/20">
                {/* Guard info */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center text-brand-300 font-bold text-sm">
                      {session.guard.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{session.guard.name}</p>
                      <p className="text-[11px] text-gray-500">{session.route.name}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    🟢 LIVE
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Progress</span>
                    <span className="text-white font-semibold">{session.completedCount}/{session.totalCount}</span>
                  </div>
                  <div className="w-full h-2 bg-surface-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-600">
                    <span>{Math.round(pct)}% complete</span>
                    <span>Elapsed: {formatDuration(session.startTime)}</span>
                  </div>
                </div>

                {/* Last checkpoint */}
                {lastLog && (
                  <div className="p-2 rounded-lg bg-surface-900/60 text-xs text-gray-400">
                    <span className="text-gray-600">Last: </span>
                    <span className="text-gray-200">{lastLog.checkpoint?.name}</span>
                    <span className="text-gray-600 ml-2">{new Date(lastLog.scannedAt ?? '').toLocaleTimeString()}</span>
                  </div>
                )}

                <Link to={`/sessions/${session.id}`} className="block text-center text-xs text-brand-400 hover:text-brand-300 pt-1">
                  View Details →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
