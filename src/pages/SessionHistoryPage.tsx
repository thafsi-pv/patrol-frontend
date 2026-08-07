import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessions } from '../hooks/usePatrolSessions';

export function SessionHistoryPage() {
  const [filters, setFilters] = useState({ status: '', shift: '', from: '', to: '', page: 1 });
  const { data, isLoading, error } = useSessions(filters);

  const sessions: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages: number = data?.totalPages ?? 1;

  const statusBadge = (s: string) => {
    switch (s) {
      case 'IN_PROGRESS': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
      case 'COMPLETED': return 'bg-brand-500/15 text-brand-400 border-brand-500/20';
      default: return 'bg-gray-500/15 text-gray-400 border-gray-500/20';
    }
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return '—';
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Session History</h1>
          <p className="text-gray-500 mt-1 text-sm">{total} sessions found</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <select className="input text-sm col-span-1" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}>
          <option value="">All Status</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <select className="input text-sm col-span-1" value={filters.shift} onChange={e => setFilters(f => ({ ...f, shift: e.target.value, page: 1 }))}>
          <option value="">All Shifts</option>
          <option value="Morning">Morning</option>
          <option value="Evening">Evening</option>
          <option value="Night">Night</option>
        </select>
        <div className="col-span-1">
          <input type="date" className="input text-sm w-full" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value, page: 1 }))} placeholder="From" />
        </div>
        <div className="col-span-1">
          <input type="date" className="input text-sm w-full" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value, page: 1 }))} placeholder="To" />
        </div>
        <button onClick={() => setFilters({ status: '', shift: '', from: '', to: '', page: 1 })} className="btn-secondary text-xs col-span-2 md:col-span-1">
          Clear Filters
        </button>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-gray-500">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
          Loading sessions…
        </div>
      )}
      {error && <div className="card p-6 text-center text-red-400 text-sm">Failed to load sessions.</div>}

      {!isLoading && sessions.length === 0 && (
        <div className="card p-16 text-center text-gray-500 text-sm">No sessions found.</div>
      )}

      {sessions.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/5">
                <tr className="text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Guard</th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">Shift</th>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">Completion</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sessions.map((s: any) => (
                  <tr key={s.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{s.guard?.name}</td>
                    <td className="px-4 py-3 text-gray-300">{s.route?.name}</td>
                    <td className="px-4 py-3 text-gray-400">{s.shift ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(s.startTime).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-400">{formatDuration(s.durationSeconds)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-surface-900 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${s.completionRate}%` }} />
                        </div>
                        <span className="text-xs text-gray-300">{Math.round(s.completionRate)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(s.status)}`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/sessions/${s.id}`} className="text-brand-400 hover:text-brand-300 text-xs font-medium">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button key={page} onClick={() => setFilters(f => ({ ...f, page }))}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${filters.page === page ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
