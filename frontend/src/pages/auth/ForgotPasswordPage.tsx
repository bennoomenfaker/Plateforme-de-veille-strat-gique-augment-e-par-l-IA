import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setSent] = useState('');
  const [sent, setSentState] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSentState(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#0f1117' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Mot de passe oublié</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Entrez votre email pour recevoir un lien de réinitialisation
          </p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
          {sent ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-white font-semibold mb-2">Email envoyé !</p>
              <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                Vérifiez votre boîte mail pour réinitialiser votre mot de passe.
              </p>
              <Link to="/login"
                className="text-sm font-semibold"
                style={{ color: '#60a5fa' }}>
                ← Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: '#9ca3af' }}>Adresse email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setSent(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full outline-none"
                  style={{
                    background: '#0f1117', border: '1px solid #1e2535',
                    borderRadius: '0.75rem', color: 'white',
                    padding: '0.625rem 1rem', fontSize: '0.875rem',
                  }}
                />
              </div>
              <button type="submit"
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                Envoyer le lien
              </button>
              <div className="text-center pt-2">
                <Link to="/login" className="text-xs" style={{ color: '#6b7280' }}>
                  ← Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
