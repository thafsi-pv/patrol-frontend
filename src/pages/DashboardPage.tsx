import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useDashboardStats } from '../hooks/usePatrolLogs';
import { usePatrolLogs } from '../hooks/usePatrolLogs';
import { StatusBadge } from '../components/StatusBadge';

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="card p-6 flex items-center gap-4 hover:border-white/10 transition-colors">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: myLogs } = usePatrolLogs(
    isAdmin ? { limit: 10 } : { guardId: user?.id, limit: 10 }
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 mt-1">
          {isAdmin ? 'Admin overview — all system activity at a glance.' : 'Ready to start your patrol?'}
        </p>
      </div>

      {/* Guard CTA */}
      {!isAdmin && (
        <Link
          to="/scan"
          id="btn-scan-cta"
          className="block card p-6 border-brand-500/30 bg-gradient-to-br from-brand-600/20 to-brand-800/10 hover:from-brand-600/30 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50 group-hover:scale-105 transition-transform">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 0h.01M5 8v.01M3 12h.01M5 16H3m2 0h.01M5 16v.01" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-white">Scan Checkpoint</p>
              <p className="text-sm text-gray-400">Tap to open camera and scan a QR code</p>
            </div>
            <svg className="w-5 h-5 text-gray-500 ml-auto group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Admin stats */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Checkpoints"
            value={statsLoading ? '—' : stats?.totalCheckpoints ?? 0}
            color="bg-brand-600/20 text-brand-400"
            icon={<MapPinIcon />}
          />
          <StatCard
            label="Scans Today"
            value={statsLoading ? '—' : stats?.scansToday ?? 0}
            color="bg-emerald-500/20 text-emerald-400"
            icon={<ScanIcon />}
          />
          <StatCard
            label="Flagged Today"
            value={statsLoading ? '—' : stats?.flaggedToday ?? 0}
            color="bg-purple-500/20 text-purple-400"
            icon={<FlagIcon />}
          />
          <StatCard
            label="Guards"
            value={statsLoading ? '—' : stats?.totalGuards ?? 0}
            color="bg-amber-500/20 text-amber-400"
            icon={<UsersIcon />}
          />
        </div>
      )}

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            {isAdmin ? 'Recent Activity' : 'Your Recent Scans'}
          </h2>
          {isAdmin && (
            <Link to="/logs" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              View all →
            </Link>
          )}
        </div>

        <div className="card overflow-hidden">
          {!myLogs || myLogs.data.length === 0 ? (
            <div className="p-12 text-center text-gray-600">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">No patrol activity yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {myLogs.data.map((log) => (
                <div key={log.id} className="px-5 py-3.5 flex items-center gap-4 table-row-hover">
                  <StatusBadge status={log.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {log.checkpoint?.name ?? 'Unknown QR'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isAdmin ? `${log.guard?.name} · ` : ''}
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {log.distanceMeters != null && (
                    <span className="text-xs text-gray-500 shrink-0">
                      {Math.round(log.distanceMeters)}m
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MapPinIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function ScanIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 0h.01M5 8v.01M3 12h.01M5 16H3m2 0h.01M5 16v.01" /></svg>;
}
function FlagIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>;
}
function UsersIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
}
