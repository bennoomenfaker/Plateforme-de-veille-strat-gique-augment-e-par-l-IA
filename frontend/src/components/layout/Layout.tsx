import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { alertsService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { path: '/projects', label: 'Projets', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { path: '/organisation', label: 'Organisation', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { path: '/alertes', label: 'Alertes', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: unreadData } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: () => alertsService.getMyAlerts().then(r => ({ unread: r.data?.data?.filter((a: any) => !a.isRead).length ?? 0 })),
    refetchInterval: 60000,
  });
  const unreadCount = unreadData?.unread ?? 0;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="flex h-screen" style={{ background: '#0f1117' }}>
      <aside className="w-56 flex flex-col border-r shrink-0" style={{ background: '#161b27', borderColor: '#1e2535' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: '#1e2535' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="font-bold text-white text-base tracking-tight">VeilleAI</span>
          </div>
        </div>

        {/* Nav principal */}
        <nav className="px-3 py-3 space-y-0.5">
          <p className="text-xs font-semibold px-3 mb-2 mt-1" style={{ color: '#4b5568' }}>NAVIGATION</p>
          {navItems.map(item => (
            <Link key={item.path} to={item.path}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={isActive(item.path)
                ? { background: 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(99,102,241,0.2))', color: '#60a5fa', borderLeft: '2px solid #3b82f6' }
                : { color: '#6b7280' }
              }>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              <span className="flex-1">{item.label}</span>
              {item.path === '/alertes' && unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center"
                  style={{ background: '#ef4444', color: 'white' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User + logout */}
        <div className="px-3 py-4 border-t" style={{ borderColor: '#1e2535' }}>
          <Link to="/profile"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition hover:bg-white/5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
              {user?.nom?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.nom}</p>
              <p className="text-xs truncate" style={{ color: '#4b5568' }}>{user?.email}</p>
            </div>
          </Link>
          <button onClick={() => { logout(); navigate('/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition"
            style={{ color: '#ef4444' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto" style={{ background: '#0f1117' }}>
        {children}
      </main>
    </div>
  );
}
