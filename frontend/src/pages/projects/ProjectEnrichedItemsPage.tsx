import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import { aiEnrichmentService, processingService } from '../../services/api';
import type { EnrichedItem, HypothesisImpact, AiEnrichmentStats } from '../../types';

// ─── Config impact ────────────────────────────────────────────────────────────

const IMPACT_CFG: Record<HypothesisImpact, {
  label: string; color: string; bg: string; border: string; icon: string;
}> = {
  OPEN:                { label: 'Ouverte',           color: '#9ca3af', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)', icon: '○' },
  PARTIALLY_SUPPORTED: { label: 'Part. supportée',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)',  icon: '◑' },
  SUPPORTED:           { label: 'Supportée',         color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: '●' },
  CONTRADICTED:        { label: 'Contredite',        color: '#f87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)',  icon: '✕' },
  NEEDS_MORE_RESEARCH: { label: 'À approfondir',     color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)', icon: '?' },
};

const SENTIMENT_COLORS: Record<string, { color: string; bg: string; emoji: string }> = {
  POSITIVE: { color: '#34d399', bg: 'rgba(16,185,129,0.1)',  emoji: '😊' },
  POSITIF:  { color: '#34d399', bg: 'rgba(16,185,129,0.1)',  emoji: '😊' },
  NEGATIVE: { color: '#f87171', bg: 'rgba(239,68,68,0.1)',   emoji: '😟' },
  NEGATIF:  { color: '#f87171', bg: 'rgba(239,68,68,0.1)',   emoji: '😟' },
  NEUTRAL:  { color: '#9ca3af', bg: 'rgba(107,114,128,0.1)', emoji: '😐' },
  NEUTRE:   { color: '#9ca3af', bg: 'rgba(107,114,128,0.1)', emoji: '😐' },
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: HypothesisImpact }) {
  const c = IMPACT_CFG[impact] ?? IMPACT_CFG.OPEN;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.icon} {c.label}
    </span>
  );
}

