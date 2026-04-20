import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceForm, setSourceForm] = useState({ name: '', url: '' });
  const [collecting, setCollecting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [collectMsg, setCollectMsg] = useState('');
  const [analyseMsg, setAnalyseMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'veille'|'cadrage'>('cadrage');

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

  const addSourceMutation = useMutation({
    mutationFn: (data: any) => api.post('/sources', data),
    onSuccess: () => {
      refetchSources();
      setShowSourceForm(false);
      setSourceForm({ name: '', url: '' });
    },
  });

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

  const sentimentStyle = (s: string) => {
    if (s === 'POSITIF') return {background:'rgba(16,185,129,0.1)', color:'#34d399', border:'1px solid rgba(16,185,129,0.2)'};
    if (s === 'NEGATIF') return {background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)'};
    return {background:'rgba(107,114,128,0.1)', color:'#9ca3af', border:'1px solid rgba(107,114,128,0.2)'};
  };

  const trendIcon = (t: string) => t === 'HAUSSE' ? '↑' : t === 'BAISSE' ? '↓' : '→';
  const trendColor = (t: string) => t === 'HAUSSE' ? '#34d399' : t === 'BAISSE' ? '#f87171' : '#9ca3af';
  const inputStyle = {background:'#0f1117', border:'1px solid #1e2535', color:'white', borderRadius:'0.5rem', padding:'0.5rem 0.75rem', fontSize:'0.8125rem', width:'100%', outline:'none'};
  const cardStyle = {background:'#161b27', border:'1px solid #1e2535', borderRadius:'1rem'};

  if (isLoading) return <Layout><div className="p-8 text-sm" style={{color:'#6b7280'}}>Chargement...</div></Layout>;

  const objectives = project?.objectives || [];

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-1">
          <Link to="/projects" className="text-xs font-medium" style={{color:'#6b7280'}}>← Retour aux projets</Link>
        </div>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">{project?.nom}</h1>
            <p className="text-sm" style={{color:'#6b7280'}}>{project?.description || 'Aucune description'}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {project?.keywords?.map((kw: string) => (
                <span key={kw} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{background:'rgba(59,130,246,0.1)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.15)'}}>
                  {kw}
                </span>
              ))}
            </div>
            <div className="flex gap-3 mt-2">
              {project?.veille_type && (
                <span className="text-xs px-2 py-0.5 rounded" style={{background:'rgba(99,102,241,0.1)', color:'#a5b4fc'}}>
                  {project.veille_type}
                </span>
              )}
              {project?.start_date && (
                <span className="text-xs" style={{color:'#6b7280'}}>
                  {new Date(project.start_date).toLocaleDateString('fr-FR')} → {project?.end_date ? new Date(project.end_date).toLocaleDateString('fr-FR') : '...'}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate(`/projects/new`)}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.2)'}}>
              + Nouveau projet
            </button>
            <button onClick={handleCollect} disabled={collecting}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{background:'rgba(99,102,241,0.15)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.3)', opacity: collecting ? 0.5 : 1}}>
              {collecting ? 'Collecte...' : 'Collecter'}
            </button>
            <button onClick={handleAnalyse} disabled={analysing}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white', opacity: analysing ? 0.5 : 1}}>
              {analysing ? 'Analyse...' : 'Analyser'}
            </button>
          </div>
        </div>

        {/* Messages */}
        {(collectMsg || analyseMsg) && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {collectMsg && <div className="px-4 py-2.5 rounded-xl text-xs font-medium" style={{background:'rgba(99,102,241,0.1)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.2)'}}>Collecte — {collectMsg}</div>}
            {analyseMsg && <div className="px-4 py-2.5 rounded-xl text-xs font-medium" style={{background:'rgba(59,130,246,0.1)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.2)'}}>Analyse — {analyseMsg}</div>}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[{key:'cadrage', label:'Structure & Cadrage'}, {key:'veille', label:'Collecte & Analyse'}].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={activeTab === tab.key
                ? {background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white'}
                : {background:'#161b27', color:'#6b7280', border:'1px solid #1e2535'}
              }>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CADRAGE */}
        {activeTab === 'cadrage' && (
          <div className="space-y-4">
            {objectives.length === 0 ? (
              <div className="rounded-2xl py-12 text-center" style={cardStyle}>
                <p className="text-sm font-medium text-white mb-2">Aucun cadrage défini</p>
                <p className="text-xs mb-4" style={{color:'#6b7280'}}>Ce projet n'a pas encore d'objectifs, axes ou hypothèses</p>
                <button onClick={() => navigate('/projects/new')}
                  className="text-sm font-bold px-5 py-2 rounded-xl text-white"
                  style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)'}}>
                  Créer un nouveau projet avec wizard
                </button>
              </div>
            ) : (
              objectives.map((obj: any) => (
                <div key={obj.id} style={cardStyle} className="overflow-hidden">
                  {/* Objectif */}
                  <div className="px-5 py-4" style={{borderBottom:'1px solid #1e2535'}}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{background:'rgba(59,130,246,0.15)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.2)'}}>
                        Objectif {obj.priority}
                      </span>
                      <p className="text-sm font-semibold text-white">{obj.content}</p>
                    </div>
                  </div>

                  {/* Axes */}
                  {obj.axes?.map((axe: any) => (
                    <div key={axe.id}>
                      <div className="px-8 py-3" style={{borderBottom:'1px solid #1e2535', background:'rgba(99,102,241,0.03)'}}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                            style={{background:'rgba(99,102,241,0.15)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.2)'}}>
                            Axe
                          </span>
                          <p className="text-sm font-medium text-white">{axe.name}</p>
                          {axe.description && <p className="text-xs" style={{color:'#6b7280'}}>— {axe.description}</p>}
                        </div>
                      </div>

                      {/* Hypothèses */}
                      {axe.hypotheses?.map((hyp: any) => (
                        <div key={hyp.id}>
                          <div className="px-12 py-3" style={{borderBottom:'1px solid #1e2535', background:'rgba(16,185,129,0.02)'}}>
                            <div className="flex items-start gap-3">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                                style={{background:'rgba(16,185,129,0.15)', color:'#34d399', border:'1px solid rgba(16,185,129,0.2)'}}>
                                Hypothèse
                              </span>
                              <div className="flex-1">
                                <p className="text-sm text-white">{hyp.content}</p>

                                {/* Collection Plans */}
                                {hyp.collection_plans?.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {hyp.collection_plans.map((plan: any) => (
                                      <div key={plan.id} className="rounded-xl p-3" style={{background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.1)'}}>
                                        <div className="flex items-center justify-between mb-2">
                                          <p className="text-xs font-semibold" style={{color:'#60a5fa'}}>Plan de collecte</p>
                                          <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(59,130,246,0.1)', color:'#93c5fd'}}>
                                            {plan.frequency}
                                          </span>
                                        </div>
                                        <p className="text-xs text-white mb-2">{plan.question}</p>
                                        <div className="flex gap-4 text-xs" style={{color:'#6b7280'}}>
                                          <span>{plan.sources?.length || 0} source(s)</span>
                                          <span>{plan.keywords?.length || 0} mot(s)-clé(s)</span>
                                          {plan.collection_start_date && (
                                            <span>{new Date(plan.collection_start_date).toLocaleDateString('fr-FR')} → {plan.collection_end_date ? new Date(plan.collection_end_date).toLocaleDateString('fr-FR') : '...'}</span>
                                          )}
                                        </div>
                                        {/* Sources liste */}
                                        {plan.sources?.length > 0 && (
                                          <div className="mt-2 flex flex-wrap gap-1.5">
                                            {plan.sources.map((src: any) => (
                                              <span key={src.id} className="text-xs px-2 py-0.5 rounded" style={{background:'rgba(251,146,60,0.1)', color:'#fb923c', border:'1px solid rgba(251,146,60,0.15)'}}>
                                                {src.source_type} — {src.source_label}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        {/* Keywords liste */}
                                        {plan.keywords?.length > 0 && (
                                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            {plan.keywords.map((kw: any) => (
                                              <span key={kw.id} className="text-xs px-2 py-0.5 rounded" style={{background:'rgba(139,92,246,0.1)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.15)'}}>
                                                {kw.keyword}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}

            {/* Périmètres */}
            {project?.perimeters?.length > 0 && (
              <div style={cardStyle} className="overflow-hidden">
                <div className="px-5 py-4" style={{borderBottom:'1px solid #1e2535'}}>
                  <h3 className="text-sm font-bold text-white">Périmètres</h3>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {project.perimeters.map((p: any) => (
                    <div key={p.id}>
                      <span className="text-xs px-3 py-1 rounded-full font-medium"
                        style={p.type === 'GEOGRAPHIC'
                          ? {background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.2)'}
                          : {background:'rgba(139,92,246,0.1)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.2)'}
                        }>
                        {p.type === 'GEOGRAPHIC' ? '🌍' : '🏭'} {p.name}
                      </span>
                      {p.children?.map((child: any) => (
                        <span key={child.id} className="ml-2 text-xs px-2 py-0.5 rounded" style={{background:'#1e2535', color:'#9ca3af'}}>
                          └ {child.name}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB VEILLE */}
        {activeTab === 'veille' && (
          <div>
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  {label:'Total', value: stats.total, color:'#60a5fa', bg:'rgba(59,130,246,0.1)', border:'rgba(59,130,246,0.2)'},
                  {label:'Positif', value: stats.POSITIF, color:'#34d399', bg:'rgba(16,185,129,0.1)', border:'rgba(16,185,129,0.2)'},
                  {label:'Négatif', value: stats.NEGATIF, color:'#f87171', bg:'rgba(239,68,68,0.1)', border:'rgba(239,68,68,0.2)'},
                  {label:'Neutre', value: stats.NEUTRE, color:'#9ca3af', bg:'rgba(107,114,128,0.1)', border:'rgba(107,114,128,0.2)'},
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-4 text-center" style={{background: s.bg, border:`1px solid ${s.border}`}}>
                    <p className="text-2xl font-bold" style={{color: s.color}}>{s.value}</p>
                    <p className="text-xs font-medium mt-1" style={{color: s.color, opacity: 0.7}}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Sources RSS */}
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                <div className="p-4 flex items-center justify-between" style={{borderBottom:'1px solid #1e2535'}}>
                  <h2 className="text-sm font-bold text-white">Sources RSS</h2>
                  <button onClick={() => setShowSourceForm(true)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.2)'}}>
                    + Ajouter
                  </button>
                </div>
                {showSourceForm && (
                  <div className="p-4" style={{borderBottom:'1px solid #1e2535', background:'rgba(59,130,246,0.05)'}}>
                    <input type="text" value={sourceForm.name} onChange={e => setSourceForm({...sourceForm, name: e.target.value})} style={inputStyle} placeholder="Nom de la source" className="mb-2"/>
                    <input type="url" value={sourceForm.url} onChange={e => setSourceForm({...sourceForm, url: e.target.value})} style={inputStyle} placeholder="URL du flux RSS" className="mb-3"/>
                    <div className="flex gap-2">
                      <button onClick={() => addSourceMutation.mutate({...sourceForm, projectId: id})} className="flex-1 py-1.5 rounded-lg text-xs font-bold" style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white'}}>Ajouter</button>
                      <button onClick={() => setShowSourceForm(false)} className="flex-1 py-1.5 rounded-lg text-xs font-medium" style={{border:'1px solid #1e2535', color:'#9ca3af'}}>Annuler</button>
                    </div>
                  </div>
                )}
                <div>
                  {!sources || sources.length === 0 ? (
                    <p className="p-6 text-xs text-center" style={{color:'#6b7280'}}>Aucune source RSS</p>
                  ) : (
                    sources.map((s: any) => (
                      <div key={s.id} className="px-4 py-3 flex items-center gap-3" style={{borderBottom:'1px solid #1e2535'}}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{background:'rgba(59,130,246,0.1)'}}>
                          <svg className="w-3.5 h-3.5" style={{color:'#60a5fa'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z"/>
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{s.name}</p>
                          <p className="text-xs truncate" style={{color:'#6b7280'}}>{s.url}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Résultats */}
              <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={cardStyle}>
                <div className="p-4 flex items-center justify-between" style={{borderBottom:'1px solid #1e2535'}}>
                  <h2 className="text-sm font-bold text-white">Résultats de la veille</h2>
                  <Link to={`/analyse/${id}`} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.2)'}}>
                    Voir tout →
                  </Link>
                </div>
                <div style={{maxHeight:'400px', overflowY:'auto'}}>
                  {!results?.data || results.data.length === 0 ? (
                    <div className="py-16 text-center">
                      <p className="text-sm" style={{color:'#6b7280'}}>Aucun résultat</p>
                      <p className="text-xs mt-1" style={{color:'#4b5568'}}>Lancez la collecte puis l'analyse</p>
                    </div>
                  ) : (
                    results.data.slice(0, 10).map((r: any) => (
                      <div key={r.id} className="px-5 py-4" style={{borderBottom:'1px solid #1e2535'}}>
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <p className="text-sm font-medium text-white leading-snug line-clamp-2" style={{flex:1}}>{r.title}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-bold" style={{color: trendColor(r.trend)}}>{trendIcon(r.trend)}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={sentimentStyle(r.sentiment)}>{r.sentiment}</span>
                          </div>
                        </div>
                        <p className="text-xs line-clamp-1" style={{color:'#6b7280'}}>{r.summary}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
