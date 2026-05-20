import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';

type Mode = 'CREATE' | 'JOIN';

export default function RegisterOrgPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('CREATE');
  const [form, setForm] = useState({
    nom: '',
    email: '',
    mot_de_passe: '',
    confirm: '',
    nom_organisation: '',
    role: 'EQUIPE_VEILLE' as 'EQUIPE_VEILLE' | 'LECTEUR',
    join_code: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.mot_de_passe !== form.confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, string> = {
        mode,
        nom: form.nom,
        email: form.email,
        mot_de_passe: form.mot_de_passe,
        nom_organisation: form.nom_organisation.trim(),
      };
      if (mode === 'JOIN') {
        payload.role = form.role;
        payload.join_code = form.join_code.trim().toUpperCase();
      }
      const res = await api.post('/auth/register/organisation', payload);
      if (mode === 'CREATE' && res.data?.join_codes) {
        setSuccess(
          `Organisation créée. Codes — Équipe veille: ${res.data.join_codes.equipe_veille} | Lecteur: ${res.data.join_codes.lecteur}`,
        );
        setTimeout(() => navigate('/login'), 5000);
      } else {
        navigate('/login');
      }
    } catch (err: unknown) {
      setError(formatApiError(err, "Erreur lors de l'inscription"));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-500';

  return (
    <div className="min-h-screen bg-slate-950 flex">
        <OrgAside mode={mode} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white mb-1">Compte organisation</h1>
              <p className="text-slate-400 text-sm">Création ou adhésion</p>
            </div>
            <div className="flex gap-2 mb-6 p-1 rounded-lg bg-slate-800">
              <button type="button" onClick={() => setMode('CREATE')} className={`flex-1 py-2 rounded-md text-sm font-semibold ${mode === 'CREATE' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}>Créer</button>
              <button type="button" onClick={() => setMode('JOIN')} className={`flex-1 py-2 rounded-md text-sm font-semibold ${mode === 'JOIN' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}>Rejoindre</button>
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-5 text-sm">{error}</div>}
            {success && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 mb-5 text-sm">{success}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom de l&apos;organisation</label>
                <input type="text" value={form.nom_organisation} onChange={e => setForm({ ...form, nom_organisation: e.target.value })} className={inputClass} placeholder="Ma société" required />
              </div>
              {mode === 'JOIN' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Votre rôle</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'EQUIPE_VEILLE' | 'LECTEUR' })} className={inputClass}>
                      <option value="EQUIPE_VEILLE">Équipe de veille</option>
                      <option value="LECTEUR">Lecteur (consultation seule)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Code confidentiel</label>
                    <input type="text" value={form.join_code} onChange={e => setForm({ ...form, join_code: e.target.value.toUpperCase() })} className={inputClass} placeholder="Code fourni par le propriétaire" required />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Votre nom</label>
                <input type="text" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Mot de passe</label>
                <input type="password" value={form.mot_de_passe} onChange={e => setForm({ ...form, mot_de_passe: e.target.value })} className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmer</label>
                <input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} className={inputClass} required />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50 mt-2">
                {loading ? 'En cours...' : mode === 'CREATE' ? "Créer l'organisation" : "Rejoindre l'organisation"}
              </button>
            </form>
            <p className="mt-6 text-center text-slate-400 text-sm">
              Déjà un compte ? <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">Se connecter</Link>
            </p>
          </div>
        </div>
      </div>
  );
}

function OrgAside({ mode }: { mode: Mode }) {
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 to-indigo-700 flex-col justify-between p-12">
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
          {mode === 'CREATE' ? 'Créer votre organisation' : 'Rejoindre une équipe'}
        </h2>
        <p className="text-violet-100 text-sm leading-relaxed">
          {mode === 'CREATE'
            ? 'Vous serez le seul propriétaire. Partagez les codes confidentiels pour inviter votre équipe.'
            : "Utilisez le nom exact de l'organisation et le code fourni par le propriétaire."}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['Un seul propriétaire', 'Codes par rôle', 'Projets partagés'].map(f => (
          <div key={f} className="bg-white/10 rounded-xl p-4">
            <p className="text-white text-sm font-medium">{f}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
