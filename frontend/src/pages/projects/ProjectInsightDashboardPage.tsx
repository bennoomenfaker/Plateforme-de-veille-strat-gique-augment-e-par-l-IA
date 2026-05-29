import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import Layout from '../../components/layout/Layout';
import api, { aiEnrichmentService, processingService, reportsService } from '../../services/api';
import type { HypothesisImpact, AiEnrichmentStats } from '../../types';

const IMPACT_CFG: Record<HypothesisImpact, { label: string; color: string }> = {
  OPEN:                { label: 'Ouverte',        color: '#9ca3af' },
  PARTIALLY_SUPPORTED: { label: 'Part. supportée', color: '#fbbf24' },
  SUPPORTED:           { label: 'Supportée',       color: '#34d399' },
  CONTRADICTED:        { label: 'Contredite',      color: '#f87171' },
  NEEDS_MORE_RESEARCH: { label: 'À approfondir',   color: '#a78bfa' },
};

const CHART_COLORS = ['#3b82f6','#34d399','#f87171','#fbbf24','#a78bfa','#60a5fa','#fb923c'];
const TOOLTIP_STYLE = {
  background: '#1e2535', border: '1px solid #374151',
  borderRadius: '0.5rem', color: '#e5e7eb', fontSize: '0.75rem',
};

