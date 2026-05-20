import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { formatApiError } from '../../services/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', mot_de_passe: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.access_token, res.data.refresh_token, res.data.user);
      navigate('/home');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      if (msg === 'Compte suspendu') setError('Votre compte a été suspendu');
      else if (msg === 'Compte inactif') setError('Votre compte est inactif');
      else setError(formatApiError(err, 'Email ou mot de passe incorrect'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl">VeilleAI</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Plateforme de veille stratégique augmentée par l'IA
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            Collectez, analysez et visualisez les informations clés de votre secteur en temps réel.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {['Collecte RSS', 'Analyse IA', 'Alertes temps réel'].map(f => (
            <div key={f} className="bg-white/10 rounded-xl p-4">
              <p className="text-white text-sm font-medium">{f}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Connexion</h1>
            <p className="text-slate-400 text-sm">Accédez à votre espace de veille</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                placeholder="vous@exemple.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Mot de passe</label>
              <input
                type="password"
                value={form.mot_de_passe}
                onChange={e => setForm({ ...form, mot_de_passe: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition text-sm disabled:opacity-50 mt-2"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            <p className="text-slate-400 text-sm">
              Pas de compte ?{' '}
              <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
                Créer un compte individuel
              </Link>
            </p>
            <p>
              <Link to="/register/organisation" className="text-slate-400 text-sm hover:text-slate-300">
                Créer un compte organisation
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
