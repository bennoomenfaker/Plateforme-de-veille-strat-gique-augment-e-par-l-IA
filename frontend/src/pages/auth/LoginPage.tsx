import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { formatApiError } from '../../services/api';
import Toast from '../../components/Toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', mot_de_passe: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.mot_de_passe.trim()) {
      setToast({ message: 'Veuillez remplir tous les champs', type: 'error' });
      return;
    }
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
      if (msg === 'Email non trouvé') setToast({ message: 'Email inexistant', type: 'error' });
      else if (msg === 'Mot de passe incorrect') setToast({ message: 'Mot de passe incorrect', type: 'error' });
      else if (msg === 'Compte suspendu') setToast({ message: 'Votre compte a été suspendu', type: 'error' });
      else if (msg === 'Compte inactif') setToast({ message: 'Votre compte est inactif', type: 'error' });
      else setToast({ message: formatApiError(err, 'Email ou mot de passe incorrect'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const closeToast = useCallback(() => setToast(null), []);

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => { setForm({ ...form, email: e.target.value }); setToast(null); }}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                placeholder="vous@exemple.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.mot_de_passe}
                  onChange={e => { setForm({ ...form, mot_de_passe: e.target.value }); setToast(null); }}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="text-right">
              <Link to="/forgot-password" className="text-sm text-slate-400 hover:text-blue-400 transition">
                Mot de passe oublié ?
              </Link>
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
