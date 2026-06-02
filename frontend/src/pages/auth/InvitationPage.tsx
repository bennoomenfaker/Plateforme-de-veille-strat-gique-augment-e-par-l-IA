import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function InvitationPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nom: '', mot_de_passe: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (!token) return;
    api
      .get(`/auth/invitation/${token}/verify`)
      .then((res) => {
        if (res.data.userExists) {
          return api.post(`/auth/invitation/${token}/accept`);
        }
        setOrgName(res.data.nom_organisation);
        setChecking(false);
      })
      .then((acceptRes) => {
        if (acceptRes) {
          setOrgName(acceptRes.data.organisation);
          setAccepted(true);
          setTimeout(() => navigate('/login'), 3000);
        }
      })
      .catch((err) => {
        setError(
          err.response?.data?.message || 'Token invalide ou expiré',
        );
        setChecking(false);
      });
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.mot_de_passe !== form.confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register/invitation', {
        token,
        nom: form.nom,
        mot_de_passe: form.mot_de_passe,
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Token invalide ou expiré');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto" />
          <p className="text-gray-500 mt-4">Vérification de votre invitation...</p>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Invitation acceptée !
          </h1>
          <p className="text-gray-600 mb-2">
            Bienvenue dans la collaboration{' '}
            <span className="font-semibold text-teal-700">{orgName}</span>.
          </p>
          <p className="text-sm text-gray-400">
            Redirection vers la connexion...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">✉️</div>
          <h1 className="text-2xl font-bold text-gray-800">Rejoindre l'organisation</h1>
          <p className="text-gray-500 mt-1">
            {orgName ? (
              <>Vous êtes invité à rejoindre <span className="font-semibold">{orgName}</span></>
            ) : (
              'Complétez votre profil pour accepter l\'invitation'
            )}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Votre nom</label>
            <input
              type="text"
              value={form.nom}
              onChange={e => setForm({ ...form, nom: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Votre nom"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input
              type="password"
              value={form.mot_de_passe}
              onChange={e => setForm({ ...form, mot_de_passe: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer mot de passe</label>
            <input
              type="password"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Validation...' : 'Rejoindre l\'organisation'}
          </button>
        </form>
      </div>
    </div>
  );
}
