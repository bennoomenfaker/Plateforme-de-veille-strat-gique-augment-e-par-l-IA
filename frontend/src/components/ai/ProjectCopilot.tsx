import { useState } from 'react';
import { aiCopilotService } from '../../services/api';

interface Props {
  mode: 'generate' | 'correct' | 'chat';
  project?: any;
  onGenerated?: (data: any) => void;
  onCorrected?: (data: any) => void;
}

export default function ProjectCopilot({ mode, project, onGenerated, onCorrected }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await aiCopilotService.project({
        mode,
        description: mode === 'generate' ? description : undefined,
        project,
        instruction: mode === 'chat' ? instruction : undefined,
      });
      setResult(res.data);
      if (mode === 'generate' && onGenerated) onGenerated(res.data);
      if (mode !== 'generate' && onCorrected) onCorrected(res.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const renderIssues = () => {
    if (!result?.coherence_report) return null;
    const r = result.coherence_report;
    return (
      <div className="mt-3 space-y-2">
        <div className={`flex items-center gap-2 text-xs font-bold ${r.is_coherent ? 'text-green-400' : 'text-yellow-400'}`}>
          <span>{r.is_coherent ? '✓ Cohérent' : '⚠ Problèmes détectés'}</span>
        </div>
        {r.issues?.length > 0 && (
          <div className="space-y-1">
            {r.issues.map((issue: string, i: number) => (
              <p key={i} className="text-xs" style={{ color: '#f87171' }}>• {issue}</p>
            ))}
          </div>
        )}
        {r.suggestions?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold" style={{ color: '#a78bfa' }}>Suggestions :</p>
            {r.suggestions.map((s: string, i: number) => (
              <p key={i} className="text-xs" style={{ color: '#c4b5fd' }}>• {s}</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const buttonLabel = mode === 'generate' ? 'Générer avec IA' : mode === 'correct' ? 'Vérifier la cohérence' : 'IA Assistant';

  return (
    <div className="rounded-xl" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold"
        style={{ color: '#c4b5fd' }}>
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {buttonLabel}
        </span>
        <svg className={`w-4 h-4 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {mode === 'generate' && (
            <div>
              <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Décrivez le sujet de veille en quelques phrases..."
                className="w-full rounded-xl p-3 text-sm"
                style={{ background: '#0f1117', border: '1px solid #1e2535', color: 'white', resize: 'none' }} />
            </div>
          )}

          {mode === 'chat' && (
            <div>
              <textarea rows={2} value={instruction} onChange={e => setInstruction(e.target.value)}
                placeholder='Ex: "améliore la problématique" ou "rends les hypothèses plus simples"...'
                className="w-full rounded-xl p-3 text-sm"
                style={{ background: '#0f1117', border: '1px solid #1e2535', color: 'white', resize: 'none' }} />
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading || (mode === 'generate' && !description) || (mode === 'chat' && !instruction)}
            className="w-full py-2 rounded-xl text-sm font-bold text-white transition"
            style={{
              background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
              opacity: loading || (mode === 'generate' && !description) || (mode === 'chat' && !instruction) ? 0.5 : 1,
            }}>
            {loading ? 'Traitement...' : buttonLabel}
          </button>

          {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

          {result && mode === 'generate' && (
            <div className="space-y-2 text-xs" style={{ color: '#d1d5db' }}>
              <p><strong style={{ color: '#c4b5fd' }}>Nom :</strong> {result.project_name}</p>
              <p><strong style={{ color: '#c4b5fd' }}>Problématique :</strong> {result.problematique}</p>
              <p><strong style={{ color: '#c4b5fd' }}>Objectif :</strong> {result.objectif}</p>
              <p><strong style={{ color: '#c4b5fd' }}>Axes :</strong> {result.axes?.join(', ')}</p>
              <p><strong style={{ color: '#c4b5fd' }}>Hypothèses :</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                {result.hypotheses?.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
              <p><strong style={{ color: '#c4b5fd' }}>Questions :</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                {result.questions?.map((q: string, i: number) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}

          {result && mode !== 'generate' && (
            <div className="space-y-2 text-xs" style={{ color: '#d1d5db' }}>
              <p><strong style={{ color: '#c4b5fd' }}>Problématique :</strong> {result.problematique}</p>
              <p><strong style={{ color: '#c4b5fd' }}>Objectif :</strong> {result.objectif}</p>
              <p><strong style={{ color: '#c4b5fd' }}>Axes :</strong> {result.axes?.join(', ')}</p>
              <p><strong style={{ color: '#c4b5fd' }}>Hypothèses :</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                {result.hypotheses?.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
              <p><strong style={{ color: '#c4b5fd' }}>Questions :</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                {result.questions?.map((q: string, i: number) => <li key={i}>{q}</li>)}
              </ul>
              {renderIssues()}
            </div>
          )}

          {result && mode === 'generate' && onGenerated && (
            <p className="text-xs text-green-400">✓ Les champs ont été remplis automatiquement</p>
          )}
        </div>
      )}
    </div>
  );
}
