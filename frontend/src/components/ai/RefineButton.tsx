import { useState } from 'react';
import api from '../../services/api';

interface Props {
  hypothesis?: string;
  question?: string;
  onHypothesisRefined: (value: string) => void;
  onQuestionRefined: (value: string) => void;
}

export default function RefineButton({ hypothesis, question, onHypothesisRefined, onQuestionRefined }: Props) {
  const [loading, setLoading] = useState(false);

  const handleRefine = async () => {
    setLoading(true);
    try {
      const res = await api.post('/ai-copilot/refine', {
        hypotheses: hypothesis ? [hypothesis] : [],
        questions: question ? [question] : [],
      });
      const corrected = res.data;
      if (corrected.hypotheses_corrigees?.length) {
        onHypothesisRefined(corrected.hypotheses_corrigees[0]);
      }
      if (corrected.questions_corrigees?.length) {
        onQuestionRefined(corrected.questions_corrigees[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleRefine} disabled={loading}
      className="p-1.5 rounded-lg transition shrink-0"
      style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}
      title="Améliorer avec l'IA">
      <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {loading ? (
          <>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </>
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        )}
      </svg>
    </button>
  );
}
