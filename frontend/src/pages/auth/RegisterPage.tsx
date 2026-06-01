import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import Toast from '../../components/Toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nom: '', email: '' });
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.email.trim()) {
      setToast({ message: 'Veuillez remplir tous les champs', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', { nom: form.nom, email: form.email });
      setToast({ message: 'Compte créé ! Vérifiez votre email pour définir votre mot de passe.', type: 'success' });
      setTimeout(() => navigate('/login'), 4000);
    } catch (err: unknown) {
      setToast({ message: formatApiError(err, "Erreur lors de l'inscription"), type: 'error' });
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
            Commencez votre veille stratégique dès aujourd'hui
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            Créez votre compte individuel et accédez à la puissance de l'IA pour surveiller votre secteur.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {['Gratuit', 'Illimité', 'Temps réel'].map(f => (
            <div key={f} className="bg-white/10 rounded-xl p-4">
              <p className="text-white text-sm font-medium">{f}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Créer un compte</h1>
            <p className="text-slate-400 text-sm">Compte individuel — usage personnel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom complet</label>
              <input type="text" value={form.nom}
                onChange={e => setForm({ ...form, nom: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                placeholder="Votre nom" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                placeholder="vous@exemple.com" required />
            </div>
            <p className="text-xs text-slate-500">
              Un email vous sera envoyé pour définir votre mot de passe.
            </p>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition text-sm disabled:opacity-50 mt-2">
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>
          <p className="mt-6 text-center text-slate-400 text-sm">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