export default function ProjectInsightDashboardPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'overview' | 'hypotheses' | 'feed' | 'synthese'>('overview');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [minScore, setMinScore] = useState(0);
  const [exporting, setExporting] = useState<'view' | 'download' | null>(null);
  const [exportError, setExportError] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn:  () => api.get(`/projects/${projectId}`).then(r => r.data),
    enabled:  !!projectId,
  });

  const { data: procStats } = useQuery({
    queryKey: ['processing-stats', projectId],
    queryFn:  () => processingService.getStats(projectId!).then(r => r.data),
    enabled:  !!projectId,
  });

  const { data: aiStats } = useQuery<AiEnrichmentStats>({
    queryKey: ['ai-stats', projectId],
    queryFn:  () => aiEnrichmentService.getStats(projectId!).then(r => r.data),
    enabled:  !!projectId,
  });

  const { data: feedData } = useQuery({
    queryKey: ['enriched-feed', projectId],
    queryFn:  () => aiEnrichmentService.getByProject(projectId!, 1, 50).then(r => r.data),
    enabled:  !!projectId,
  });

  const { data: hypothesisEvals } = useQuery({
    queryKey: ['hypothesis-evals', projectId],
    queryFn:  () => aiEnrichmentService.getHypothesisEvaluations(projectId!).then(r => r.data),
    enabled:  !!projectId,
  });

  const { data: enrichmentJobs } = useQuery({
    queryKey: ['enrichment-jobs', projectId],
    queryFn:  () => aiEnrichmentService.getJobs(projectId!, 8).then(r => r.data),
    enabled:  !!projectId,
  });

  const handleExportView = async () => {
    if (!projectId) return;
    setExportError('');
    setExporting('view');
    try {
      await reportsService.openReportHtml(projectId);
    } catch {
      setExportError('Impossible d\'ouvrir le rapport. Vérifiez votre connexion et réessayez.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportDownload = async () => {
    if (!projectId) return;
    setExportError('');
    setExporting('download');
    try {
      await reportsService.downloadReport(projectId);
    } catch {
      setExportError('Impossible de télécharger le rapport.');
    } finally {
      setExporting(null);
    }
  };

  // ── Calculs ────────────────────────────────────────────────────────────────

  const objectives = project?.objectives ?? [];
  const feedItems  = feedData?.data ?? [];
  const evals      = Array.isArray(hypothesisEvals) ? hypothesisEvals : [];

  const sourceOptions = [
    ...new Set(feedItems.map((item: any) => item.source_type ?? item.source_name ?? 'Inconnu')),
  ].filter(Boolean);
  const filteredFeedItems = feedItems.filter((item: any) => {
    const itemSource = item.source_type ?? item.source_name ?? 'Inconnu';
    const score = Math.round((item.relevance_score ?? 0) * 100);
    const matchSource = sourceFilter === 'ALL' || itemSource === sourceFilter;
    const matchScore = score >= minScore;
    return matchSource && matchScore;
  });

  const impactPie = (Object.entries(IMPACT_CFG) as [HypothesisImpact, { label: string; color: string }][])
    .map(([key, cfg]) => ({
      name:  cfg.label,
      value: feedItems.filter((i: any) => i.hypothesis_impact === key).length,
      color: cfg.color,
    }))
    .filter(d => d.value > 0);

  const itemsByDay = (() => {
    const counts: Record<string, number> = {};
    feedItems.forEach((item: any) => {
      const d = item.enriched_at?.slice(0, 10);
      if (d) counts[d] = (counts[d] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        count,
      }));
  })();

  const topSources = (() => {
    const counts: Record<string, number> = {};
    feedItems.forEach((item: any) => {
      const s = item.source_name ?? item.source_type ?? 'Inconnu';
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.slice(0, 22), count }));
  })();

  const topItems = [...feedItems]
    .sort((a: any, b: any) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
    .slice(0, 5);

  const supportedCount = evals.filter((e: any) => e.status === 'SUPPORTED').length;
  const contradictedCount = evals.filter((e: any) => e.status === 'CONTRADICTED').length;
  const completionPct = procStats?.total_raw
    ? Math.round(((procStats?.total_processed ?? 0) / procStats.total_raw) * 100)
    : 0;
  const enrichmentPct = procStats?.total_processed
    ? Math.round(((aiStats?.total_enriched ?? 0) / procStats.total_processed) * 100)
    : 0;

  const syntheseLines: string[] = [];
  if ((aiStats?.total_enriched ?? 0) === 0) {
    syntheseLines.push('Aucun insight IA généré — lancez l\'enrichissement depuis la page dédiée.');
  } else {
    syntheseLines.push(
      `${aiStats?.total_enriched ?? 0} insight(s) produits pour ${Math.round((aiStats?.avg_relevance ?? 0) * 100)}% de pertinence moyenne.`,
    );
    if (supportedCount > 0) {
      syntheseLines.push(`${supportedCount} hypothèse(s) sont actuellement supportées par les preuves collectées.`);
    }
    if (contradictedCount > 0) {
      syntheseLines.push(`${contradictedCount} hypothèse(s) sont contredites — une révision stratégique est recommandée.`);
    }
    if ((procStats?.pending ?? 0) > 0) {
      syntheseLines.push(`${procStats.pending} item(s) restent en attente de traitement (collecte → nettoyage).`);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: '#161b27', border: '1px solid #1e2535', borderRadius: '1rem',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">

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
              <h1 className="text-2xl font-bold text-white">Dashboard Stratégique</h1>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                         border: '1px solid rgba(59,130,246,0.2)' }}>
                Sprint 6
              </span>
            </div>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              {project?.nom} · Vue décisionnelle consolidée
            </p>
          </div>
          <div className="flex gap-3">
            <Link to={`/projects/${projectId}/enriched`}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                       border: '1px solid rgba(139,92,246,0.3)' }}>
              Enrichissement IA
            </Link>
            <Link to={`/projects/${projectId}/processed`}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399',
                       border: '1px solid rgba(16,185,129,0.3)' }}>
              Données nettoyées
            </Link>
            <button
              type="button"
              onClick={handleExportView}
              disabled={!!exporting}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{
                background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                border: '1px solid rgba(251,191,36,0.3)',
                opacity: exporting ? 0.6 : 1,
                cursor: exporting ? 'not-allowed' : 'pointer',
              }}>
              {exporting === 'view' ? 'Ouverture...' : 'Voir le rapport'}
            </button>
            <button
              type="button"
              onClick={handleExportDownload}
              disabled={!!exporting}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{
                background: 'rgba(234,88,12,0.15)', color: '#fb923c',
                border: '1px solid rgba(234,88,12,0.3)',
                opacity: exporting ? 0.6 : 1,
                cursor: exporting ? 'not-allowed' : 'pointer',
              }}>
              {exporting === 'download' ? 'Téléchargement...' : 'Télécharger HTML'}
            </button>
          </div>
        </div>

        {exportError && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {exportError}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Items collectés', count: procStats?.total_raw ?? 0,
              color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
            { label: 'Items nettoyés', count: procStats?.total_processed ?? 0,
              color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
            { label: 'Insights IA', count: aiStats?.total_enriched ?? feedItems.length,
              color: '#a78bfa', bg: 'rgba(139,92,246,0.1)' },
            { label: 'Score moyen',
              count: `${Math.round((aiStats?.avg_relevance ?? 0) * 100)}%`,
              color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-2xl"
              style={{ background: '#161b27', border: '1px solid #1e2535' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                  style={{ background: stat.bg, color: stat.color }}>
                  {stat.count}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: '#6b7280' }}>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'overview',   label: 'Vue générale'    },
            { key: 'hypotheses', label: 'Hypothèses'       },
            { key: 'feed',       label: "Flux d'insights"  },
            { key: 'synthese',   label: 'Synthèse & jobs'  },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={activeTab === tab.key
                ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                : { background: '#161b27', color: '#6b7280', border: '1px solid #1e2535' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════ TAB: VUE GÉNÉRALE ════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Évolution temporelle */}
              <div style={{ ...cardStyle, padding: '1.5rem' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ color: '#4b5568' }}>Insights par jour — 14 derniers jours</p>
                {itemsByDay.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-sm"
                    style={{ color: '#4b5568' }}>Aucune donnée</div>
                ) : (
                  <ResponsiveContainer width="100%" height={176}>
                    <LineChart data={itemsByDay}>
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }}
                        axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }}
                        axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="count" stroke="#6366f1"
                        strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} name="Insights" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Distribution impact */}
              <div style={{ ...cardStyle, padding: '1.5rem' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ color: '#4b5568' }}>Distribution de l'impact IA</p>
                {impactPie.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-sm"
                    style={{ color: '#4b5568' }}>Lancez l'enrichissement IA</div>
                ) : (
                  <ResponsiveContainer width="100%" height={176}>
                    <PieChart>
                      <Pie data={impactPie} cx="50%" cy="50%"
                        innerRadius={44} outerRadius={72} paddingAngle={3} dataKey="value">
                        {impactPie.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }}
                        iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Top sources */}
              <div style={{ ...cardStyle, padding: '1.5rem' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ color: '#4b5568' }}>Top sources</p>
                {topSources.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-sm"
                    style={{ color: '#4b5568' }}>Aucune source</div>
                ) : (
                  <ResponsiveContainer width="100%" height={176}>
                    <BarChart data={topSources} layout="vertical">
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }}
                        axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" width={90}
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Articles">
                        {topSources.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Pipeline */}
              <div style={{ ...cardStyle, padding: '1.5rem' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ color: '#4b5568' }}>État du pipeline</p>
                <div className="space-y-4">
                  {[
                    { icon: '📦', label: 'Collecte',          value: procStats?.total_raw ?? 0,       color: '#60a5fa' },
                    { icon: '🧹', label: 'Processing',        value: procStats?.total_processed ?? 0, color: '#34d399' },
                    { icon: '🧠', label: 'Enrichissement IA', value: aiStats?.total_enriched ?? 0,    color: '#a78bfa' },
                  ].map((bar, i) => {
                    const max = procStats?.total_raw ?? 1;
                    const pct = max > 0 ? Math.min(100, Math.round((bar.value / max) * 100)) : 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1 text-xs">
                          <span style={{ color: '#9ca3af' }}>{bar.icon} {bar.label}</span>
                          <span style={{ color: bar.color }}>{bar.value.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: '#1e2535' }}>
                          <div className="h-2 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: bar.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 pt-4 grid grid-cols-3 gap-3 text-center"
                  style={{ borderTop: '1px solid #1e2535' }}>
                  {[
                    { label: 'En attente',  value: procStats?.pending ?? 0,
                      color: '#fbbf24' },
                    { label: 'Supportées',
                      value: (aiStats?.by_impact as any)?.SUPPORTED ?? 0, color: '#34d399' },
                    { label: 'Contredites',
                      value: (aiStats?.by_impact as any)?.CONTRADICTED ?? 0, color: '#f87171' },
                  ].map((s, i) => (
                    <div key={i}>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px]" style={{ color: '#6b7280' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top insights */}
            {topItems.length > 0 && (
              <div style={{ ...cardStyle, overflow: 'hidden' }}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid #1e2535' }}>
                  <h2 className="text-sm font-bold text-white">Insights haute pertinence</h2>
                </div>
                {topItems.map((item: any, i: number) => {
                  const cfg = IMPACT_CFG[item.hypothesis_impact as HypothesisImpact] ?? IMPACT_CFG.OPEN;
                  const pct = Math.round((item.relevance_score ?? 0) * 100);
                  return (
                    <div key={item.id}
                      className="px-5 py-4 flex items-center gap-4"
                      style={{ borderBottom: i < topItems.length - 1 ? '1px solid #1e2535' : 'none' }}>
                      <span className="text-lg font-bold w-5 shrink-0"
                        style={{ color: '#4b5568' }}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white line-clamp-1">
                          {item.title ?? item.processed_item?.title ?? 'Sans titre'}
                        </p>
                        <p className="text-xs line-clamp-1 mt-0.5" style={{ color: '#6b7280' }}>
                          {item.summary ?? 'Aucun résumé'}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: `${cfg.color}20`, color: cfg.color,
                                 border: `1px solid ${cfg.color}40` }}>
                        {cfg.label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-14 h-1.5 rounded-full" style={{ background: '#1e2535' }}>
                          <div className="h-1.5 rounded-full"
                            style={{ width: `${pct}%`, background: '#34d399' }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: '#34d399' }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ TAB: HYPOTHÈSES ════ */}
        {activeTab === 'hypotheses' && (
          <div className="space-y-4">

            {/* Compteurs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {(Object.entries(IMPACT_CFG) as [HypothesisImpact, { label: string; color: string }][])
                .map(([key, cfg]) => {
                  const count = (aiStats?.by_impact as any)?.[key] ?? 0;
                  return (
                    <div key={key} className="p-4 rounded-2xl text-center"
                      style={{ background: `${cfg.color}10`, border: `1px solid ${cfg.color}30` }}>
                      <p className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider mt-1"
                        style={{ color: '#6b7280' }}>{cfg.label}</p>
                    </div>
                  );
                })}
            </div>

            {/* Arborescence objectifs > axes > hypothèses */}
            {objectives.length === 0 ? (
              <div className="rounded-2xl py-12 text-center" style={cardStyle}>
                <p className="text-sm" style={{ color: '#6b7280' }}>Aucun objectif défini</p>
              </div>
            ) : (
              objectives.map((obj: any) => (
                <div key={obj.id} style={cardStyle} className="overflow-hidden">
                  <div className="px-5 py-4 flex items-center gap-3"
                    style={{ borderBottom: '1px solid #1e2535' }}>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                               border: '1px solid rgba(59,130,246,0.2)' }}>
                      Objectif {obj.priority}
                    </span>
                    <p className="text-sm font-semibold text-white">{obj.content}</p>
                  </div>

                  {(obj.axes ?? []).map((axe: any) => (
                    <div key={axe.id}>
                      <div className="px-8 py-3 flex items-center gap-3"
                        style={{ borderBottom: '1px solid #1e2535',
                                 background: 'rgba(99,102,241,0.03)' }}>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>Axe</span>
                        <p className="text-sm font-medium text-white">{axe.name}</p>
                      </div>

                      {(axe.hypotheses ?? []).map((hyp: any) => {
                        const eva = evals.find((e: any) => e.hypothesis_id === hyp.id);
                        const impact: HypothesisImpact = (eva?.status as HypothesisImpact) ?? 'OPEN';
                        const cfg  = IMPACT_CFG[impact];
                        const conf = eva?.confidence ?? 0;
                        const evCnt = eva?.evidence_count ?? 0;
                        return (
                          <div key={hyp.id}
                            className="flex items-center gap-4 px-12 py-4 hover:bg-white/5 transition"
                            style={{ borderBottom: '1px solid #1e2535',
                                     background: 'rgba(16,185,129,0.02)' }}>
                            <div className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white line-clamp-2">{hyp.content}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                                {evCnt} preuve{evCnt > 1 ? 's' : ''} ·{' '}
                                {hyp.collection_plans?.length ?? 0} plan{(hyp.collection_plans?.length ?? 0) > 1 ? 's' : ''}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: `${cfg.color}20`, color: cfg.color,
                                       border: `1px solid ${cfg.color}40` }}>
                              {cfg.label}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="w-16 h-1.5 rounded-full" style={{ background: '#1e2535' }}>
                                <div className="h-1.5 rounded-full transition-all"
                                  style={{ width: `${Math.round(conf * 100)}%`, background: cfg.color }} />
                              </div>
                              <span className="text-xs font-bold w-8 text-right"
                                style={{ color: cfg.color }}>
                                {Math.round(conf * 100)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* ════ TAB: SYNTHÈSE ════ */}
        {activeTab === 'synthese' && (
          <div className="space-y-6">
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-4"
                style={{ color: '#4b5568' }}>Synthèse décisionnelle</p>
              <ul className="space-y-3">
                {syntheseLines.map((line, i) => (
                  <li key={i} className="flex gap-3 text-sm" style={{ color: '#d1d5db' }}>
                    <span style={{ color: '#60a5fa' }}>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl" style={{ background: '#0f1117' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>Taux de traitement</p>
                  <p className="text-2xl font-bold" style={{ color: '#34d399' }}>{completionPct}%</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: '#0f1117' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>Taux d'enrichissement IA</p>
                  <p className="text-2xl font-bold" style={{ color: '#a78bfa' }}>{enrichmentPct}%</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to={`/analyse/${projectId}`}
                  className="text-sm font-semibold px-4 py-2 rounded-xl"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                  Analyse approfondie (Sprint 7) →
                </Link>
              </div>
            </div>

            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #1e2535' }}>
                <h2 className="text-sm font-bold text-white">Derniers jobs d'enrichissement IA</h2>
              </div>
              {!enrichmentJobs?.length ? (
                <div className="py-10 text-center text-sm" style={{ color: '#6b7280' }}>
                  Aucun job d'enrichissement enregistré
                </div>
              ) : (
                enrichmentJobs.map((job: any, i: number) => (
                  <div key={job.id} className="px-5 py-4 flex items-center justify-between gap-4"
                    style={{ borderBottom: i < enrichmentJobs.length - 1 ? '1px solid #1e2535' : 'none' }}>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {job.status} · {job.processed ?? 0} traités · {job.failed ?? 0} erreurs
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                        {job.created_at
                          ? new Date(job.created_at).toLocaleString('fr-FR')
                          : '—'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: job.status === 'DONE' ? 'rgba(16,185,129,0.1)' : 'rgba(251,191,36,0.1)',
                        color: job.status === 'DONE' ? '#34d399' : '#fbbf24',
                      }}>
                      {job.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ════ TAB: FEED ════ */}
        {activeTab === 'feed' && (
          <div>
            {feedItems.length === 0 ? (
              <div className="rounded-2xl py-16 text-center" style={cardStyle}>
                <p className="text-4xl mb-3">📰</p>
                <p className="text-sm font-medium text-white mb-1">Aucun insight disponible</p>
                <p className="text-xs mb-5" style={{ color: '#6b7280' }}>
                  Lancez l'enrichissement IA pour générer des insights
                </p>
                <Link to={`/projects/${projectId}/enriched`}
                  className="inline-block text-sm font-semibold px-5 py-2 rounded-xl text-white"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>
                  Enrichissement IA →
                </Link>
              </div>
            ) : (
              <div style={{ ...cardStyle, overflow: 'hidden' }}>
                <div className="px-5 py-4 flex items-start justify-between gap-4"
                  style={{ borderBottom: '1px solid #1e2535' }}>
                  <div>
                    <h2 className="text-sm font-bold text-white">Flux d'insights</h2>
                    <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                      {filteredFeedItems.length} résultat(s) affiché(s) sur {feedItems.length}
                    </p>
                  </div>
                  <Link to={`/projects/${projectId}/enriched`}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0"
                    style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa',
                             border: '1px solid rgba(139,92,246,0.2)' }}>
                    Voir tout →
                  </Link>
                </div>

                <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-3"
                  style={{ borderBottom: '1px solid #1e2535', background: '#0f1117' }}>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#4b5568' }}>
                      Source
                    </label>
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                      style={{ background: '#161b27', border: '1px solid #1e2535', color: 'white' }}
                    >
                      <option value="ALL">Toutes les sources</option>
                      {sourceOptions.map((source) => (
                        <option key={String(source)} value={String(source)}>{String(source)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#4b5568' }}>
                      Score minimum
                    </label>
                    <select
                      value={minScore}
                      onChange={(e) => setMinScore(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                      style={{ background: '#161b27', border: '1px solid #1e2535', color: 'white' }}
                    >
                      <option value={0}>0%</option>
                      <option value={20}>20%</option>
                      <option value={40}>40%</option>
                      <option value={60}>60%</option>
                      <option value={80}>80%</option>
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      onClick={() => { setSourceFilter('ALL'); setMinScore(0); }}
                      className="w-full text-xs font-semibold px-3 py-2 rounded-lg transition"
                      style={{ background: '#1e2535', color: '#9ca3af', border: '1px solid #2d3748' }}
                    >
                      Réinitialiser
                    </button>
                  </div>
                </div>

                {filteredFeedItems.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-sm font-medium text-white mb-1">Aucun résultat pour ces filtres</p>
                    <p className="text-xs" style={{ color: '#6b7280' }}>
                      Ajustez la source ou le score minimum
                    </p>
                  </div>
                ) : (
                  filteredFeedItems.map((item: any, i: number) => {
                    const cfg = IMPACT_CFG[item.hypothesis_impact as HypothesisImpact] ?? IMPACT_CFG.OPEN;
                    const pct = Math.round((item.relevance_score ?? 0) * 100);
                    return (
                      <div key={item.id}
                        className="px-5 py-4 flex items-start gap-3 hover:bg-white/5 transition"
                        style={{ borderBottom: i < filteredFeedItems.length - 1 ? '1px solid #1e2535' : 'none' }}>
                        <div className="w-2 h-2 rounded-full mt-2 shrink-0"
                          style={{ background: cfg.color, boxShadow: `0 0 4px ${cfg.color}` }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white line-clamp-1 mb-1">
                            {item.title ?? item.processed_item?.title ?? 'Sans titre'}
                          </p>
                          <p className="text-xs line-clamp-2" style={{ color: '#6b7280' }}>
                            {item.summary ?? item.answer ?? 'Aucun résumé'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                              {item.source_type ?? item.source_name ?? 'Inconnu'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                              {pct}% pertinence
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold mb-1" style={{ color: '#34d399' }}>{pct}%</p>
                          <p className="text-[10px] mb-1" style={{ color: '#4b5568' }}>
                            {item.enriched_at
                              ? new Date(item.enriched_at).toLocaleDateString('fr-FR',
                                  { day: '2-digit', month: '2-digit', year: 'numeric' })
                              : '—'}
                          </p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: `${cfg.color}20`, color: cfg.color,
                                     border: `1px solid ${cfg.color}30` }}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
