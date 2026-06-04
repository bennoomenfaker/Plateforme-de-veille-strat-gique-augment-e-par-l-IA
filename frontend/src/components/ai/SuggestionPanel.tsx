import { useState, useCallback } from 'react';
import api from '../../services/api';

interface Props {
  prompt: string;
  label?: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export default function SuggestionPanel({ prompt, label = 'Suggestions IA', onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [error, setError] = useState('');

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/ai-copilot/suggest', { prompt });
      const data = res.data?.suggestions;
      if (data?.options && Array.isArray(data.options)) {
        setOptions(data.options);
      } else if (data?.raw) {
        setOptions([data.raw]);
      } else {
        setOptions(['Aucune suggestion générée']);
      }
      setOpen(true);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erreur de génération');
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  return (
    <div className="mb-4">
      <button type="button" onClick={fetchSuggestions} disabled={loading || disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
        style={{
          background: loading ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.15)',
          color: loading ? '#a78bfa' : '#c4b5fd',
          border: '1px solid rgba(139,92,246,0.25)',
          opacity: loading || disabled ? 0.5 : 1,
        }}>
        {loading ? (
          <>
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Génération...
          </>
        ) : (
          <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>{label}</>
        )}
      </button>

      {error && <p className="mt-1.5 text-xs" style={{ color: '#f87171' }}>{error}</p>}

      {open && options.length > 0 && !loading && (
        <div className="mt-2 rounded-xl p-2" style={{ background: '#0f1117', border: '1px solid rgba(139,92,246,0.2)' }}>
          <div className="flex flex-wrap gap-1.5">
            {options.map((opt, i) => (
              <button key={i} type="button" onClick={() => { onSelect(opt); setOpen(false); setOptions([]); }}
                className="text-xs px-2.5 py-1.5 rounded-lg text-left transition hover:scale-105"
                style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.2)' }}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
