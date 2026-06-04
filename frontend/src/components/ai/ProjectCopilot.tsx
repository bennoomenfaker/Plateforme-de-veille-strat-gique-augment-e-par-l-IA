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

  const renderField = (label: string, value: string | undefined) => {
    if (!value) return null;
    return <p><strong style={{ color: '#c4b5fd' }}>{label} :</strong> {value}</p>;
  };

  const renderList = (label: string, items: any[] | undefined) => {
    if (!items || items.length === 0) return null;
    return (
      <div>
        <p><strong style={{ color: '#c4b5fd' }}>{label} :</strong></p>
        <ul className="list-disc pl-4 space-y-0.5">
          {items.map((item: any, i: number) => (
            <li key={i}>{typeof item === 'string' ? item : item.content || item.name || item.question || JSON.stringify(item)}</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderCoherenceReport = () => {
    if (!result?.coherence_report) return null;
    if (result.error) return null;
    const r = result.coherence_report;

    const hasIssues = r.issues?.length > 0;
    const hasSuggestions = r.suggestions?.length > 0;
    const hasCorrections = r.corrections?.length > 0;

    if (!hasIssues && !hasSuggestions && !hasCorrections) return null;

    return (
      <div className="mt-3 p-3 rounded-xl space-y-3"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
        <div className="flex items-center gap-2 text-xs font-bold text-yellow-400">
          <span>{r.is_coherent ? '✓ Cohérent' : '⚠ Problèmes détectés'}</span>
        </div>

        {hasIssues && (
          <div className="space-y-1">
            <p className="text-xs font-semibold" style={{ color: '#fbbf24' }}>Problèmes :</p>
            {r.issues.map((issue: string, i: number) => (
              <p key={i} className="text-xs" style={{ color: '#f87171' }}>• {issue}</p>
            ))}
          </div>
        )}

        {hasCorrections && (
          <div className="space-y-1">
            <p className="text-xs font-semibold" style={{ color: '#34d399' }}>Corrections proposées :</p>
            {r.corrections.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.05)' }}>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  c.type === 'remove' ? 'text-red-400 bg-red-400/10' : 'text-blue-400 bg-blue-400/10'
                }`}>
                  {c.type === 'remove' ? 'SUPPR' : c.type === 'replace' ? 'REMPL' : 'MODIF'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: '#d1d5db' }}>
                    {c.element} {c.index ? `#${c.index}` : ''}
                  </p>
                  {c.original && (
                    <p className="text-xs line-through" style={{ color: '#6b7280' }}>{c.original}</p>
                  )}
                  <p className="text-xs" style={{ color: '#34d399' }}>{c.correction}</p>
                  {c.raison && (
                    <p className="text-xs mt-0.5" style={{ color: '#fbbf24' }}>→ {c.raison}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {hasSuggestions && (
          <div className="space-y-1">
            <p className="text-xs font-semibold" style={{ color: '#a78bfa' }}>Suggestions :</p>
            {r.suggestions.map((s: any, i: number) => (
              <p key={i} className="text-xs" style={{ color: '#c4b5fd' }}>
                • {typeof s === 'string' ? s : s.suggestion || s.correction || s.message || JSON.stringify(s)}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const hasContent = (data: any) => {
    if (!data) return false;
    return data.problematique || data.objectif || data.objectives?.length > 0 ||
      data.axes?.length > 0 || data.hypotheses?.length > 0 || data.questions?.length > 0;
  };

  const hasCorrections = (data: any) => {
    return data?.coherence_report?.corrections?.length > 0;
  };

  const hasIssues = (data: any) => {
    return data?.coherence_report?.issues?.length > 0;
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

          {result && mode === 'generate' && hasContent(result) && (
            <div className="space-y-2 text-xs" style={{ color: '#d1d5db' }}>
              {renderField('Nom', result.project_name)}
              {renderField('Problématique', result.problematique)}
              {renderField('Objectif', result.objectif)}
              {renderList('Objectifs', result.objectives)}
              {renderList('Axes', result.axes)}
              {renderList('Hypothèses', result.hypotheses)}
              {renderList('Questions', result.questions)}
            </div>
          )}

          {result && mode !== 'generate' && (
            <div className="space-y-2 text-xs" style={{ color: '#d1d5db' }}>
              {result.error ? (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="font-semibold" style={{ color: '#f87171' }}>Erreur : {result.error}</p>
                  {result.raw && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer" style={{ color: '#9ca3af' }}>Voir la réponse brute</summary>
                      <pre className="mt-1 p-2 rounded text-xs whitespace-pre-wrap" style={{ background: '#0f1117', color: '#9ca3af', maxHeight: '200px', overflow: 'auto' }}>{result.raw}</pre>
                    </details>
                  )}
                </div>
              ) : (
                <>
                  {renderField('Problématique', result.problematique)}
                  {renderField('Objectif', result.objectif)}
                  {renderList('Objectifs', result.objectives)}
                  {renderList('Axes', result.axes)}
                  {renderList('Hypothèses', result.hypotheses)}
                  {renderList('Questions', result.questions)}
                  {renderCoherenceReport()}

                  {!hasContent(result) && !hasCorrections(result) && hasIssues(result) && (
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                      <p style={{ color: '#fbbf24' }}>
                        ⚠ Des problèmes ont été détectés mais aucune correction automatique n'a été générée. 
                        Utilisez le panneau "IA Assistant" pour demander une modification spécifique.
                      </p>
                    </div>
                  )}
                </>
              )}
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
