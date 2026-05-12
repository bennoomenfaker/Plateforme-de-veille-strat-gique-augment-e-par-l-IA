import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';

type Filter = 'TOUS' | 'POSITIF' | 'NEGATIF' | 'NEUTRE';

export default function AnalysePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [filter, setFilter] = useState<Filter>('TOUS');
  const [page, setPage] = useState(1);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then(r => r.data),
  });

  const { data: results, isLoading } = useQuery({
    queryKey: ['results-all', projectId, page],
    queryFn: () => api.get(`/analyse/results/${projectId}?page=${page}&limit=20`).then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['stats', projectId],
    queryFn: () => api.get(`/analyse/stats/${projectId}`).then(r => r.data),
  });

  const filtered = results?.data?.filter((r: any) =>
    filter === 'TOUS' || r.sentiment === filter
  ) || [];

  const sentimentStyle = (s: string) => {
    if (s === 'POSITIF') return {background:'rgba(16,185,129,0.1)', color:'#34d399', border:'1px solid rgba(16,185,129,0.2)'};
    if (s === 'NEGATIF') return {background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)'};
    return {background:'rgba(107,114,128,0.1)', color:'#9ca3af', border:'1px solid rgba(107,114,128,0.2)'};
  };

  const trendColor = (t: string) => t === 'HAUSSE' ? '#34d399' : t === 'BAISSE' ? '#f87171' : '#9ca3af';
  const trendIcon = (t: string) => t === 'HAUSSE' ? '↑' : t === 'BAISSE' ? '↓' : '→';

  const statCards = [
    { label: 'TOTAL', value: stats?.total || 0, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', pct: 100 },
    { label: 'POSITIF', value: stats?.POSITIF || 0, color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', pct: stats?.total ? Math.round((stats.POSITIF/stats.total)*100) : 0 },
    { label: 'NÉGATIF', value: stats?.NEGATIF || 0, color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', pct: stats?.total ? Math.round((stats.NEGATIF/stats.total)*100) : 0 },
    { label: 'NEUTRE', value: stats?.NEUTRE || 0, color: '#9ca3af', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)', pct: stats?.total ? Math.round((stats.NEUTRE/stats.total)*100) : 0 },
  ];

  const filters: Filter[] = ['TOUS', 'POSITIF', 'NEGATIF', 'NEUTRE'];

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-1">
          <Link to={`/projects/${projectId}`} className="text-xs font-medium" style={{color:'#6b7280'}}>
            ← Retour au projet
          </Link>
        </div>
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:'#3b82f6'}}>Analyse IA</p>
          <h1 className="text-2xl font-bold text-white">Résultats de la veille</h1>
          <p className="text-sm mt-1" style={{color:'#6b7280'}}>{results?.total || 0} article(s) analysé(s) · {project?.nom}</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {statCards.map(s => (
            <div key={s.label} className="rounded-2xl p-5" style={{background: s.bg, border:`1px solid ${s.border}`}}>
              <p className="text-3xl font-bold mb-1" style={{color: s.color}}>{s.value}</p>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{color: s.color, opacity:0.7}}>{s.label}</p>
              <div className="w-full rounded-full h-1" style={{background:'rgba(255,255,255,0.1)'}}>
                <div className="h-1 rounded-full transition-all" style={{width:`${s.pct}%`, background: s.color}}></div>
              </div>
              <p className="text-xs mt-1.5" style={{color: s.color, opacity:0.6}}>{s.pct}%</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex gap-2 mb-5">
          {filters.map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className="px-4 py-1.5 rounded-xl text-sm font-semibold transition"
              style={filter === f
                ? {background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white'}
                : {background:'#161b27', color:'#6b7280', border:'1px solid #1e2535'}
              }>
              {f === 'TOUS' ? 'Tous' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Liste articles */}
        <div className="rounded-2xl overflow-hidden" style={{background:'#161b27', border:'1px solid #1e2535'}}>
          {isLoading ? (
            <div className="py-16 text-center text-sm" style={{color:'#6b7280'}}>Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-white mb-1">Aucun résultat</p>
              <p className="text-xs" style={{color:'#6b7280'}}>Essayez un autre filtre</p>
            </div>
          ) : (
            filtered.map((r: any, i: number) => (
              <div key={r.id} className="px-6 py-5 transition hover:bg-opacity-50"
                style={{borderBottom: i < filtered.length-1 ? '1px solid #1e2535' : 'none', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)'}}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="text-sm font-semibold text-white leading-snug" style={{flex:1}}>{r.title}</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold" style={{color: trendColor(r.trend)}}>{trendIcon(r.trend)}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={sentimentStyle(r.sentiment)}>
                      {r.sentiment}
                    </span>
                  </div>
                </div>
                {r.summary && (
                  <p className="text-xs leading-relaxed mb-3" style={{color:'#9ca3af'}}>{r.summary}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {r.keywords?.slice(0, 4).map((kw: string) => (
                      <span key={kw} className="text-xs px-2 py-0.5 rounded-md"
                        style={{background:'rgba(59,130,246,0.08)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.12)'}}>
                        {kw}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs" style={{color:'#4b5568'}}>
                    {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {results?.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl text-sm font-medium transition"
              style={{background:'#161b27', color: page===1 ? '#4b5568' : '#9ca3af', border:'1px solid #1e2535'}}>
              Précédent
            </button>
            <span className="text-sm" style={{color:'#6b7280'}}>
              Page {page} / {results?.totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(results?.totalPages, p+1))} disabled={page === results?.totalPages}
              className="px-4 py-2 rounded-xl text-sm font-medium transition"
              style={{background:'#161b27', color: page===results?.totalPages ? '#4b5568' : '#9ca3af', border:'1px solid #1e2535'}}>
              Suivant
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
