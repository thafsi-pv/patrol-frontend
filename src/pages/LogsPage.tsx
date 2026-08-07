import { useState } from 'react';
import { usePatrolLogs, type LogsFilter, type PatrolStatus } from '../hooks/usePatrolLogs';
import { useCheckpoints } from '../hooks/useCheckpoints';
import { useUsers } from '../hooks/useUsers';
import { StatusBadge } from '../components/StatusBadge';

const STATUS_OPTIONS: PatrolStatus[] = ['SUCCESS', 'OUT_OF_RANGE', 'UNKNOWN_QR', 'FLAGGED'];

export function LogsPage() {
  const [filters, setFilters] = useState<LogsFilter>({ page: 1, limit: 25 });

  const { data: logsData, isLoading } = usePatrolLogs(filters);
  const { data: checkpoints } = useCheckpoints();
  const { data: users } = useUsers();

  const setFilter = <K extends keyof LogsFilter>(key: K, value: LogsFilter[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => setFilters({ page: 1, limit: 25 });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Patrol Logs</h1>
        <p className="text-gray-500 mt-1">
          All scan attempts — successes, failures, and flagged entries.
        </p>
      </div>

      {/* GPS disclaimer */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
        <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-amber-300/80">
          GPS-based verification. Flagged entries indicate anomalies (impossible travel, suspicious accuracy, or device mismatch) and warrant manual review. This system does not guarantee GPS cannot be spoofed.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <select
          className="input text-sm col-span-1"
          value={filters.checkpointId ?? ''}
          onChange={(e) => setFilter('checkpointId', e.target.value || undefined)}
        >
          <option value="">All checkpoints</option>
          {checkpoints?.map((cp) => (
            <option key={cp.id} value={cp.id}>{cp.name}</option>
          ))}
        </select>

        <select
          className="input text-sm col-span-1"
          value={filters.guardId ?? ''}
          onChange={(e) => setFilter('guardId', e.target.value || undefined)}
        >
          <option value="">All guards</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <select
          className="input text-sm col-span-1"
          value={filters.status ?? ''}
          onChange={(e) => setFilter('status', (e.target.value as PatrolStatus) || undefined)}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>

        <div className="col-span-1">
          <input
            type="date"
            className="input text-sm"
            value={filters.from ? filters.from.split('T')[0] : ''}
            onChange={(e) => setFilter('from', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          />
        </div>

        <div className="col-span-2 md:col-span-4 lg:col-span-1 flex gap-2">
          <input
            type="date"
            className="input text-sm flex-1"
            value={filters.to ? filters.to.split('T')[0] : ''}
            onChange={(e) => setFilter('to', e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : undefined)}
          />
          <button onClick={clearFilters} className="btn-secondary px-3" title="Clear filters">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-600">
            <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
            Loading logs…
          </div>
        ) : !logsData?.data.length ? (
          <div className="p-16 text-center text-gray-600">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No logs found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Checkpoint</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Guard</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Distance</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Scanned Location</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">GPS Accuracy</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Flag Reason</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logsData.data.map((log) => (
                  <tr
                    key={log.id}
                    className={`table-row-hover ${log.status === 'FLAGGED' ? 'bg-purple-500/5 border-l-2 border-l-purple-500/40' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-300">
                      {log.checkpoint?.name ?? (
                        <span className="text-gray-600 italic">Unknown</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-gray-300">{log.guard?.name ?? '—'}</p>
                      <p className="text-xs text-gray-600">{log.guard?.email}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-gray-400">
                      {log.distanceMeters != null ? `${Math.round(log.distanceMeters)}m` : '—'}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-xs font-mono text-gray-400">
                      {log.scannedLatitude != null && log.scannedLongitude != null ? (
                        <span>{log.scannedLatitude.toFixed(6)}, {log.scannedLongitude.toFixed(6)}</span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-gray-400">
                      {log.gpsAccuracyMeters != null ? `±${Math.round(log.gpsAccuracyMeters)}m` : '—'}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {log.flagReason ? (
                        <span className="text-xs text-purple-400 font-mono">
                          {log.flagReason.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {logsData && logsData.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            {logsData.total} entries · Page {logsData.page} of {logsData.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('page', (filters.page ?? 1) - 1)}
              disabled={(filters.page ?? 1) <= 1}
              className="btn-secondary px-3 py-2 text-xs"
            >
              ← Prev
            </button>
            <button
              onClick={() => setFilter('page', (filters.page ?? 1) + 1)}
              disabled={(filters.page ?? 1) >= logsData.totalPages}
              className="btn-secondary px-3 py-2 text-xs"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
