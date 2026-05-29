import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import api, { objectiveService, axisService, hypothesisService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useOrgRole } from '../../hooks/useOrgRole';

// ─── Types monitoring ─────────────────────────────────────────────────────────
const MONITORING_TYPES = [
  { value: 'TECHNOLOGICAL', label: 'Veille technologique' },
  { value: 'COMPETITIVE',   label: 'Veille concurrentielle' },
  { value: 'REGULATORY',    label: 'Veille réglementaire' },
  { value: 'GEOPOLITICAL',  label: 'Veille géopolitique' },
  { value: 'ECONOMIC',      label: 'Veille économique' },
  { value: 'SCIENTIFIC',    label: 'Veille scientifique' },
  { value: 'CYBERSECURITY', label: 'Veille cybersécurité' },
];

const MONITORING_LABELS: Record<string, string> = Object.fromEntries(
  MONITORING_TYPES.map(t => [t.value, t.label])
);

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { user } = useAuth();
  const { canWrite } = useOrgRole();
  const canCreateOrModify = user?.type_utilisateur === 'INDIVIDUEL' || canWrite;

  const [analysing, setAnalysing]   = useState(false);
  const [analyseMsg, setAnalyseMsg] = useState('');
  const [activeTab, setActiveTab]   = useState<'veille' | 'cadrage'>('cadrage');

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    nom: '',
    description: '',
    monitoring_type: 'TECHNOLOGICAL',
    frequency: 'DAILY',
  });

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => r.data),
  });

  const { data: results, refetch: refetchResults } = useQuery({
    queryKey: ['results', id],
    queryFn: () => api.get(`/analyse/results/${id}`).then(r => r.data),
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['stats', id],
    queryFn: () => api.get(`/analyse/stats/${id}`).then(r => r.data),
  });

  useEffect(() => {
    if (project) {
      setEditForm({
        nom:             project.nom             || '',
        description:     project.description     || '',
        monitoring_type: project.monitoring_type || 'TECHNOLOGICAL',
        frequency:       project.frequency       || 'DAILY',
      });
    }
  }, [project]);

  // ── Mutations ────────────────────────────────────────────────────────────────
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

  const updateProjectMutation = useMutation({
    mutationFn: (data: typeof editForm) =>
      api.put(`/projects/${id}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowEditModal(false);
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAnalyse = async () => {
    setAnalysing(true); setAnalyseMsg('');
    try {
      const res = await api.post(`/analyse/project/${id}`);
      const msg = res.data.message || `${res.data.pending_enrichment ?? 0} item(s) en attente`;
      setAnalyseMsg(msg);
      await refetchResults();
      await refetchStats();
    } catch {
      setAnalyseMsg('Erreur lors de la vérification');
    } finally {
      setAnalysing(false);
    }
  };

  // ── Calculs ──────────────────────────────────────────────────────────────────
  const objectives      = project?.objectives || [];
  const totalAxes       = objectives.reduce((acc: number, obj: any) => acc + (obj.axes?.length || 0), 0);
  const totalHypotheses = objectives.reduce((acc: number, obj: any) =>
    acc + (obj.axes?.reduce((a: number, axe: any) => a + (axe.hypotheses?.length || 0), 0) || 0), 0
  );
  const totalPerimeters  = project?.perimeters?.length || 0;
  const geoPerimeters    = project?.perimeters?.filter((p: any) => p.type === 'GEOGRAPHIC') || [];
  const sectorPerimeters = project?.perimeters?.filter((p: any) => p.type === 'SECTORAL')   || [];

  // ── Styles helpers ───────────────────────────────────────────────────────────
  const sentimentStyle = (s: string) => {
    if (s === 'POSITIF') return { background: 'rgba(16,185,129,0.1)',  color: '#34d399', border: '1px solid rgba(16,185,129,0.2)'  };
    if (s === 'NEGATIF') return { background: 'rgba(239,68,68,0.1)',   color: '#f87171', border: '1px solid rgba(239,68,68,0.2)'   };
    return                       { background: 'rgba(107,114,128,0.1)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.2)' };
  };

  const trendIcon  = (t: string) => t === 'HAUSSE' ? '↑' : t === 'BAISSE' ? '↓' : '→';
  const trendColor = (t: string) => t === 'HAUSSE' ? '#34d399' : t === 'BAISSE' ? '#f87171' : '#9ca3af';

  const cardStyle      = { background: '#161b27', border: '1px solid #1e2535', borderRadius: '1rem' };
  const actionBtnStyle = { color: '#6b7280', padding: '4px', borderRadius: '6px', cursor: 'pointer' };
  const inputStyle     = {
    background: '#0f1117', border: '1px solid #1e2535',
    color: 'white', borderRadius: '0.75rem',
    padding: '0.625rem 1rem', fontSize: '0.875rem',
    width: '100%', outline: 'none',
  };

  if (isLoading) return (
    <Layout>
      <div className="p-8 text-sm" style={{ color: '#6b7280' }}>Chargement...</div>
    </Layout>
  );

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">

        {/* Fil d'ariane */}
        <div className="mb-1">
          <Link to="/projects" className="text-xs font-medium" style={{ color: '#6b7280' }}>
            ← Retour aux projets
          </Link>
        </div>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{project?.nom}</h1>
              {project?.monitoring_type && (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
                  {MONITORING_LABELS[project.monitoring_type] || project.monitoring_type}
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              {project?.description || 'Aucune description'}
            </p>

            {/* Keywords */}
            <div className="flex flex-wrap gap-2 mt-2">
              {project?.keywords?.map((kw: string) => (
                <span key={kw} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.15)' }}>
                  {kw}
                </span>
              ))}
            </div>

            {/* Périmètres */}
            <div className="flex flex-wrap gap-2 mt-3">
              {geoPerimeters.map((p: any) => (
                <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                  style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                  {p.name || p.value}
                </span>
              ))}
              {sectorPerimeters.map((p: any) => (
                <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                  style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                  {p.name || p.value}
                </span>
              ))}
            </div>
          </div>

          {/* ── Boutons action ──────────────────────────────────────────────── */}
          <div className="flex gap-3 items-start flex-wrap justify-end">

            {/* Bouton Modifier projet */}
            {canCreateOrModify && <button
              onClick={() => setShowEditModal(true)}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{ border: '1px solid #1e2535', color: '#9ca3af' }}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Modifier
              </span>
            </button>}

            {/* Nouveau projet */}
            <button
              onClick={() => navigate('/projects/new')}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              + Nouveau projet
            </button>

            {/* Données brutes — Sprint 3 */}
            <Link
              to={`/projects/${id}/raw-items`}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              Données brutes
            </Link>

            {/* ── SPRINT 4 — Bouton Données nettoyées ── */}
            <Link
              to={`/projects/${id}/processed`}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{
                background: 'rgba(167,139,250,0.15)',
                color: '#a78bfa',
                border: '1px solid rgba(167,139,250,0.3)',
              }}
            >
              Données nettoyées
            </Link>

            {/* Sprint 5 — Enrichissement IA */}
        <Link
          to={`/projects/${id}/enriched`}
          className="text-sm font-semibold px-4 py-2 rounded-xl transition"
          style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}
        >
          Enrichissement IA
        </Link>

        {/* Sprint 6 — Dashboard */}
        <Link
          to={`/projects/${id}/insights`}
          className="text-sm font-semibold px-4 py-2 rounded-xl transition"
          style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}
        >
          Dashboard insights
        </Link>

        {/* Sprint 7 — Analyse */}
        <Link
          to={`/analyse/${id}`}
          className="text-sm font-semibold px-4 py-2 rounded-xl transition"
          style={{ background: "rgba(34,211,238,0.15)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)" }}
        >
          Analyse stratégique
        </Link>

        {/* Vérifier pipeline IA */}
            {canCreateOrModify && (
              <div className="flex flex-col items-center">
                <button
                  onClick={handleAnalyse}
                  disabled={analysing}
                  className="text-sm font-semibold px-4 py-2 rounded-xl transition"
                  style={{
                    background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                    color: 'white',
                    opacity: analysing ? 0.5 : 1,
                  }}
                >
                  {analysing ? 'Vérification...' : 'Vérifier pipeline IA'}
                </button>
                {analyseMsg && (
                  <span className="text-[10px] mt-1"
                    style={{ color: analyseMsg.includes('Erreur') ? '#f87171' : '#34d399' }}>
                    {analyseMsg}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Modifier projet */}
        {showEditModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          >
            <div className="w-full max-w-lg rounded-2xl overflow-hidden"
              style={{ background: '#161b27', border: '1px solid #1e2535' }}>

              <div className="px-6 py-5 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg,#1d4ed8,#4f46e5)' }}>
                <div>
                  <h2 className="text-base font-bold text-white">Modifier le projet</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Mettez à jour les paramètres du projet
                  </p>
                </div>
                <button onClick={() => setShowEditModal(false)} style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: '#9ca3af' }}>Nom du projet *</label>
                  <input
                    value={editForm.nom}
                    onChange={e => setEditForm({ ...editForm, nom: e.target.value })}
                    style={inputStyle}
                    placeholder="Nom du projet"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: '#9ca3af' }}>Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    style={{ ...inputStyle, resize: 'none' } as React.CSSProperties}
                    placeholder="Description du projet..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                      style={{ color: '#9ca3af' }}>Type de veille</label>
                    <select
                      value={editForm.monitoring_type}
                      onChange={e => setEditForm({ ...editForm, monitoring_type: e.target.value })}
                      style={inputStyle}
                    >
                      {MONITORING_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                      style={{ color: '#9ca3af' }}>Fréquence</label>
                    <select
                      value={editForm.frequency}
                      onChange={e => setEditForm({ ...editForm, frequency: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="ON_DEMAND">À la demande</option>
                      <option value="DAILY">Quotidienne</option>
                      <option value="WEEKLY">Hebdomadaire</option>
                      <option value="MONTHLY">Mensuelle</option>
                    </select>
                  </div>
                </div>

                {updateProjectMutation.isError && (
                  <div className="rounded-xl p-3 text-xs"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Erreur lors de la mise à jour du projet
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                    style={{ border: '1px solid #1e2535', color: '#9ca3af' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => updateProjectMutation.mutate(editForm)}
                    disabled={updateProjectMutation.isPending || !editForm.nom.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{
                      background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                      opacity: updateProjectMutation.isPending || !editForm.nom.trim() ? 0.5 : 1,
                    }}
                  >
                    {updateProjectMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Objectifs',  count: objectives.length, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
            { label: 'Axes',       count: totalAxes,         color: '#a5b4fc', bg: 'rgba(99,102,241,0.1)'  },
            { label: 'Hypothèses', count: totalHypotheses,   color: '#34d399', bg: 'rgba(16,185,129,0.1)'  },
            { label: 'Périmètres', count: totalPerimeters,   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-2xl"
              style={{ background: '#161b27', border: '1px solid #1e2535' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                  style={{ background: stat.bg, color: stat.color }}>
                  {stat.count}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: '#6b7280' }}>{stat.label}</p>
                  <p className="text-sm font-semibold text-white">Définis</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Onglets ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'cadrage', label: 'Structure & Cadrage' },
            { key: 'veille',  label: 'Collecte & Analyse'  },
          ].map(tab => (
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

        {/* ── TAB : CADRAGE ───────────────────────────────────────────────────── */}
        {activeTab === 'cadrage' && (
          <div className="space-y-4">
            {objectives.length === 0 ? (
              <div className="rounded-2xl py-12 text-center" style={cardStyle}>
                <p className="text-sm font-medium text-white mb-2">Aucun cadrage défini</p>
                <button onClick={() => navigate('/projects/new')}
                  className="text-sm font-bold px-5 py-2 rounded-xl text-white"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                  Créer un nouveau projet
                </button>
              </div>
            ) : (
              objectives.map((obj: any) => (
                <div key={obj.id} style={cardStyle} className="overflow-hidden">
                  {/* Objectif */}
                  <div className="px-5 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid #1e2535' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                        Objectif {obj.priority}
                      </span>
                      <p className="text-sm font-semibold text-white">{obj.content}</p>
                    </div>
                    {canCreateOrModify && <button
                      onClick={() => window.confirm('Supprimer cet objectif ?') && deleteObjectiveMutation.mutate(obj.id)}
                      className="hover:text-red-400"
                      style={actionBtnStyle}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>}
                  </div>

                  {/* Axes */}
                  {obj.axes?.map((axe: any) => (
                    <div key={axe.id}>
                      <div className="px-8 py-3 flex items-center justify-between"
                        style={{ borderBottom: '1px solid #1e2535', background: 'rgba(99,102,241,0.03)' }}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>Axe</span>
                          <p className="text-sm font-medium text-white">{axe.name}</p>
                        </div>
                        <button
                          onClick={() => window.confirm('Supprimer cet axe ?') && deleteAxisMutation.mutate(axe.id)}
                          className="hover:text-red-400"
                          style={actionBtnStyle}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* Hypothèses */}
                      {axe.hypotheses?.map((hyp: any) => (
                        <div key={hyp.id} className="px-12 py-3 flex items-start justify-between"
                          style={{ borderBottom: '1px solid #1e2535', background: 'rgba(16,185,129,0.02)' }}>
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5"
                              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                              Hypothèse
                            </span>
                            <p className="text-sm text-white">{hyp.content}</p>
                          </div>
                          <button
                            onClick={() => window.confirm('Supprimer cette hypothèse ?') && deleteHypothesisMutation.mutate(hyp.id)}
                            className="hover:text-red-400"
                            style={actionBtnStyle}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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

        {/* ── TAB : VEILLE ────────────────────────────────────────────────────── */}
        {activeTab === 'veille' && (
          <div className="space-y-6">

            {/* Stats analyse */}
            {stats && (
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total',   value: stats.total,   color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)'  },
                  { label: 'Positif', value: stats.POSITIF, color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)'  },
                  { label: 'Négatif', value: stats.NEGATIF, color: '#f87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)'   },
                  { label: 'Neutre',  value: stats.NEUTRE,  color: '#9ca3af', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-4 text-center"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value || 0}</p>
                    <p className="text-xs font-medium mt-1" style={{ color: s.color, opacity: 0.7 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Lien données brutes — Sprint 3 */}
            <div className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: '#161b27', border: '1px solid #1e2535' }}>
              <div>
                <p className="text-sm font-semibold text-white">Données brutes collectées</p>
                <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                  Voir tous les raw items collectés par les plans de collecte
                </p>
              </div>
              <Link to={`/projects/${id}/raw-items`}
                className="text-sm font-bold px-4 py-2 rounded-xl transition"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }}>
                Voir les données →
              </Link>
            </div>

            {/* ── SPRINT 4 — Lien données nettoyées ── */}
            <div className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: '#161b27', border: '1px solid #1e2535' }}>
              <div>
                <p className="text-sm font-semibold text-white">Données nettoyées</p>
                <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                  Contenu extrait, langue détectée, bruit supprimé — prêt pour l'IA
                </p>
              </div>
              <Link
                to={`/projects/${id}/processed`}
                className="text-sm font-bold px-4 py-2 rounded-xl transition"
                style={{
                  background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                  color: 'white',
                }}
              >
                Voir les données →
              </Link>
            </div>

            {/* Plans de collecte */}
            <div style={cardStyle} className="overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #1e2535' }}>
                <h2 className="text-sm font-bold text-white">Plans de collecte</h2>
                <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                  Cliquez sur un plan pour le gérer (jobs, données, upload PDF)
                </p>
              </div>

              {objectives.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm" style={{ color: '#6b7280' }}>Aucun plan de collecte configuré</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {objectives.map((obj: any) => (
                    <div key={obj.id}>
                      <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#60a5fa' }}>
                        {obj.content?.substring(0, 60)}{obj.content?.length > 60 ? '...' : ''}
                      </p>
                      {obj.axes?.map((axe: any) => (
                        <div key={axe.id} className="ml-4 mb-3">
                          <p className="text-xs font-semibold mb-2" style={{ color: '#a5b4fc' }}>
                            ↳ {axe.name}
                          </p>
                          {axe.hypotheses?.map((hyp: any) => (
                            <div key={hyp.id} className="ml-4 mb-2">
                              <p className="text-xs font-medium mb-2" style={{ color: '#34d399' }}>
                                {hyp.content?.substring(0, 70)}{hyp.content?.length > 70 ? '...' : ''}
                              </p>
                              {hyp.collection_plans && hyp.collection_plans.length > 0 ? (
                                <div className="space-y-1.5 ml-4">
                                  {hyp.collection_plans.map((plan: any) => (
                                    <Link key={plan.id} to={`/projects/${id}/plans/${plan.id}`}
                                      className="flex items-center justify-between px-4 py-3 rounded-xl transition group"
                                      style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
                                          style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                                          PLAN
                                        </span>
                                        <p className="text-xs font-medium text-white truncate group-hover:text-blue-400 transition">
                                          {plan.question}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 ml-3">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                                          style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                                          {plan.frequency}
                                        </span>
                                        <span className="text-[10px]" style={{ color: '#60a5fa' }}>→</span>
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              ) : (
                                <p className="ml-4 text-[10px]" style={{ color: '#4b5568' }}>
                                  Aucun plan de collecte pour cette hypothèse
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Résultats analyse */}
            <div className="rounded-2xl overflow-hidden" style={cardStyle}>
              <div className="p-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid #1e2535' }}>
                <h2 className="text-sm font-bold text-white">Résultats d'analyse</h2>
                <Link to={`/analyse/${id}`}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                  Voir tout →
                </Link>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {!results?.data || results.data.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-sm" style={{ color: '#6b7280' }}>Aucun résultat d'analyse</p>
                  </div>
                ) : (
                  results.data.slice(0, 10).map((r: any) => (
                    <div key={r.id} className="px-5 py-4" style={{ borderBottom: '1px solid #1e2535' }}>
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <p className="text-sm font-medium text-white leading-snug line-clamp-2" style={{ flex: 1 }}>
                          {r.title ?? r.processed_item?.title ?? 'Sans titre'}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {r.sentiment && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={sentimentStyle(r.sentiment)}>
                              {r.sentiment}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs line-clamp-2" style={{ color: '#6b7280' }}>
                        {r.summary ?? r.answer ?? '—'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </Layout>
  );
}
