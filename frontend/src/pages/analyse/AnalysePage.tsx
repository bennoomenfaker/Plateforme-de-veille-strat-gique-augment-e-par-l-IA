import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import Layout from '../../components/layout/Layout';
import { analyseService, reportsService } from '../../services/api';
import type { HypothesisImpact } from '../../types';

const IMPACT_CFG: Record<HypothesisImpact, { label: string; color: string }> = {
  OPEN:                { label: 'Ouverte',           color: '#9ca3af' },
  PARTIALLY_SUPPORTED: { label: 'Part. supportée',   color: '#fbbf24' },
  SUPPORTED:           { label: 'Supportée',         color: '#34d399' },
  CONTRADICTED:        { label: 'Contredite',        color: '#f87171' },
  NEEDS_MORE_RESEARCH: { label: 'À approfondir',     color: '#a78bfa' },
};

const TOOLTIP_STYLE = {
  background: '#1e2535', border: '1px solid #374151',
  borderRadius: '0.5rem', color: '#e5e7eb', fontSize: '0.75rem',
};

type SentimentFilter = 'TOUS' | 'POSITIF' | 'NEGATIF' | 'NEUTRE';

export default function AnalysePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sentFilter, setSentFilter] = useState<SentimentFilter>('TOUS');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'insights' | 'hypotheses' | 'entities'>('insights');
  const [exporting, setExporting] = useState(false);

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['analyse-dashboard', projectId],
    queryFn: () => analyseService.getDashboard(projectId!).then(r => r.data),
    enabled: !!projectId,
  });

  const { data: stats } = useQuery({
    queryKey: ['analyse-stats', projectId],
    queryFn: () => analyseService.getStats(projectId!).then(r => r.data),
    enabled: !!projectId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['enriched-analyse', projectId, page, sentFilter],
    queryFn: () =>
      analyseService.getResults(
        projectId!,
        page,
        20,
        sentFilter === 'TOUS' ? undefined : sentFilter,
      ).then(r => r.data),
    enabled: !!projectId,
  });

  const items = data?.data ?? [];
  const overview = dashboard?.overview;

  const sentimentPie = [
    { name: 'Positif', value: stats?.POSITIF ?? dashboard?.sentiments?.POSITIF ?? 0, color: '#34d399' },
    { name: 'Négatif', value: stats?.NEGATIF ?? dashboard?.sentiments?.NEGATIF ?? 0, color: '#f87171' },
    { name: 'Neutre', value: stats?.NEUTRE ?? dashboard?.sentiments?.NEUTRE ?? 0, color: '#9ca3af' },
  ].filter(d => d.value > 0);

  const impactBar = Object.entries(IMPACT_CFG).map(([key, cfg]) => ({
    name: cfg.label,
    count: (stats?.by_impact as Record<string, number>)?.[key]
      ?? (dashboard?.impacts as Record<string, number>)?.[key]
      ?? 0,
    color: cfg.color,
  })).filter(d => d.count > 0);

  const topEntities = dashboard?.top_entities ?? [];
  const topTopics = dashboard?.top_topics ?? [];
  const hypotheses = dashboard?.hypotheses ?? [];

  const handleExport = async () => {
    if (!projectId) return;
    setExporting(true);
    try {
      await reportsService.downloadReport(projectId);
    } finally {
      setExporting(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#161b27', border: '1px solid #1e2535', borderRadius: '1rem',
  };

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-1">
          <Link to={`/projects/${projectId}`} className="text-xs font-medium" style={{ color: '#6b7280' }}>
            ← Retour au projet
          </Link>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">Analyse stratégique</h1>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                Sprint 7
              </span>
            </div>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              Synthèse IA, hypothèses, entités et tendances sémantiques
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/projects/${projectId}/insights`}
              className="text-sm font-semibold px-4 py-2 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
              Dashboard (Sprint 6)
            </Link>
            <button type="button" onClick={handleExport} disabled={exporting}
              className="text-sm font-semibold px-4 py-2 rounded-xl"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
              {exporting ? 'Export...' : 'Exporter rapport'}
            </button>
          </div>
        </div>

        {/* KPIs pipeline */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Collectés', value: overview?.raw_items ?? 0, color: '#60a5fa' },
            { label: 'Nettoyés', value: overview?.processed_items ?? 0, color: '#34d399' },
            { label: 'Enrichis IA', value: overview?.enriched_items ?? stats?.total_enriched ?? 0, color: '#a78bfa' },
            { label: 'Score moyen', value: `${Math.round((overview?.avg_relevance ?? stats?.avg_relevance ?? 0) * 100)}%`, color: '#fbbf24' },
            { label: 'Hypothèses', value: overview?.hypotheses_count ?? hypotheses.length, color: '#22d3ee' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4" style={cardStyle}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#6b7280' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div style={{ ...cardStyle, padding: '1.5rem' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#4b5568' }}>
              Répartition des sentiments
            </p>
            {sentimentPie.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-sm" style={{ color: '#4b5568' }}>
                Aucune donnée
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <PieChart>
                  <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={44} outerRadius={72} dataKey="value" paddingAngle={3}>
                    {sentimentPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ ...cardStyle, padding: '1.5rem' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#4b5568' }}>
              Impact sur les hypothèses
            </p>
            {impactBar.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-sm" style={{ color: '#4b5568' }}>
                Lancez l'enrichissement IA
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={impactBar}>
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {impactBar.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'insights', label: 'Insights détaillés' },
            { key: 'hypotheses', label: 'Évaluation hypothèses' },
            { key: 'entities', label: 'Entités & sujets' },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={activeTab === tab.key
                ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                : { background: '#161b27', color: '#6b7280', border: '1px solid #1e2535' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'hypotheses' && (
          <div style={{ ...cardStyle, overflow: 'hidden' }} className="mb-6">
            {dashLoading ? (
              <div className="py-12 text-center text-sm" style={{ color: '#6b7280' }}>Chargement...</div>
            ) : hypotheses.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: '#6b7280' }}>Aucune hypothèse évaluée</div>
            ) : (
              hypotheses.map((hyp: any, i: number) => {
                const cfg = IMPACT_CFG[hyp.status as HypothesisImpact] ?? IMPACT_CFG.OPEN;
                const conf = Math.round((hyp.confidence ?? 0) * 100);
                return (
                  <div key={hyp.id} className="px-6 py-4"
                    style={{ borderBottom: i < hypotheses.length - 1 ? '1px solid #1e2535' : 'none' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>
                          {hyp.objective} · {hyp.axe}
                        </p>
                        <p className="text-sm text-white">{hyp.content}</p>
                        <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                          {hyp.evidence_count} preuve(s) · {hyp.support_count} pour · {hyp.against_count} contre
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${cfg.color}20`, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        <p className="text-sm font-bold mt-1" style={{ color: cfg.color }}>{conf}%</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'entities' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#4b5568' }}>
                Top entités
              </p>
              {topEntities.length === 0 ? (
                <p className="text-sm" style={{ color: '#6b7280' }}>Aucune entité extraite</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topEntities.map((e: { name: string; count: number }) => (
                    <span key={e.name} className="text-xs px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                      {e.name} ({e.count})
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#4b5568' }}>
                Top sujets
              </p>
              {topTopics.length === 0 ? (
                <p className="text-sm" style={{ color: '#6b7280' }}>Aucun sujet identifié</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topTopics.map((t: { name: string; count: number }) => (
                    <span key={t.name} className="text-xs px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                      {t.name} ({t.count})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <>
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

            <div className="rounded-2xl overflow-hidden" style={cardStyle}>
              {isLoading ? (
                <div className="py-16 text-center text-sm" style={{ color: '#6b7280' }}>Chargement...</div>
              ) : items.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm font-medium text-white mb-1">Aucun résultat</p>
                  <p className="text-xs" style={{ color: '#6b7280' }}>
                    Lancez l'enrichissement IA depuis la page du projet
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
                          {r.title ?? r.processed_item?.title ?? 'Sans titre'}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold shrink-0"
                          style={{ background: `${impact.color}20`, color: impact.color }}>
                          {impact.label}
                        </span>
                      </div>
                      {r.summary && (
                        <p className="text-xs leading-relaxed mb-2" style={{ color: '#9ca3af' }}>{r.summary}</p>
                      )}
                      {r.answer && (
                        <p className="text-xs leading-relaxed mb-3 italic" style={{ color: '#a5b4fc' }}>
                          Réponse : {r.answer}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: '#34d399' }}>{pct}% pertinence</span>
                        <p className="text-xs" style={{ color: '#4b5568' }}>
                          {new Date(r.enriched_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

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
          </>
        )}
      </div>
    </Layout>
  );
}