function ScoreBar({ value, color, label }: { value: number; color: string; label?: string }) {
  const pct = Math.min(100, Math.round((value ?? 0) * 100));
  return (
    <div>
      {label && <p className="text-[10px] font-semibold mb-1" style={{ color: '#6b7280' }}>{label}</p>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1e2535' }}>
          <div className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-xs font-bold w-8 text-right" style={{ color }}>{pct}%</span>
      </div>
    </div>
  );
}

// ─── Modal détail ─────────────────────────────────────────────────────────────

function EnrichedItemModal({ item, onClose }: { item: EnrichedItem; onClose: () => void }) {
  const sentKey = item.sentiment?.toUpperCase() ?? '';
  const sent    = SENTIMENT_COLORS[sentKey];

  const toArray = (data: unknown): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data.map(String);
    if (typeof data === 'object') return Object.values(data as Record<string, unknown>).flat().map(String);
    return [String(data)];
  };

  const entities = toArray(item.entities);
  const topics   = toArray(item.topics);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#161b27', border: '1px solid #1e2535',
          borderRadius: '1.25rem', maxWidth: '700px', width: '100%',
          maxHeight: '85vh', overflow: 'auto',
        }}>

        {/* Header modal */}
        <div className="px-6 py-5 flex items-start justify-between"
          style={{ background: 'linear-gradient(135deg,#4c1d95,#6d28d9)',
                   borderRadius: '1.25rem 1.25rem 0 0' }}>
          <div className="flex-1 pr-4">
            <p className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: 'rgba(255,255,255,0.5)' }}>Insight IA</p>
            <h2 className="text-base font-bold text-white leading-snug">
              {item.processed_item?.title ?? 'Sans titre'}
            </h2>
          </div>
          <button onClick={onClose} className="text-2xl leading-none"
            style={{ color: 'rgba(255,255,255,0.6)' }}>×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <ImpactBadge impact={item.hypothesis_impact} />
            {item.sentiment && sent && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                style={{ background: sent.bg, color: sent.color, border: `1px solid ${sent.color}40` }}>
                {sent.emoji} {item.sentiment}
              </span>
            )}
            {item.model_used && (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc',
                         border: '1px solid rgba(99,102,241,0.2)' }}>
                {item.model_used}
              </span>
            )}
          </div>

          {/* Scores */}
          <div className="grid grid-cols-2 gap-4">
            <div style={{ background: '#0f1117', borderRadius: '0.75rem', padding: '1rem' }}>
              <ScoreBar value={item.relevance_score ?? 0} color="#34d399" label="Pertinence" />
            </div>
            <div style={{ background: '#0f1117', borderRadius: '0.75rem', padding: '1rem' }}>
              <ScoreBar value={item.confidence_score ?? 0} color="#60a5fa" label="Confiance" />
            </div>
          </div>

          {/* Résumé */}
          {item.summary && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: '#6b7280' }}>Résumé automatique</p>
              <div style={{ background: '#0f1117', borderRadius: '0.75rem', padding: '1rem' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#d1d5db' }}>{item.summary}</p>
              </div>
            </div>
          )}

          {/* Réponse */}
          {item.answer && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: '#6b7280' }}>Réponse au plan de collecte</p>
              <div style={{ background: 'rgba(99,102,241,0.05)',
                            border: '1px solid rgba(99,102,241,0.2)',
                            borderRadius: '0.75rem', padding: '1rem' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#c7d2fe' }}>{item.answer}</p>
              </div>
            </div>
          )}

          {/* Entités + Topics */}
          {(entities.length > 0 || topics.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {entities.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2"
                    style={{ color: '#6b7280' }}>Entités</p>
                  <div className="flex flex-wrap gap-1.5">
                    {entities.slice(0, 10).map((e, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-lg"
                        style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
                                 border: '1px solid rgba(251,191,36,0.2)' }}>
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {topics.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2"
                    style={{ color: '#6b7280' }}>Thèmes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {topics.slice(0, 10).map((t, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-lg"
                        style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                                 border: '1px solid rgba(59,130,246,0.2)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Méta */}
          <div className="grid grid-cols-2 gap-y-1.5 text-xs pt-4"
            style={{ color: '#6b7280', borderTop: '1px solid #1e2535' }}>
            <span>Enrichi : {item.enriched_at
              ? new Date(item.enriched_at).toLocaleDateString('fr-FR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
              : '—'}</span>
            <span>Prompt v{item.prompt_version ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ProjectEnrichedItemsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [page, setPage]           = useState(1);
  const [notification, setNotification] = useState<{type:'success'|'error'; msg:string}|null>(null);
  const [impactFilter, setImpact] = useState('');
  const [selectedItem, setSelected] = useState<EnrichedItem | null>(null);
  const LIMIT = 20;

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: stats } = useQuery<AiEnrichmentStats>({
    queryKey: ['ai-stats', projectId],
    queryFn:  () => aiEnrichmentService.getStats(projectId!).then(r => r.data),
    enabled:  !!projectId,
  });

  const { data: procStats } = useQuery({
    queryKey: ['processing-stats', projectId],
    queryFn:  () => processingService.getStats(projectId!).then(r => r.data),
    enabled:  !!projectId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['enriched-items', projectId, page, impactFilter],
    queryFn:  () =>
      aiEnrichmentService.getByProject(
        projectId!, page, LIMIT, undefined, impactFilter || undefined,
      ).then(r => r.data),
    enabled: !!projectId,
  });

  // ── Mutation ───────────────────────────────────────────────────────────────

  const enrichMut = useMutation({
    mutationFn: () => aiEnrichmentService.enrichProject(projectId!),
    onSuccess: async (res) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['enriched-items',    projectId] }),
        queryClient.invalidateQueries({ queryKey: ['ai-stats',          projectId] }),
      ]);
      const d = res.data;
      alert(`Enrichissement terminé !\n${d.processed ?? 0} traités · ${d.skipped ?? 0} ignorés · ${d.failed ?? 0} erreurs`);
    },
    onError: (err: any) => {
      setNotification({type:'error', msg:`Erreur : ${err?.response?.data?.message || err.message}`});
      setTimeout(() => setNotification(null), 5000);
    },
  });

  // ── Données ────────────────────────────────────────────────────────────────

  const items: EnrichedItem[] = data?.data ?? [];
  const isRunning = enrichMut.isPending;

  const cardStyle: React.CSSProperties = {
    background: '#161b27', border: '1px solid #1e2535', borderRadius: '1rem',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">

        {/* Notification */}
        {notification && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
            style={notification.type === 'success'
              ? {background:'rgba(16,185,129,0.1)', color:'#34d399', border:'1px solid rgba(16,185,129,0.2)'}
              : {background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)'}}>
            {notification.msg}
          </div>
        )}

        {/* Breadcrumb */}
        <div className="mb-1">
          <Link to={`/projects/${projectId}`} className="text-xs font-medium"
            style={{ color: '#6b7280' }}>
            ← Retour au projet
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">Enrichissement IA</h1>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa',
                         border: '1px solid rgba(139,92,246,0.2)' }}>
                Sprint 5
              </span>
            </div>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              Résumé automatique · Scoring de pertinence · Évaluation des hypothèses
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to={`/projects/${projectId}/insights`}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                       border: '1px solid rgba(59,130,246,0.2)' }}>
              📊 Dashboard insights
            </Link>
            <button
              onClick={() => enrichMut.mutate()}
              disabled={isRunning}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{
                background: isRunning ? '#1e2535' : 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                color:  isRunning ? '#6b7280' : 'white',
                cursor: isRunning ? 'not-allowed' : 'pointer',
              }}>
              {isRunning ? 'Analyse en cours...' : '🧠 Lancer l\'enrichissement IA'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Items enrichis', value: stats?.total_enriched ?? 0,
              sub: `sur ${procStats?.total_processed ?? 0} nettoyés`, color: '#a78bfa' },
            { label: 'Score moyen',
              value: `${Math.round((stats?.avg_relevance ?? 0) * 100)}%`,
              sub: 'pertinence', color: '#34d399' },
            { label: 'Confiance moy.',
              value: `${Math.round((stats?.avg_confidence ?? 0) * 100)}%`,
              sub: 'fiabilité IA', color: '#60a5fa' },
            { label: 'Modèle IA', value: stats?.model_used ?? 'Mistral',
              sub: 'LLM local', color: '#fbbf24' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#161b27', border: '1px solid #1e2535',
                                   borderRadius: '1rem', padding: '1.25rem' }}>
              <p className="text-xs mb-1" style={{ color: '#6b7280' }}>{s.label}</p>
              <p className="text-2xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px]" style={{ color: '#4b5568' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Filtres impact */}
        {stats?.by_impact && (
          <div style={{ ...cardStyle, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: '#4b5568' }}>
              Filtrer par impact — cliquez pour filtrer
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setImpact(''); setPage(1); }}
                className="text-xs px-3 py-1.5 rounded-xl transition"
                style={impactFilter === ''
                  ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                  : { background: '#0f1117', color: '#6b7280', border: '1px solid #1e2535' }}>
                Tous ({stats.total_enriched ?? 0})
              </button>
              {(Object.entries(IMPACT_CFG) as [HypothesisImpact, typeof IMPACT_CFG[HypothesisImpact]][])
                .map(([key, cfg]) => {
                  const count    = (stats.by_impact as Record<string, number>)?.[key] ?? 0;
                  const isActive = impactFilter === key;
                  return (
                    <button key={key}
                      onClick={() => { setImpact(isActive ? '' : key); setPage(1); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition"
                      style={{
                        background: isActive ? cfg.bg : '#0f1117',
                        border:     `1px solid ${isActive ? cfg.border : '#1e2535'}`,
                        color:      isActive ? cfg.color : '#6b7280',
                      }}>
                      <span>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                      <span className="font-bold" style={{ color: cfg.color }}>({count})</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Liste items */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>

          {/* Header tableau */}
          <div className="grid px-5 py-3 text-[10px] font-bold uppercase tracking-widest"
            style={{
              gridTemplateColumns: '1fr 165px 110px 110px 50px',
              color: '#4b5568', borderBottom: '1px solid #1e2535', background: '#0f1117',
            }}>
            <span>Titre / Résumé</span>
            <span>Impact hypothèse</span>
            <span>Pertinence</span>
            <span>Confiance</span>
            <span>Sent.</span>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-sm" style={{ color: '#6b7280' }}>
              Chargement...
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3">🧠</p>
              <p className="text-sm font-medium text-white mb-1">
                {impactFilter ? 'Aucun résultat pour ce filtre' : 'Aucun insight IA disponible'}
              </p>
              <p className="text-xs mb-5" style={{ color: '#6b7280' }}>
                {!impactFilter && 'Lancez l\'enrichissement pour analyser vos données nettoyées'}
              </p>
              {!impactFilter && (
                <button
                  onClick={() => enrichMut.mutate()}
                  disabled={isRunning}
                  className="text-sm font-semibold px-5 py-2 rounded-xl text-white"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>
                  Lancer l'enrichissement IA
                </button>
              )}
            </div>
          ) : (
            <>
              {items.map((item) => {
                const sentKey = item.sentiment?.toUpperCase() ?? '';
                const sent    = SENTIMENT_COLORS[sentKey];
                const title   = item.processed_item?.title ?? 'Sans titre';
                const summary = item.summary ?? item.answer ?? 'Aucun résumé';
                return (
                  <div key={item.id}
                    onClick={() => setSelected(item)}
                    className="grid px-5 py-4 items-center cursor-pointer hover:bg-white/5 transition"
                    style={{
                      gridTemplateColumns: '1fr 165px 110px 110px 50px',
                      borderBottom: '1px solid #1e2535',
                    }}>
                    <div className="min-w-0 pr-4">
                      <p className="text-sm font-semibold text-white line-clamp-1 mb-1">{title}</p>
                      <p className="text-xs line-clamp-2" style={{ color: '#6b7280' }}>{summary}</p>
                    </div>
                    <div><ImpactBadge impact={item.hypothesis_impact} /></div>
                    <div><ScoreBar value={item.relevance_score ?? 0} color="#34d399" /></div>
                    <div><ScoreBar value={item.confidence_score ?? 0} color="#60a5fa" /></div>
                    <div className="text-lg text-center">
                      {sent?.emoji ?? '—'}
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {data?.totalPages > 1 && (
                <div className="px-5 py-4 flex items-center justify-between"
                  style={{ borderTop: '1px solid #1e2535' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: '#0f1117', border: '1px solid #1e2535',
                             color: page === 1 ? '#4b5568' : '#60a5fa' }}>
                    Précédent
                  </button>
                  <span className="text-xs" style={{ color: '#6b7280' }}>
                    Page {data.page} / {data.totalPages} · {data.total} insights
                  </span>
                  <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: '#0f1117', border: '1px solid #1e2535',
                             color: page === data.totalPages ? '#4b5568' : '#60a5fa' }}>
                    Suivant
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {selectedItem && (
        <EnrichedItemModal item={selectedItem} onClose={() => setSelected(null)} />
      )}
    </Layout>
  );
}
