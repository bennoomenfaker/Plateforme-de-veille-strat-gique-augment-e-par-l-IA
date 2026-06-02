import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import api, { analyseService } from '../../services/api';

type Period = '7d' | '30d' | '90d' | 'custom';

interface Widget { id: string; label: string; visible: boolean; }

const DEFAULT_WIDGETS: Widget[] = [
  { id: 'stats', label: 'Statistiques', visible: true },
  { id: 'wordcloud', label: 'Nuage de mots', visible: true },
  { id: 'network', label: 'Réseau d\'entités', visible: true },
];

function loadWidgets(): Widget[] {
  try {
    const saved = localStorage.getItem('dashboard-widgets');
    if (saved) return JSON.parse(saved);
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
    queryFn: () => api.get('/alertes/unread').then(r => r.data),
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
              return null;
            })}
          </div>
        )}

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

  return (
    <div className="rounded-2xl p-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#6b7280' }}>
        Nuage de mots
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 p-4 min-h-[200px]"
        style={{ background: '#1e2535', borderRadius: '0.75rem' }}>
        {words.slice(0, 40).map((w, i) => {
          const ratio = w.value / maxVal;
          const size = 0.6 + ratio * 1.6;
          const color = colors[i % colors.length];
          return (
            <span
              key={w.text}
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
    </div>
  );
}

/* ─── Entity network graph widget ─── */
function EntityNetworkWidget({ network }: { network: any }) {
  const nodes: Node[] = useMemo(() => {
    if (!network?.nodes?.length) return [];
    const maxCount = Math.max(...network.nodes.map((n: any) => n.count), 1);
    return network.nodes.map((n: any) => ({
      id: n.id,
      position: { x: Math.random() * 500, y: Math.random() * 400 },
      data: { label: n.name },
      style: {
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '999px',
        padding: `${6 + (n.count / maxCount) * 10}px ${10 + (n.count / maxCount) * 12}px`,
        fontSize: `${10 + (n.count / maxCount) * 3}px`,
        fontWeight: 600,
      },
    }));
  }, [network]);

  const edges: Edge[] = useMemo(() => {
    if (!network?.edges?.length) return [];
    const maxWeight = Math.max(...network.edges.map((e: any) => e.weight), 1);
    return network.edges.map((e: any) => ({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      style: { stroke: '#4b5568', strokeWidth: 1 + (e.weight / maxWeight) * 3 },
      markerEnd: undefined,
      type: 'default',
    }));
  }, [network]);

  if (!network?.nodes?.length) return null;

  return (
    <div className="rounded-2xl p-6" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#6b7280' }}>
        Réseau de relations entre entités
      </p>
      <div className="h-[400px] rounded-xl overflow-hidden" style={{ background: '#1e2535' }}>
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
      <p className="text-[10px] mt-2" style={{ color: '#4b5568' }}>
        Les entités sont reliées quand elles apparaissent dans un même article enrichi. La taille = fréquence.
      </p>
    </div>
  );
}
