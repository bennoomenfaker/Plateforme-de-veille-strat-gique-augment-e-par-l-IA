import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import api, { objectiveService, axisService, hypothesisService } from '../../services/api';

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    
    const [showSourceForm, setShowSourceForm] = useState(false);
    const [sourceForm, setSourceForm] = useState({ name: '', url: '' });
    const [collecting, setCollecting] = useState(false);
    const [analysing, setAnalysing] = useState(false);
    const [collectMsg, setCollectMsg] = useState('');
    const [analyseMsg, setAnalyseMsg] = useState('');
    const [activeTab, setActiveTab] = useState<'veille' | 'cadrage'>('cadrage');

    // --- QUERIES ---
    const { data: project, isLoading } = useQuery({
      queryKey: ['project', id],
      queryFn: () => api.get(`/projects/${id}`).then(r => r.data),
    });

    const { data: sources, refetch: refetchSources } = useQuery({
      queryKey: ['sources', id],
      queryFn: () => api.get(`/sources/project/${id}`).then(r => r.data),
    });

    const { data: results, refetch: refetchResults } = useQuery({
      queryKey: ['results', id],
      queryFn: () => api.get(`/analyse/results/${id}`).then(r => r.data),
    });

    const { data: stats, refetch: refetchStats } = useQuery({
      queryKey: ['stats', id],
      queryFn: () => api.get(`/analyse/stats/${id}`).then(r => r.data),
    });

    // --- MUTATIONS ---
    const deleteObjectiveMutation = useMutation({
      mutationFn: (objId: string) => objectiveService.delete(id!, objId),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
    });

    const deleteAxisMutation = useMutation({
      mutationFn: (axisId: string) => axisService.delete('', axisId),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
    });

    const deleteHypothesisMutation = useMutation({
      mutationFn: (hypId: string) => hypothesisService.delete('', hypId),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
    });

    const addSourceMutation = useMutation({
      mutationFn: (data: any) => api.post('/sources', data),
      onSuccess: () => {
        refetchSources();
        setShowSourceForm(false);
        setSourceForm({ name: '', url: '' });
      },
    });

    // --- HANDLERS ---
    const handleCollect = async () => {
      setCollecting(true); setCollectMsg('');
      try {
        const res = await api.post(`/etl/collect/project/${id}`);
        setCollectMsg(`${res.data.collected} articles collectés`);
        await refetchResults(); await refetchStats();
      } catch { setCollectMsg('Erreur lors de la collecte'); }
      finally { setCollecting(false); }
    };

    const handleAnalyse = async () => {
      setAnalysing(true); setAnalyseMsg('');
      try {
        const res = await api.post(`/analyse/project/${id}`);
        setAnalyseMsg(`${res.data.analysed} articles analysés`);
        await refetchResults(); await refetchStats();
      } catch { setAnalyseMsg('Erreur lors de l analyse'); }
      finally { setAnalysing(false); }
    };

    // --- LOGIQUE DE CALCULS POUR LE DASHBOARD ---
    const objectives = project?.objectives || [];
    const totalAxes = objectives.reduce((acc: number, obj: any) => acc + (obj.axes?.length || 0), 0);
    const totalHypotheses = objectives.reduce((acc: number, obj: any) => 
        acc + (obj.axes?.reduce((a: number, axe: any) => a + (axe.hypotheses?.length || 0), 0) || 0), 0
    );
    const totalPerimeters = project?.perimeters?.length || 0;
    const geoPerimeters = project?.perimeters?.filter((p: any) => p.type === 'GEOGRAPHIC') || [];
    const sectorPerimeters = project?.perimeters?.filter((p: any) => p.type === 'SECTORAL') || [];

    // --- STYLES ---
    const sentimentStyle = (s: string) => {
      if (s === 'POSITIF') return { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' };
      if (s === 'NEGATIF') return { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' };
      return { background: 'rgba(107,114,128,0.1)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.2)' };
    };

    const trendIcon = (t: string) => t === 'HAUSSE' ? '↑' : t === 'BAISSE' ? '↓' : '→';
    const trendColor = (t: string) => t === 'HAUSSE' ? '#34d399' : t === 'BAISSE' ? '#f87171' : '#9ca3af';
    const inputStyle = { background: '#0f1117', border: '1px solid #1e2535', color: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', width: '100%', outline: 'none' };
    const cardStyle = { background: '#161b27', border: '1px solid #1e2535', borderRadius: '1rem' };
    const actionBtnStyle = { color: '#6b7280', padding: '4px', borderRadius: '6px', cursor: 'pointer' };

    if (isLoading) return <Layout><div className="p-8 text-sm" style={{ color: '#6b7280' }}>Chargement...</div></Layout>;

    return (
      <Layout>
        <div className="p-8 max-w-6xl mx-auto">
          {/* Fil d'ariane */}
          <div className="mb-1">
            <Link to="/projects" className="text-xs font-medium" style={{ color: '#6b7280' }}>← Retour aux projets</Link>
          </div>

          {/* Wrapper Flex pour Titre à gauche / Boutons à droite */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{project?.nom}</h1>
              <p className="text-sm" style={{ color: '#6b7280' }}>{project?.description || 'Aucune description'}</p>
              
              {/* Keywords */}
              <div className="flex flex-wrap gap-2 mt-2">
                {project?.keywords?.map((kw: string) => (
                  <span key={kw} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.15)' }}>
                    {kw}
                  </span>
                ))}
              </div>

              {/* Périmètres (pour TypeScript et l'affichage) */}
              <div className="flex flex-wrap gap-2 mt-3">
                {geoPerimeters.map((p: any) => (
                  <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                    style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                    🌍 {p.name || p.value}
                  </span>
                ))}
                {sectorPerimeters.map((p: any) => (
                  <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                    style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                    🏢 {p.name || p.value}
                  </span>
                ))}
              </div>
            </div>

            {/* Bloc Boutons Action (Collecter / Analyser) */}
            <div className="flex gap-3">
              <button onClick={() => navigate(`/projects/new`)}
                className="text-sm font-semibold px-4 py-2 rounded-xl transition"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                + Nouveau projet
              </button>
              
              <div className="flex flex-col items-center">
                <button onClick={handleCollect} disabled={collecting}
                  className="text-sm font-semibold px-4 py-2 rounded-xl transition"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', opacity: collecting ? 0.5 : 1 }}>
                  {collecting ? 'Collecte...' : 'Collecter'}
                </button>
                {collectMsg && <span className="text-[10px] mt-1" style={{ color: collectMsg.includes('Erreur') ? '#f87171' : '#34d399' }}>{collectMsg}</span>}
              </div>

              <div className="flex flex-col items-center">
                <button onClick={handleAnalyse} disabled={analysing}
                  className="text-sm font-semibold px-4 py-2 rounded-xl transition"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white', opacity: analysing ? 0.5 : 1 }}>
                  {analysing ? 'Analyse...' : 'Analyser'}
                </button>
                {analyseMsg && <span className="text-[10px] mt-1" style={{ color: analyseMsg.includes('Erreur') ? '#f87171' : '#34d399' }}>{analyseMsg}</span>}
              </div>
            </div>
          </div>

          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Objectifs', count: objectives.length, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
              { label: 'Axes', count: totalAxes, color: '#a5b4fc', bg: 'rgba(99,102,241,0.1)' },
              { label: 'Hypothèses', count: totalHypotheses, color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
              { label: 'Périmètres', count: totalPerimeters, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' }
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-2xl" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: stat.bg, color: stat.color }}>
                    {stat.count}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6b7280' }}>{stat.label}</p>
                    <p className="text-sm font-semibold text-white">Définis</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Onglets */}
          <div className="flex gap-2 mb-6">
            {[{ key: 'cadrage', label: 'Structure & Cadrage' }, { key: 'veille', label: 'Collecte & Analyse' }].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={activeTab === tab.key
                  ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                  : { background: '#161b27', color: '#6b7280', border: '1px solid #1e2535' }
                }>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Contenu : Cadrage */}
          {activeTab === 'cadrage' && (
            <div className="space-y-4">
              {objectives.length === 0 ? (
                <div className="rounded-2xl py-12 text-center" style={cardStyle}>
                  <p className="text-sm font-medium text-white mb-2">Aucun cadrage défini</p>
                  <button onClick={() => navigate('/projects/new')} className="text-sm font-bold px-5 py-2 rounded-xl text-white" style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>Créer un nouveau projet</button>
                </div>
              ) : (
                objectives.map((obj: any) => (
                  <div key={obj.id} style={cardStyle} className="overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1e2535' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>Objectif {obj.priority}</span>
                        <p className="text-sm font-semibold text-white">{obj.content}</p>
                      </div>
                      <button onClick={() => window.confirm('Supprimer cet objectif ?') && deleteObjectiveMutation.mutate(obj.id)} className="hover:text-red-400" style={actionBtnStyle}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/></svg>
                      </button>
                    </div>
                    {obj.axes?.map((axe: any) => (
                      <div key={axe.id}>
                        <div className="px-8 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1e2535', background: 'rgba(99,102,241,0.03)' }}>
                          <div className="flex items-center gap-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>Axe</span><p className="text-sm font-medium text-white">{axe.name}</p></div>
                          <button onClick={() => window.confirm('Supprimer cet axe ?') && deleteAxisMutation.mutate(axe.id)} className="hover:text-red-400" style={actionBtnStyle}>
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/></svg>
                          </button>
                        </div>
                        {axe.hypotheses?.map((hyp: any) => (
                          <div key={hyp.id} className="px-12 py-3 flex items-start justify-between" style={{ borderBottom: '1px solid #1e2535', background: 'rgba(16,185,129,0.02)' }}>
                            <div className="flex items-start gap-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Hypothèse</span><p className="text-sm text-white">{hyp.content}</p></div>
                            <button onClick={() => window.confirm('Supprimer cette hypothèse ?') && deleteHypothesisMutation.mutate(hyp.id)} className="hover:text-red-400" style={actionBtnStyle}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Contenu : Veille */}
          {activeTab === 'veille' && (
            <div>
              {stats && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[{label:'Total', value: stats.total, color:'#60a5fa', bg:'rgba(59,130,246,0.1)', border:'rgba(59,130,246,0.2)'}, {label:'Positif', value: stats.POSITIF, color:'#34d399', bg:'rgba(16,185,129,0.1)', border:'rgba(16,185,129,0.2)'}, {label:'Négatif', value: stats.NEGATIF, color:'#f87171', bg:'rgba(239,68,68,0.1)', border:'rgba(239,68,68,0.2)'}, {label:'Neutre', value: stats.NEUTRE, color:'#9ca3af', bg:'rgba(107,114,128,0.1)', border:'rgba(107,114,128,0.2)'}].map(s => (
                    <div key={s.label} className="rounded-2xl p-4 text-center" style={{background: s.bg, border:`1px solid ${s.border}`}}><p className="text-2xl font-bold" style={{color: s.color}}>{s.value}</p><p className="text-xs font-medium mt-1" style={{color: s.color, opacity: 0.7}}>{s.label}</p></div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                  <div className="p-4 flex items-center justify-between" style={{borderBottom:'1px solid #1e2535'}}><h2 className="text-sm font-bold text-white">Sources RSS</h2><button onClick={() => setShowSourceForm(true)} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.2)'}}>+ Ajouter</button></div>
                  {showSourceForm && (
                    <div className="p-4" style={{borderBottom:'1px solid #1e2535', background:'rgba(59,130,246,0.05)'}}>
                      <input type="text" value={sourceForm.name} onChange={e => setSourceForm({...sourceForm, name: e.target.value})} style={inputStyle} placeholder="Nom" className="mb-2"/><input type="url" value={sourceForm.url} onChange={e => setSourceForm({...sourceForm, url: e.target.value})} style={inputStyle} placeholder="URL" className="mb-3"/><div className="flex gap-2"><button onClick={() => addSourceMutation.mutate({...sourceForm, projectId: id})} className="flex-1 py-1.5 rounded-lg text-xs font-bold" style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white'}}>Ajouter</button><button onClick={() => setShowSourceForm(false)} className="flex-1 py-1.5 rounded-lg text-xs font-medium" style={{border:'1px solid #1e2535', color:'#9ca3af'}}>Annuler</button></div>
                    </div>
                  )}
                  <div style={{maxHeight:'300px', overflowY:'auto'}}>{!sources || sources.length === 0 ? <p className="p-6 text-xs text-center" style={{color:'#6b7280'}}>Aucune source</p> : sources.map((s: any) => (
                    <div key={s.id} className="px-4 py-3 flex items-center gap-3" style={{borderBottom:'1px solid #1e2535'}}><div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{background:'rgba(59,130,246,0.1)'}}><svg className="w-3.5 h-3.5" style={{color:'#60a5fa'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/></svg></div><div className="min-w-0"><p className="text-xs font-semibold text-white truncate">{s.name}</p><p className="text-xs truncate" style={{color:'#6b7280'}}>{s.url}</p></div></div>
                  ))}</div>
                </div>
                <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={cardStyle}>
                  <div className="p-4 flex items-center justify-between" style={{borderBottom:'1px solid #1e2535'}}><h2 className="text-sm font-bold text-white">Résultats</h2><Link to={`/analyse/${id}`} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.2)'}}>Voir tout →</Link></div>
                  <div style={{maxHeight:'400px', overflowY:'auto'}}>{!results?.data || results.data.length === 0 ? <div className="py-16 text-center"><p className="text-sm" style={{color:'#6b7280'}}>Aucun résultat</p></div> : results.data.slice(0, 10).map((r: any) => (
                    <div key={r.id} className="px-5 py-4" style={{borderBottom:'1px solid #1e2535'}}><div className="flex items-start justify-between gap-3 mb-1.5"><p className="text-sm font-medium text-white leading-snug line-clamp-2" style={{flex:1}}>{r.title}</p><div className="flex items-center gap-1.5 shrink-0"><span className="text-xs font-bold" style={{color: trendColor(r.trend)}}>{trendIcon(r.trend)}</span><span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={sentimentStyle(r.sentiment)}>{r.sentiment}</span></div></div><p className="text-xs line-clamp-1" style={{color:'#6b7280'}}>{r.summary}</p></div>
                  ))}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    );
}
