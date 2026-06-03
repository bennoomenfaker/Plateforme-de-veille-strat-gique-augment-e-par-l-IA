import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import api, { analyseService, insightService, alertsService } from '../../services/api';

type Period = '7d' | '30d' | '90d' | 'custom';

interface Widget { id: string; label: string; visible: boolean; }

const DEFAULT_WIDGETS: Widget[] = [
  { id: 'stats', label: 'Statistiques', visible: true },
  { id: 'wordcloud', label: 'Nuage de mots', visible: true },
  { id: 'network', label: 'Réseau d\'entités', visible: true },
  { id: 'weak-signals', label: 'Signaux faibles', visible: true },
  { id: 'insights-feed', label: 'Flux d\'insights', visible: true },
];

function loadWidgets(): Widget[] {
  try {
    const saved = localStorage.getItem('dashboard-widgets');
    if (saved) {
      const parsed: Widget[] = JSON.parse(saved);
      const defaultIds = new Set(DEFAULT_WIDGETS.map(w => w.id));
      const savedIds = new Set(parsed.map(w => w.id));
      const missing = DEFAULT_WIDGETS.filter(w => !savedIds.has(w.id));
      if (missing.length) {
        const merged = [...parsed, ...missing];
        localStorage.setItem('dashboard-widgets', JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }
  } catch {}
  return DEFAULT_WIDGETS;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareStart, setCompareStart] = useState('');
  const [compareEnd, setCompareEnd] = useState('');
  const [widgets, setWidgets] = useState<Widget[]>(loadWidgets);
  const [showSettings, setShowSettings] = useState(false);
  const [insightProjectId, setInsightProjectId] = useState('');

  useEffect(() => {
    localStorage.setItem('dashboard-widgets', JSON.stringify(widgets));
  }, [widgets]);

  const queryParams = useMemo(() => {
    const p: any = { period };
    if (period === 'custom' && startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    if (compareMode && compareStart) p.compareStart = compareStart;
    if (compareMode && compareEnd) p.compareEnd = compareEnd;
    return p;
  }, [period, startDate, endDate, compareMode, compareStart, compareEnd]);

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['user-dashboard', queryParams],
    queryFn: () => analyseService.getUserDashboard(queryParams).then(r => r.data),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: () => alertsService.getUnreadCount().then(r => r.data),
  });

  const allProjects = [
    ...(projectsData?.individual || []),
    ...(projectsData?.organisation || []),
  ];

  const current = dashData?.current;
  const previous = dashData?.previous;

  const delta = (field: string) => {
    if (!previous) return null;
    const cur = current?.overview?.[field] ?? 0;
    const prev = previous?.overview?.[field] ?? 0;
    if (prev === 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  };

  const toggleWidget = (id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  const moveWidget = (id: string, dir: 'up' | 'down') => {
    setWidgets(prev => {
      const idx = prev.findIndex(w => w.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const periodLabel = (p: Period) =>
    p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : p === '90d' ? '90 jours' : 'Personnalisé';

  const effectiveProjectId = insightProjectId || allProjects[0]?.id || '';

  const { data: weakSignalsData } = useQuery({
    queryKey: ['weak-signals', effectiveProjectId],
    queryFn: () => insightService.getWeakSignals(effectiveProjectId).then(r => r.data),
    enabled: !!effectiveProjectId,
    staleTime: 60_000,
  });

  const { data: insightsData } = useQuery({
    queryKey: ['insights', effectiveProjectId],
    queryFn: () => insightService.getInsights(effectiveProjectId).then(r => r.data),
    enabled: !!effectiveProjectId,
    staleTime: 60_000,
  });

  const { data: trendsData } = useQuery({
    queryKey: ['trends', effectiveProjectId],
    queryFn: () => insightService.detectTrends(effectiveProjectId).then(r => r.data),
    enabled: !!effectiveProjectId,
    staleTime: 120_000,
  });

  const { data: anomaliesData } = useQuery({
    queryKey: ['anomalies', effectiveProjectId],
    queryFn: () => insightService.detectAnomalies(effectiveProjectId).then(r => r.data),
    enabled: !!effectiveProjectId,
    staleTime: 120_000,
  });

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3b82f6' }}>
              Tableau de bord
            </p>
            <h1 className="text-2xl font-bold text-white">Bonjour, {user?.nom}</h1>
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
              Vue consolidée de votre activité de veille
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-xl transition"
            style={{ background: '#1e2535', border: '1px solid #374151' }}
            title="Personnaliser le dashboard"
          >
            <svg className="w-5 h-5" style={{ color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Widget settings panel */}
        {showSettings && (
          <div className="mb-6 rounded-2xl p-4" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>
              Personnaliser les widgets
            </p>
            <div className="space-y-2">
              {widgets.map((w, i) => (
                <div key={w.id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: '#1e2535' }}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={w.visible}
                      onChange={() => toggleWidget(w.id)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: '#3b82f6' }}
                    />
                    <span className="text-sm text-white">{w.label}</span>
                  </label>
                  <div className="flex gap-1">
                    <button onClick={() => moveWidget(w.id, 'up')} disabled={i === 0}
                      className="p-1 rounded-lg disabled:opacity-30" style={{ background: '#161b27' }}>
                      <svg className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button onClick={() => moveWidget(w.id, 'down')} disabled={i === widgets.length - 1}
                      className="p-1 rounded-lg disabled:opacity-30" style={{ background: '#161b27' }}>
                      <svg className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtres temporels */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {(['7d', '30d', '90d', 'custom'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={period === p
                ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                : { background: '#161b27', color: '#6b7280', border: '1px solid #1e2535' }}>
              {periodLabel(p)}
            </button>
          ))}

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-sm"
                style={{ background: '#1e2535', color: '#e5e7eb', border: '1px solid #374151' }} />
              <span style={{ color: '#6b7280' }}>→</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-sm"
                style={{ background: '#1e2535', color: '#e5e7eb', border: '1px solid #374151' }} />
            </div>
          )}

          <label className="flex items-center gap-2 ml-4 cursor-pointer">
            <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)}
              className="w-4 h-4 rounded" style={{ accentColor: '#3b82f6' }} />
            <span className="text-xs font-semibold" style={{ color: '#9ca3af' }}>Comparer</span>
          </label>

          {compareMode && (
            <div className="flex items-center gap-2">
              <input type="date" value={compareStart} onChange={e => setCompareStart(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-sm"
                style={{ background: '#1e2535', color: '#e5e7eb', border: '1px solid #374151' }} />
              <span style={{ color: '#6b7280' }}>→</span>
              <input type="date" value={compareEnd} onChange={e => setCompareEnd(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-sm"
                style={{ background: '#1e2535', color: '#e5e7eb', border: '1px solid #374151' }} />
            </div>
          )}
        </div>

        {/* Quick stats cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#1d4ed8,#4f46e5)' }}>
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Projets actifs
            </p>
            <p className="text-3xl font-bold text-white">{allProjects.filter(p => p.isActive).length}</p>
          </div>
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#065f46,#047857)' }}>
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Alertes non lues
            </p>
            <p className="text-3xl font-bold text-white">{alertsData?.unread || 0}</p>
          </div>
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#be123c,#e11d48)' }}>
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Compte
            </p>
            <p className="text-3xl font-bold text-white">{user?.type_utilisateur === 'INDIVIDUEL' ? 'Individuel' : 'Organisation'}</p>
          </div>
        </div>

        {/* Dashboard widgets */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {widgets.filter(w => w.visible).map(widget => {
              if (widget.id === 'stats') return (
                <StatsWidget key="stats" current={current} previous={previous} delta={delta} />
              );
              if (widget.id === 'wordcloud') return (
                <WordCloudWidget key="wordcloud" words={current?.wordCloud ?? []} />
              );
              if (widget.id === 'network') return (
                <EntityNetworkWidget key="network" network={current?.entityNetwork} />
              );
              if (widget.id === 'weak-signals') return (
                <WeakSignalsWidget key="weak-signals" signals={weakSignalsData ?? []} />
              );
              if (widget.id === 'insights-feed') return (
                <InsightsFeedWidget key="insights-feed" insights={insightsData ?? []} anomalies={anomaliesData ?? []} />
              );
              return null;
            })}
          </div>
        )}

        {/* Insight Engine */}
        <div className="rounded-2xl p-6 mt-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6b7280' }}>
                Insight Engine
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: '#4b5568' }}>
                Détection de tendances, signaux faibles, anomalies
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={insightProjectId}
                onChange={e => setInsightProjectId(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: '#1e2535', color: '#e5e7eb', border: '1px solid #374151' }}>
                <option value="">Sélectionner un projet</option>
                {allProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (!insightProjectId) return;
                  await insightService.generate(insightProjectId);
                }}
                disabled={!insightProjectId}
                className="text-xs font-bold px-4 py-1.5 rounded-lg transition disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }}>
                Générer les insights
              </button>
            </div>
          </div>

          {effectiveProjectId && trendsData && (
            <TrendsWidget trends={trendsData} />
          )}
        </div>

        {/* Projets récents */}
        <div className="rounded-2xl overflow-hidden mt-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1e2535' }}>
            <div>
              <h2 className="font-semibold text-white text-sm">Projets récents</h2>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{allProjects.length} projet(s) au total</p>
            </div>
            <Link to="/projects" className="text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
              Voir tout →
            </Link>
          </div>

          {allProjects.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#1e2535' }}>
                <svg className="w-6 h-6" style={{ color: '#4b5568' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: '#9ca3af' }}>Aucun projet pour l'instant</p>
              <p className="text-xs mb-5" style={{ color: '#4b5568' }}>Créez votre premier projet de veille</p>
              <Link to="/projects" className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }}>
                Créer un projet
              </Link>
            </div>
          ) : (
            <div>
              {allProjects.slice(0, 5).map((project: any, i: number) => (
                <Link key={project.id} to={`/projects/${project.id}`}
                  className="flex items-center justify-between px-6 py-4 transition group"
                  style={{ borderBottom: i < Math.min(allProjects.length, 5) - 1 ? '1px solid #1e2535' : 'none' }}>
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(99,102,241,0.2))' }}>
                      <svg className="w-4 h-4" style={{ color: '#60a5fa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition">{project.nom}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                        {project._totalSources ?? project.sources?.length ?? 0} source(s)
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={project.isActive
                      ? { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }
                      : { background: 'rgba(107,114,128,0.1)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.2)' }
                    }>
                    {project.isActive ? 'Actif' : 'Archivé'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

/* ─── Stats widget ─── */
function StatsWidget({ current, previous, delta }: any) {
  if (!current) return null;
  const items = [
    { label: 'Enrichis IA', value: current.overview?.total_enriched ?? 0, key: 'total_enriched', color: '#a78bfa' },
    { label: 'Score moyen', value: `${Math.round((current.overview?.avg_relevance ?? 0) * 100)}%`, key: 'avg_relevance', color: '#fbbf24' },
    { label: 'Entités uniques', value: current.overview?.unique_entities ?? 0, key: 'unique_entities', color: '#34d399' },
    { label: 'Analysés', value: current.overview?.sentiments_total ?? 0, key: 'sentiments_total', color: '#60a5fa' },
  ];

  const sentiments = current.sentiments ?? { POSITIF: 0, NEGATIF: 0, NEUTRE: 0 };
  const total = sentiments.POSITIF + sentiments.NEGATIF + sentiments.NEUTRE || 1;

  return (
    <div className="rounded-2xl p-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#6b7280' }}>
        Statistiques {previous ? '(comparaison active)' : ''}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {items.map(s => {
          const d = delta?.(s.key);
          return (
            <div key={s.key} className="rounded-xl p-4" style={{ background: '#1e2535' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#6b7280' }}>{s.label}</p>
              {d !== null && (
                <span className={`text-[10px] font-bold ${d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {d >= 0 ? '▲' : '▼'} {Math.abs(d)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Sentiment bar */}
      {total > 1 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#6b7280' }}>Sentiments</p>
          <div className="flex h-4 rounded-full overflow-hidden">
            {sentiments.POSITIF > 0 && (
              <div style={{ width: `${(sentiments.POSITIF / total) * 100}%`, background: '#34d399', minWidth: 4 }}
                title={`Positif: ${sentiments.POSITIF}`} />
            )}
            {sentiments.NEUTRE > 0 && (
              <div style={{ width: `${(sentiments.NEUTRE / total) * 100}%`, background: '#6b7280', minWidth: 4 }}
                title={`Neutre: ${sentiments.NEUTRE}`} />
            )}
            {sentiments.NEGATIF > 0 && (
              <div style={{ width: `${(sentiments.NEGATIF / total) * 100}%`, background: '#ef4444', minWidth: 4 }}
                title={`Négatif: ${sentiments.NEGATIF}`} />
            )}
          </div>
          <div className="flex gap-4 mt-1 text-[10px]" style={{ color: '#6b7280' }}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Positif {sentiments.POSITIF}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Neutre {sentiments.NEUTRE}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Negatif {sentiments.NEGATIF}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Word cloud widget ─── */
function WordCloudWidget({ words }: { words: { text: string; value: number }[] }) {
  if (!words || words.length === 0) return null;

  const maxVal = Math.max(...words.map(w => w.value), 1);
  const colors = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee', '#f472b6', '#fb923c'];

  const topWords = words.slice(0, 5);

  return (
    <div className="rounded-2xl p-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#6b7280' }}>
        Nuage de mots
      </p>

      {/* Cloud */}
      <div className="flex flex-wrap items-center justify-center gap-2 p-4 min-h-[200px]"
        style={{ background: '#1e2535', borderRadius: '0.75rem' }}>
        {words.slice(0, 40).map((w, i) => {
          const ratio = w.value / maxVal;
          const size = 0.6 + ratio * 1.6;
          const color = colors[i % colors.length];
          return (
            <span
              key={w.text + '-' + i}
              className="inline-block transition hover:opacity-80 cursor-default"
              style={{
                fontSize: `${size}rem`,
                color,
                fontWeight: ratio > 0.5 ? 700 : 500,
                opacity: 0.5 + ratio * 0.5,
                lineHeight: 1.4,
              }}
              title={`${w.text} (${w.value})`}
            >
              {w.text}
            </span>
          );
        })}
      </div>

      {/* Top words breakdown */}
      {topWords.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#6b7280' }}>
            Mots-clés les plus fréquents
          </p>
          <div className="space-y-1.5">
            {topWords.map((w, idx) => {
              const pct = Math.round((w.value / maxVal) * 100);
              return (
                <div key={w.text + '-' + idx} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-28 truncate" style={{ color: '#e5e7eb' }}>
                    {w.text}
                  </span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: '#1e2535' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #a78bfa)',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold w-8 text-right" style={{ color: '#9ca3af' }}>
                    {w.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Entity network graph widget ─── */
function EntityNetworkWidget({ network }: { network: any }) {
  const colors = ['#3b82f6', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee', '#f472b6'];

  const nodeDegrees = useMemo(() => {
    const deg: Record<string, number> = {};
    network?.edges?.forEach((e: any) => {
      deg[e.source] = (deg[e.source] || 0) + e.weight;
      deg[e.target] = (deg[e.target] || 0) + e.weight;
    });
    return deg;
  }, [network]);

  const nodes: Node[] = useMemo(() => {
    if (!network?.nodes?.length) return [];
    const maxCount = Math.max(...network.nodes.map((n: any) => n.count), 1);
    const sorted = [...network.nodes].sort(
      (a: any, b: any) => (nodeDegrees[b.id] || 0) - (nodeDegrees[a.id] || 0),
    );
    const centerX = 300, centerY = 250, radius = 160;
    return sorted.map((n: any, i: number) => {
      const angle = (i / sorted.length) * 2 * Math.PI - Math.PI / 2;
      const tier = Math.floor((n.count / maxCount) * colors.length);
      return {
        id: n.id,
        position: {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        },
        data: {
          label: `${n.name} (${n.count})`,
        },
        style: {
          background: colors[Math.min(tier, colors.length - 1)],
          color: 'white',
          border: 'none',
          borderRadius: '999px',
          padding: `${6 + (n.count / maxCount) * 8}px ${10 + (n.count / maxCount) * 10}px`,
          fontSize: `${10 + (n.count / maxCount) * 3}px`,
          fontWeight: 600,
        },
      };
    });
  }, [network, nodeDegrees]);

  const edges: Edge[] = useMemo(() => {
    if (!network?.edges?.length) return [];
    const maxWeight = Math.max(...network.edges.map((e: any) => e.weight), 1);
    return network.edges.map((e: any) => ({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: `${e.weight}`,
      style: {
        stroke: '#6b7280',
        strokeWidth: 1 + (e.weight / maxWeight) * 4,
      },
      labelStyle: { fill: '#9ca3af', fontSize: 9 },
      labelBgStyle: { fill: '#1e2535', fillOpacity: 0.8 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      type: 'smoothstep',
      animated: false,
    }));
  }, [network]);

  const topConnections = useMemo(() => {
    if (!network?.edges?.length) return [];
    const nodeMap = new Map(network.nodes.map((n: any) => [n.id, n.name]));
    return [...network.edges]
      .sort((a: any, b: any) => b.weight - a.weight)
      .slice(0, 5)
      .map((e: any) => ({
        source: nodeMap.get(e.source) || e.source,
        target: nodeMap.get(e.target) || e.target,
        weight: e.weight,
      }));
  }, [network]);

  if (!network?.nodes?.length) return null;

  return (
    <div className="rounded-2xl p-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#6b7280' }}>
        Réseau de relations entre entités
      </p>
      <div className="h-[500px] rounded-xl overflow-hidden" style={{ background: '#1e2535' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#334155" gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Key connections summary */}
      {topConnections.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {topConnections.map((c, i) => (
            <div key={i} className="rounded-xl p-2.5 text-center"
              style={{ background: '#1e2535', border: '1px solid #2d3748' }}>
              <p className="text-[10px] leading-tight" style={{ color: '#9ca3af' }}>
                {c.source} ↔ {c.target}
              </p>
              <p className="text-xs font-bold mt-1" style={{ color: '#fbbf24' }}>
                {c.weight} co-occurrence{c.weight > 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-[10px]" style={{ color: '#6b7280' }}>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#3b82f6' }} /> Faible
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#a78bfa' }} /> Moyen
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#f87171' }} /> Élevé
        </span>
        <span>•</span>
        <span>Les entités sont reliées quand elles apparaissent dans un même article. Taille = fréquence.</span>
      </div>
    </div>
  );
}

/* ─── Weak Signals widget ─── */
function WeakSignalsWidget({ signals }: { signals: any[] }) {
  if (!signals || signals.length === 0) return (
    <div className="rounded-2xl p-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>Signaux faibles</p>
      <p className="text-xs" style={{ color: '#6b7280' }}>Aucun signal faible détecté. Lancez une génération d'insights.</p>
    </div>
  );

  const severityColor = (score: number) => {
    if (score >= 0.7) return '#ef4444';
    if (score >= 0.5) return '#f59e0b';
    return '#3b82f6';
  };

  return (
    <div className="rounded-2xl p-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#6b7280' }}>
        Signaux faibles ({signals.filter((s: any) => s.score >= 0.3).length})
      </p>
      <div className="space-y-2">
        {signals.slice(0, 10).map((s: any) => (
          <div key={s.id} className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: '#1e2535' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: severityColor(s.score), color: 'white' }}>
              {Math.round(s.score * 100)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{s.entity_name}</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>
                {s.entity_type === 'ENTITY' ? 'Entité' : 'Sujet'} · {s.source_count} source(s) · {s.mention_count} mention(s)
              </p>
              {s.explanation && (
                <p className="text-[10px] mt-1 italic" style={{ color: '#6b7280' }}>{s.explanation}</p>
              )}
            </div>
            <div className="flex gap-1 text-[9px] font-medium">
              {[
                { label: 'N', value: s.novelty_score, color: '#a78bfa' },
                { label: 'C', value: s.growth_score, color: '#34d399' },
                { label: 'S', value: s.cross_source_score, color: '#fbbf24' },
                { label: 'F', value: s.frequency_score, color: '#60a5fa' },
              ].map(m => (
                <span key={m.label} className="w-5 h-5 rounded flex items-center justify-center"
                  style={{ background: `${m.color}20`, color: m.color }}>
                  {m.label}{Math.round(m.value * 10)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Trends widget ─── */
function TrendsWidget({ trends }: { trends: any }) {
  const hasData = trends?.trendingUp?.length || trends?.emerging?.length;

  const renderList = (items: any[], label: string, colorUp: boolean) => {
    if (!items?.length) return null;
    return (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#6b7280' }}>{label}</p>
        <div className="space-y-1.5">
          {items.slice(0, 5).map((t: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: '#1e2535' }}>
              <span className="text-xs font-medium text-white truncate">{t.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold ${colorUp ? 'text-emerald-400' : 'text-red-400'}`}>
                  {colorUp ? '▲' : '▼'} {Math.abs(t.variationPercent)}%
                </span>
                <span className="text-[9px]" style={{ color: '#6b7280' }}>{t.currentFreq}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!hasData) return (
    <div>
      <p className="text-xs" style={{ color: '#6b7280' }}>Aucune tendance détectée sur la période récente.</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
      {renderList(trends.trendingUp, 'Tendances à la hausse', true)}
      {renderList(trends.emerging, 'Sujets émergents', true)}
      {renderList(trends.trendingDown, 'Tendances à la baisse', false)}
    </div>
  );
}

/* ─── Insights Feed widget ─── */
function InsightsFeedWidget({ insights, anomalies }: { insights: any[]; anomalies: any[] }) {
  const TYPE_CFG: Record<string, { label: string; color: string }> = {
    TREND: { label: 'Tendance', color: '#3b82f6' },
    ANOMALY: { label: 'Anomalie', color: '#ef4444' },
    COMPETITOR: { label: 'Concurrentiel', color: '#f59e0b' },
    HYPOTHESIS: { label: 'Hypothèse', color: '#a78bfa' },
    WEAK_SIGNAL: { label: 'Signal faible', color: '#22d3ee' },
  };

  const allItems = [
    ...anomalies.map((a: any, i: number) => ({
      id: `anomaly-${i}`,
      type: 'ANOMALY',
      title: a.title,
      description: a.description,
      confidence: a.severity === 'HIGH' ? 0.9 : 0.6,
      severity: a.severity,
      created_at: a.date,
      is_read: false,
    })),
    ...insights,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (allItems.length === 0) return (
    <div className="rounded-2xl p-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>Flux d'insights</p>
      <p className="text-xs" style={{ color: '#6b7280' }}>Aucun insight pour le moment.</p>
    </div>
  );

  return (
    <div className="rounded-2xl p-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#6b7280' }}>
        Flux d'insights ({allItems.length})
      </p>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {allItems.slice(0, 20).map((item: any) => {
          const cfg = TYPE_CFG[item.type] || { label: item.type, color: '#6b7280' };
          return (
            <div key={item.id} className="rounded-xl p-3 transition hover:opacity-90"
              style={{ background: '#1e2535', border: '1px solid #2d3748' }}>
              <div className="flex items-start gap-3">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded shrink-0 mt-0.5"
                  style={{ background: `${cfg.color}20`, color: cfg.color }}>
                  {cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{item.title}</p>
                  <p className="text-[10px] mt-1 leading-relaxed" style={{ color: '#9ca3af' }}>
                    {item.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[9px] font-medium" style={{ color: '#6b7280' }}>
                      Confiance: {Math.round((item.confidence || 0) * 100)}%
                    </span>
                    <span className="text-[9px]" style={{ color: '#4b5568' }}>
                      {new Date(item.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    {item.severity && (
                      <span className={`text-[9px] font-bold ${
                        item.severity === 'HIGH' ? 'text-red-400' : item.severity === 'MEDIUM' ? 'text-yellow-400' : 'text-blue-400'
                      }`}>
                        {item.severity}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
