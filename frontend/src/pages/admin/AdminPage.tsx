import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type Tab = 'dashboard' | 'users' | 'organisations' | 'logs' | 'pipeline';

export default function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [adminToken, setAdminToken] = useState(localStorage.getItem('admin_token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const isLoggedIn = !!adminToken;

  const adminApi = (url: string) => api.get(url, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.data);

  const { data: dashboard } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminApi('/admin/dashboard'),
    enabled: isLoggedIn && tab === 'dashboard',
  });

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi('/admin/users'),
    enabled: isLoggedIn && tab === 'users',
  });

  const { data: orgs } = useQuery({
    queryKey: ['admin-orgs'],
    queryFn: () => adminApi('/admin/organisations'),
    enabled: isLoggedIn && tab === 'organisations',
  });

  const { data: logs } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => adminApi('/admin/logs'),
    enabled: isLoggedIn && tab === 'logs',
  });

  const { data: pipeline } = useQuery({
    queryKey: ['admin-pipeline'],
    queryFn: () => adminApi('/admin/pipeline'),
    enabled: isLoggedIn && tab === 'pipeline',
  });

  const handleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await api.post('/auth/admin/login', { email, password });
      const token = res.data.access_token;
      localStorage.setItem('admin_token', token);
      setAdminToken(token);
    } catch {
      setLoginError('Email ou mot de passe incorrect');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setAdminToken('');
  };

  const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`, adminHeaders),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const suspendUserMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/suspend`, {}, adminHeaders),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/organisations/${id}`, adminHeaders),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-orgs'] }),
  });

  const sideStyle = { background: '#161b27', border: '1px solid #1e2535' };

  const tabItems: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Vue globale', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
    { key: 'users', label: 'Utilisateurs', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { key: 'organisations', label: 'Organisations', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { key: 'logs', label: 'Logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { key: 'pipeline', label: 'Pipeline ETL', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  ];

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex" style={{ background: '#0f1117' }}>
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-white font-bold text-xl">VeilleAI Admin</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">Panneau d'administration</h2>
            <p className="text-indigo-200 text-sm">Accès réservé aux super administrateurs de la plateforme.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['Gestion utilisateurs', 'Supervision pipeline', 'Logs activités', 'Quotas & facturation'].map(f => (
              <div key={f} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <p className="text-white text-xs font-medium">{f}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white mb-1">Connexion Admin</h1>
              <p className="text-sm" style={{ color: '#6b7280' }}>Accès super administrateur uniquement</p>
            </div>

            {loginError && (
              <div className="rounded-lg p-3 mb-5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                {loginError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#9ca3af' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  style={{ background: '#161b27', border: '1px solid #1e2535' }}
                  placeholder="admin@veille.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#9ca3af' }}>Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  style={{ background: '#161b27', border: '1px solid #1e2535' }}
                  placeholder="••••••••"
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={loginLoading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white mt-2"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', opacity: loginLoading ? 0.5 : 1 }}
              >
                {loginLoading ? 'Connexion...' : 'Accéder au panneau'}
              </button>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full mt-3 py-2 text-sm"
              style={{ color: '#6b7280' }}
            >
              Retour à l'application
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: '#0f1117' }}>
      <aside className="w-56 flex flex-col border-r" style={{ background: '#161b27', borderColor: '#1e2535' }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: '#1e2535' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-white text-sm">Super Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {tabItems.map(item => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-left"
              style={tab === item.key
                ? { background: 'rgba(79,70,229,0.2)', color: '#a5b4fc', borderLeft: '2px solid #6366f1' }
                : { color: '#6b7280' }
              }>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t" style={{ borderColor: '#1e2535' }}>
          <button onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-1"
            style={{ color: '#9ca3af' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Retour app
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ color: '#ef4444' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        {tab === 'dashboard' && dashboard && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6366f1' }}>Administration</p>
            <h1 className="text-2xl font-bold text-white mb-8">Vue globale</h1>
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Utilisateurs', value: dashboard.stats?.totalUsers, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
                { label: 'Organisations', value: dashboard.stats?.totalOrgs, color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
                { label: 'Projets', value: dashboard.stats?.totalProjects, color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
                { label: 'Articles collectés', value: dashboard.stats?.totalRawData, color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <p className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value ?? 0}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: s.color, opacity: 0.7 }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl overflow-hidden" style={sideStyle}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #1e2535' }}>
                <h2 className="text-sm font-bold text-white">Utilisateurs récents</h2>
              </div>
              {dashboard.recentUsers?.map((u: any, i: number) => (
                <div key={u.id} className="px-6 py-3.5 flex items-center justify-between"
                  style={{ borderBottom: i < dashboard.recentUsers.length - 1 ? '1px solid #1e2535' : 'none' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                      {u.nom?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{u.nom}</p>
                      <p className="text-xs" style={{ color: '#6b7280' }}>{u.email}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={u.type_utilisateur === 'INDIVIDUEL'
                      ? { background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }
                      : { background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }
                    }>
                    {u.type_utilisateur}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'users' && users && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6366f1' }}>Administration</p>
            <h1 className="text-2xl font-bold text-white mb-8">Utilisateurs ({users.total})</h1>
            <div className="rounded-2xl overflow-hidden" style={sideStyle}>
              {users.data?.map((u: any, i: number) => (
                <div key={u.id} className="px-6 py-4 flex items-center justify-between"
                  style={{ borderBottom: i < users.data.length - 1 ? '1px solid #1e2535' : 'none' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                      {u.nom?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{u.nom}</p>
                      <p className="text-xs" style={{ color: '#6b7280' }}>{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: '#4b5568' }}>{new Date(u.created_at).toLocaleDateString('fr-FR')}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={u.type_utilisateur === 'INDIVIDUEL'
                        ? { background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }
                        : { background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }
                      }>
                      {u.type_utilisateur}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={u.statut === 'ACTIF'
                        ? { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }
                        : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                      }>
                      {u.statut}
                    </span>
                    <button onClick={async () => { const n = prompt('Nouveau nom', u.nom); if (n) { await api.patch(`/admin/users/${u.id}`, { nom: n }, adminHeaders); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); } }} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>Modifier</button>
                    {u.statut === 'ACTIF' && <button onClick={() => suspendUserMutation.mutate(u.id)} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>Suspendre</button>}
                    <button onClick={() => { if (confirm('Supprimer ?')) deleteUserMutation.mutate(u.id); }} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'organisations' && orgs && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6366f1' }}>Administration</p>
            <h1 className="text-2xl font-bold text-white mb-8">Organisations ({orgs.total})</h1>
            <div className="rounded-2xl overflow-hidden" style={sideStyle}>
              {orgs.data?.map((o: any, i: number) => (
                <div key={o.id} className="px-6 py-4 flex items-center justify-between"
                  style={{ borderBottom: i < orgs.data.length - 1 ? '1px solid #1e2535' : 'none' }}>
                  <div>
                    <p className="text-sm font-semibold text-white">{o.nom}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                      Propriétaire : {o.owner?.nom} · {o.owner?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                      {o._count?.members ?? 0} membre(s)
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
                      {o._count?.projects ?? 0} projet(s)
                    </span>
                    <button
                      onClick={async () => {
                        const n = prompt('Nouveau nom organisation', o.nom);
                        if (n) {
                          await api.patch(`/admin/organisations/${o.id}`, { nom: n }, adminHeaders);
                          queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
                        }
                      }}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Supprimer cette organisation ?')) deleteOrgMutation.mutate(o.id);
                      }}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'logs' && logs && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6366f1' }}>Administration</p>
            <h1 className="text-2xl font-bold text-white mb-8">Logs d'activités</h1>
            <div className="rounded-2xl overflow-hidden" style={sideStyle}>
              {logs.data?.map((l: any, i: number) => (
                <div key={l.id} className="px-6 py-3.5 flex items-center justify-between"
                  style={{ borderBottom: i < logs.data.length - 1 ? '1px solid #1e2535' : 'none' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-1 rounded-lg font-bold"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', fontFamily: 'monospace' }}>
                      {l.action}
                    </span>
                    <div>
                      <p className="text-sm text-white">{l.user?.nom}</p>
                      <p className="text-xs" style={{ color: '#6b7280' }}>{l.user?.email}</p>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: '#4b5568' }}>
                    {new Date(l.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'pipeline' && pipeline && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6366f1' }}>Administration</p>
            <h1 className="text-2xl font-bold text-white mb-8">Pipeline ETL</h1>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Total articles bruts', value: pipeline.pipeline?.totalRawData ?? 0, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
                { label: 'Collectés (24h)', value: pipeline.pipeline?.collectedLast24h ?? 0, color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
                { label: 'Articles analysés', value: pipeline.pipeline?.totalAnalysed ?? 0, color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
                { label: "En attente d'analyse", value: pipeline.pipeline?.pendingAnalysis ?? 0, color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-6" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <p className="text-4xl font-bold mb-2" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-sm font-medium" style={{ color: s.color, opacity: 0.7 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
