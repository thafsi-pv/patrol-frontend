import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../hooks/useAuth';
import { InstallPwaButton } from './InstallPwaButton';

const navItems = [
  { to: '/', label: 'Dashboard', icon: HomeIcon, roles: ['ADMIN', 'GUARD'] as const },
  { to: '/patrol', label: 'Start Patrol', icon: ScanIcon, roles: ['ADMIN', 'GUARD'] as const },
  { to: '/scan', label: 'Quick Scan', icon: ScanIcon, roles: ['ADMIN', 'GUARD'] as const },
  { to: '/monitor', label: 'Live Monitor', icon: ShieldIcon, roles: ['ADMIN'] as const },
  { to: '/routes', label: 'Patrol Routes', icon: MapPinIcon, roles: ['ADMIN'] as const },
  { to: '/sessions', label: 'Session History', icon: ClipboardIcon, roles: ['ADMIN'] as const },
  { to: '/incidents', label: 'Report Issues', icon: AlertIcon, roles: ['ADMIN', 'GUARD'] as const },
  { to: '/checkpoints', label: 'Checkpoints', icon: MapPinIcon, roles: ['ADMIN'] as const },
  { to: '/logs', label: 'Patrol Logs', icon: ClipboardIcon, roles: ['ADMIN'] as const },
  { to: '/users', label: 'Users', icon: UsersIcon, roles: ['ADMIN'] as const },
];


export function Layout() {
  const { user } = useAuthStore();
  const logout = useLogout();

  const visibleNav = navItems.filter((n) => n.roles.includes(user?.role as any));

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-surface-800 border-r border-white/5 p-4">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 px-3 py-2">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50">
            <ShieldIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm">PatrolSystem</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link-active' : 'nav-link')}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="mt-4 border-t border-white/5 pt-4 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role?.toLowerCase()}</p>
            </div>
          </div>
          <InstallPwaButton />
          <button onClick={logout} className="nav-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <LogoutIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface-800 border-b border-white/5 h-14 flex items-center px-4 gap-3">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <ShieldIcon className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-white text-sm flex-1">PatrolSystem</span>
        <InstallPwaButton />
        <button onClick={logout} className="text-gray-400 hover:text-red-400 transition-colors shrink-0">
          <LogoutIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto md:p-8 p-4 pt-20 md:pt-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-800 border-t border-white/5 flex">
        {visibleNav.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                isActive ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

// Inline SVG icon components
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 0h.01M5 8v.01M3 12h.01M5 16H3m2 0h.01M5 16v.01" />
    </svg>
  );
}
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96l-6.96-12.04a2 2 0 00-3.5 0L3.25 16.04A2 2 0 005.07 19z" />
    </svg>
  );
}
function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
