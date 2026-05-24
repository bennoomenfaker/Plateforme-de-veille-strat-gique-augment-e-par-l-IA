import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import { aiEnrichmentService } from '../../services/api';
import type { HypothesisImpact } from '../../types';

const IMPACT_CFG: Record<HypothesisImpact, { label: string; color: string; bg: string }> = {
  OPEN:                { label: 'Ouverte',          color: '#9ca3af', bg: 'rgba(107,114,128,0.1)' },
  PARTIALLY_SUPPORTED: { label: 'Part. supportée',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  SUPPORTED:           { label: 'Supportée',        color: '#34d399', bg: 'rgba(16,185,129,0.1)'  },
  CONTRADICTED:        { label: 'Contredite',       color: '#f87171', bg: 'rgba(239,68,68,0.1)'   },
  NEEDS_MORE_RESEARCH: { label: 'À approfondir',    color: '#a78bfa', bg: 'rgba(139,92,246,0.1)'  },
};

type SentimentFilter = 'TOUS' | 'POSITIF' | 'NEGATIF' | 'NEUTRE';

export default function AnalysePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sentFilter, setSentFilter] = useState<SentimentFilter>('TOUS');
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery({
    queryKey: ['ai-stats', projectId],
    queryFn: () => aiEnrichmentService.getStats(projectId!).then(r => r.data),
    enabled: !!projectId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['enriched-analyse', projectId, page],
    queryFn: () => aiEnrichmentService.getByProject(projectId!, page, 20).then(r => r.data),
    enabled: !!projectId,
  });

  const items = (data?.data ?? []).filter((r: any) =>
    sentFilter === 'TOUS' || r.sentiment?.toUpperCase() === sentFilter
  );

  const sentimentStyle = (s: string) => {
    if (s === 'POSITIF' || s === 'POSITIVE') return { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' };
    if (s === 'NEGATIF' || s === 'NEGATIVE') return { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' };
    return { background: 'rgba(107,114,128,0.1)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.2)' };
  };

  const statCards = [
    { label: 'Total enrichis', value: stats?.total_enriched ?? 0, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', pct: 100 },
    { label: 'Positif', value: (stats?.by_impact as any)?.SUPPORTED ?? 0, color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', pct: stats?.total_enriched ? Math.round(((stats?.by_impact as any)?.SUPPORTED ?? 0) / stats.total_enriched * 100) : 0 },
    { label: 'Contredits', value: (stats?.by_impact as any)?.CONTRADICTED ?? 0, color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', pct: stats?.total_enriched ? Math.round(((stats?.by_impact as any)?.CONTRADICTED ?? 0) / stats.total_enriched * 100) : 0 },
    { label: 'Score moyen', value: `${Math.round((stats?.avg_relevance ?? 0) * 100)}%`, color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)', pct: Math.round((stats?.avg_relevance ?? 0) * 100) },
  ];

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-1">
          <Link to={`/projects/${projectId}`} className="text-xs font-medium" style={{ color: '#6b7280' }}>
            ← Retour au projet
          </Link>
        </div>
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3b82f6' }}>Analyse IA</p>
          <h1 className="text-2xl font-bold text-white">Résultats de la veille</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>{data?.total ?? 0} insight(s) enrichis par l'IA</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {statCards.map(s => (
            <div key={s.label} className="rounded-2xl p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <p className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: s.color, opacity: 0.7 }}>{s.label}</p>
              <div className="w-full rounded-full h-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-1 rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Filtres sentiment */}
        <div className="flex gap-2 mb-5">
          {(['TOUS', 'POSITIF', 'NEGATIF', 'NEUTRE'] as SentimentFilter[]).map(f => (
            <button key={f} onClick={() => { setSentFilter(f); setPage(1); }}
              className="px-4 py-1.5 rounded-xl text-sm font-semibold transition"
              style={sentFilter === f
                ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                : { background: '#161b27', color: '#6b7280', border: '1px solid #1e2535' }}>
              {f === 'TOUS' ? 'Tous' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
          {isLoading ? (
            <div className="py-16 text-center text-sm" style={{ color: '#6b7280' }}>Chargement...</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-white mb-1">Aucun résultat</p>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                {data?.total === 0 ? 'Lancez l\'enrichissement IA depuis la page du projet' : 'Essayez un autre filtre'}
              </p>
            </div>
          ) : (
            items.map((r: any, i: number) => {
              const impact = IMPACT_CFG[r.hypothesis_impact as HypothesisImpact] ?? IMPACT_CFG.OPEN;
              const pct = Math.round((r.relevance_score ?? 0) * 100);
              return (
                <div key={r.id} className="px-6 py-5"
                  style={{ borderBottom: i < items.length - 1 ? '1px solid #1e2535' : 'none' }}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-sm font-semibold text-white leading-snug flex-1">
                      {r.processed_item?.title ?? 'Sans titre'}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: impact.bg, color: impact.color }}>
                        {impact.label}
                      </span>
                      {r.sentiment && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={sentimentStyle(r.sentiment)}>
                          {r.sentiment}
                        </span>
                      )}
                    </div>
                  </div>
                  {r.summary && (
                    <p className="text-xs leading-relaxed mb-3" style={{ color: '#9ca3af' }}>{r.summary}</p>
                  )}
                  {r.answer && (
                    <p className="text-xs leading-relaxed mb-3 italic" style={{ color: '#a5b4fc' }}>
                      Réponse : {r.answer}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full" style={{ background: '#1e2535' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: '#34d399' }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: '#34d399' }}>{pct}% pertinence</span>
                    </div>
                    <p className="text-xs" style={{ color: '#4b5568' }}>
                      {new Date(r.enriched_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {data?.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: '#161b27', color: page === 1 ? '#4b5568' : '#9ca3af', border: '1px solid #1e2535' }}>
              Précédent
            </button>
            <span className="text-sm" style={{ color: '#6b7280' }}>Page {page} / {data.totalPages}</span>
            <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: '#161b27', color: page === data.totalPages ? '#4b5568' : '#9ca3af', border: '1px solid #1e2535' }}>
              Suivant
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
