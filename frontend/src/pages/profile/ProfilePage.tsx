import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import { authService } from '../../services/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const [nom, setNom] = useState(user?.nom ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg]     = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    background: '#0f1117', border: '1px solid #1e2535',
    borderRadius: '0.75rem', color: 'white', width: '100%',
    padding: '0.625rem 1rem', fontSize: '0.875rem', outline: 'none',
  };

  const cardStyle: React.CSSProperties = {
    background: '#161b27', border: '1px solid #1e2535',
    borderRadius: '1rem', padding: '1.5rem',
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(''); setError('');
    try {
      await authService.updateProfile({ nom });
      setMsg('Profil mis à jour avec succès');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(''); setError('');
    try {
      await authService.changePassword({ currentPassword, newPassword });
      setMsg('Mot de passe modifié avec succès');
      setCurrentPassword(''); setNewPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erreur lors du changement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: '#3b82f6' }}>Mon compte</p>
          <h1 className="text-2xl font-bold text-white">Profil</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Gérez vos informations personnelles
          </p>
        </div>

        {/* Messages */}
        {msg && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399',
                     border: '1px solid rgba(16,185,129,0.2)' }}>
            ✅ {msg}
          </div>
        )}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171',
                     border: '1px solid rgba(239,68,68,0.2)' }}>
            ❌ {error}
          </div>
        )}

        {/* Avatar + info */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center
                            text-xl font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
              {user?.nom?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold text-lg">{user?.nom}</p>
              <p className="text-sm" style={{ color: '#6b7280' }}>{user?.email}</p>
              <span className="inline-block text-xs px-2.5 py-0.5 rounded-full mt-1"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc',
                         border: '1px solid rgba(99,102,241,0.2)' }}>
                {user?.type_utilisateur}
              </span>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: '#9ca3af' }}>Nom complet</label>
              <input
                style={inputStyle}
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Votre nom"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: '#9ca3af' }}>Email</label>
              <input
                style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }}
                value={user?.email ?? ''}
                disabled
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white transition"
              style={{
                background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                opacity: loading ? 0.6 : 1,
              }}>
              {loading ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </form>
        </div>

        {/* Changer mot de passe */}
        <div style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4" style={{ color: '#6b7280' }} fill="none"
              stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-sm font-bold text-white">Changer le mot de passe</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: '#9ca3af' }}>Mot de passe actuel</label>
              <input
                type="password"
                style={inputStyle}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: '#9ca3af' }}>Nouveau mot de passe</label>
              <input
                type="password"
                style={inputStyle}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white transition"
              style={{
                background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                opacity: (loading || !currentPassword || !newPassword) ? 0.5 : 1,
              }}>
              {loading ? 'Modification...' : 'Modifier le mot de passe'}
            </button>
          </form>
        </div>

      </div>
    </Layout>
  );
}
