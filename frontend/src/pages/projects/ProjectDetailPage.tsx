/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import api, { objectiveService, axisService, hypothesisService, projectsService } from '../../services/api';
import SuggestionPanel from '../../components/ai/SuggestionPanel';
import ProjectCopilot from '../../components/ai/ProjectCopilot';
import { useAuth } from '../../context/AuthContext';
import { useOrgRole } from '../../hooks/useOrgRole';

// ─── Types monitoring ─────────────────────────────────────────────────────────
const MONITORING_TYPES = [
  { value: 'STRATEGIC',        label: 'Veille stratégique' },
  { value: 'COMPETITIVE',      label: 'Veille concurrentielle' },
  { value: 'SECTORAL',         label: 'Veille sectorielle' },
  { value: 'COMMERCIAL',       label: 'Veille commerciale' },
  { value: 'CUSTOMER',         label: 'Veille client' },
  { value: 'PRODUCT',          label: 'Veille produit' },
  { value: 'TECHNOLOGICAL',    label: 'Veille technologique' },
  { value: 'INNOVATION',       label: 'Veille innovation' },
  { value: 'SCIENTIFIC',       label: 'Veille scientifique' },
  { value: 'REGULATORY_LEGAL', label: 'Veille réglementaire & juridique' },
  { value: 'STANDARDIZATION',  label: 'Veille normative' },
  { value: 'ENVIRONMENTAL',    label: 'Veille environnementale & écologique' },
  { value: 'ECONOMIC',         label: 'Veille économique' },
  { value: 'SOCIETAL',         label: 'Veille sociétale' },
  { value: 'POLITICAL',        label: 'Veille politique' },
  { value: 'GEOPOLITICAL',     label: 'Veille géopolitique' },
  { value: 'REPUTATION',       label: 'Veille réputation & image de marque' },
  { value: 'MEDIA_PRESS',      label: 'Veille médias & presse' },
  { value: 'SOCIAL_MEDIA',     label: 'Veille social media / social listening' },
  { value: 'ORGANIZATIONAL',   label: 'Veille organisationnelle (RH, talents, compétences)' },
  { value: 'SUPPLY_CHAIN',     label: 'Veille supply chain / fournisseurs' },
  { value: 'CYBERSECURITY',    label: 'Veille cybersécurité / sécurité de l\'information' },
];

const MONITORING_LABELS: Record<string, string> = Object.fromEntries(
  MONITORING_TYPES.map(t => [t.value, t.label])
);

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { user } = useAuth();
  const { canWrite, role } = useOrgRole();
  const canCreateOrModify = (user?.type_utilisateur === 'INDIVIDUEL' && !role) || canWrite;

  const [analysing, setAnalysing]   = useState(false);
  const [analyseMsg, setAnalyseMsg] = useState('');
  const [activeTab, setActiveTab]   = useState<'veille' | 'cadrage' | 'suivi'>('cadrage');
  const [expandedObjectives, setExpandedObjectives] = useState<Record<string, boolean>>({});
  const [expandedAxes, setExpandedAxes] = useState<Record<string, boolean>>({});
  const [expandedHypotheses, setExpandedHypotheses] = useState<Record<string, boolean>>({});
  const [editingItem, setEditingItem] = useState<{ type: 'objective' | 'axis' | 'hypothesis'; id: string; parentId: string; value: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editAxisDescription, setEditAxisDescription] = useState('');

  const [showNewObjective, setShowNewObjective] = useState(false);
  const [newObjectiveContent, setNewObjectiveContent] = useState('');
  const [newAxisObjectiveId, setNewAxisObjectiveId] = useState<string | null>(null);
  const [newAxisName, setNewAxisName] = useState('');
  const [newAxisDescription, setNewAxisDescription] = useState('');

  const [newHypothesisAxisId, setNewHypothesisAxisId] = useState<string | null>(null);
  const [newHypothesisContent, setNewHypothesisContent] = useState('');

  const [newPlanHypothesisId, setNewPlanHypothesisId] = useState<string | null>(null);
  const [newPlanQuestion, setNewPlanQuestion] = useState('');
  const [newPlanFrequency, setNewPlanFrequency] = useState('ON_DEMAND');

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    nom: '',
    description: '',
    problematique: '',
    monitoring_type: 'STRATEGIC',
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

  const { data: evaluations } = useQuery({
    queryKey: ['hypothesis-evaluations', id],
    queryFn: () => api.get(`/projects/${id}/hypothesis-evaluations`).then(r => r.data),
  });

  useEffect(() => {
    if (project) {
      setEditForm({
        nom:             project.nom             || '',
        description:     project.description     || '',
        problematique:   project.problematique   || '',
        monitoring_type: project.monitoring_type || 'TECHNOLOGICAL',
      });
    }
  }, [project]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const deleteObjectiveMutation = useMutation({
    mutationFn: (objId: string) => objectiveService.delete(id!, objId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  const deleteAxisMutation = useMutation({
    mutationFn: ({ objectiveId, axisId }: { objectiveId: string; axisId: string }) =>
      axisService.delete(objectiveId, axisId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  const deleteHypothesisMutation = useMutation({
    mutationFn: ({ axisId, hypId }: { axisId: string; hypId: string }) =>
      hypothesisService.delete(axisId, hypId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: ({ objId, data }: { objId: string; data: any }) =>
      objectiveService.update(id!, objId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setEditingItem(null);
    },
  });

  const updateAxisMutation = useMutation({
    mutationFn: ({ objectiveId, axisId, data }: { objectiveId: string; axisId: string; data: any }) =>
      axisService.update(objectiveId, axisId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setEditingItem(null);
    },
  });

  const createObjectiveMutation = useMutation({
    mutationFn: (content: string) => objectiveService.create(id!, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setNewObjectiveContent('');
      setShowNewObjective(false);
    },
  });

  const createAxisMutation = useMutation({
    mutationFn: ({ objectiveId, data }: { objectiveId: string; data: any }) =>
      axisService.create(objectiveId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setNewAxisObjectiveId(null);
      setNewAxisName('');
      setNewAxisDescription('');
    },
  });

  const createHypothesisMutation = useMutation({
    mutationFn: ({ axisId, data }: { axisId: string; data: any }) =>
      hypothesisService.create(axisId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setNewHypothesisAxisId(null);
      setNewHypothesisContent('');
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: ({ hypothesisId, data }: { hypothesisId: string; data: any }) =>
      api.post(`/hypotheses/${hypothesisId}/collection-plans`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setNewPlanHypothesisId(null);
      setNewPlanQuestion('');
    },
  });

  const updateHypothesisMutation = useMutation({
    mutationFn: ({ axisId, hypId, data }: { axisId: string; hypId: string; data: any }) =>
      hypothesisService.update(axisId, hypId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setEditingItem(null);
    },
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

  const duplicateMutation = useMutation({
    mutationFn: () => projectsService.duplicate(id!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projects/${res.data.id}`);
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => api.patch(`/projects/${id}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => api.patch(`/projects/${id}/reopen`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => projectsService.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
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
            {project?.problematique && (
              <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#a5b4fc' }}>
                  Problématique
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#c7d2fe' }}>{project.problematique}</p>
              </div>
            )}

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

            {/* Dupliquer */}
            {canCreateOrModify && <button
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{ border: '1px solid #1e2535', color: '#9ca3af' }}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {duplicateMutation.isPending ? '...' : 'Dupliquer'}
              </span>
            </button>}

            {/* Clôturer */}
            {canCreateOrModify && project?.isActive && (
              <button
                onClick={() => { if (window.confirm('Clôturer ce projet ? Il sera marqué comme terminé.')) closeMutation.mutate(); }}
                disabled={closeMutation.isPending}
                className="text-sm font-semibold px-4 py-2 rounded-xl transition"
                style={{ border: '1px solid #1e2535', color: '#fbbf24' }}
              >
                {closeMutation.isPending ? '...' : 'Clôturer'}
              </button>
            )}

            {/* Rouvrir (si projet clôturé) */}
            {canCreateOrModify && !project?.isActive && project?.end_date && (
              <button
                onClick={() => { if (window.confirm('Rouvrir ce projet ?')) reopenMutation.mutate(); }}
                disabled={reopenMutation.isPending}
                className="text-sm font-semibold px-4 py-2 rounded-xl transition"
                style={{ border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
              >
                {reopenMutation.isPending ? '...' : 'Rouvrir'}
              </button>
            )}

            {/* Export CSV */}
            <button
              onClick={async () => {
                try {
                  const res = await api.get(`/projects/${id}/export-csv`, { responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `export-${(id ?? '').slice(0, 8)}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch { alert('Erreur lors de l\'export CSV'); }
              }}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{ border: '1px solid #1e2535', color: '#9ca3af' }}
            >
              Export CSV
            </button>

            {/* Supprimer */}
            {canCreateOrModify && (
              <button
                onClick={() => { if (window.confirm('Supprimer définitivement ce projet ? Cette action est irréversible.')) deleteProjectMutation.mutate(); }}
                disabled={deleteProjectMutation.isPending}
                className="text-sm font-semibold px-4 py-2 rounded-xl transition"
                style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
              >
                {deleteProjectMutation.isPending ? '...' : 'Supprimer'}
              </button>
            )}

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

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: '#9ca3af' }}>Problématique</label>
                  <textarea
                    value={editForm.problematique}
                    onChange={e => setEditForm({ ...editForm, problematique: e.target.value })}
                    rows={3}
                    style={{ ...inputStyle, resize: 'none' } as React.CSSProperties}
                    placeholder="Problématique centrale du projet..."
                  />
                </div>

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

        {/* ── IA Copilot ─────────────────────────────────────────────────────── */}
        {project && (() => {
          const flatAxes = objectives.flatMap((o: any) => o.axes || []);
          const flatHypotheses = flatAxes.flatMap((a: any) => a.hypotheses || []);
          const flatPlans = flatHypotheses.flatMap((h: any) => h.collection_plans || h.plans || []);
          const projectData = {
            nom: project.nom,
            description: project.description,
            problematique: project.problematique,
            monitoring_type: project.monitoring_type,
            objectives,
            axes: flatAxes,
            hypotheses: flatHypotheses,
            plans: flatPlans,
          };
          return (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <ProjectCopilot mode="correct" project={projectData} />
              <ProjectCopilot mode="chat" project={projectData} />
            </div>
          );
        })()}

        {/* ── Onglets ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'cadrage', label: 'Structure & Cadrage' },
            { key: 'veille',  label: 'Collecte & Analyse'  },
            { key: 'suivi',   label: 'Suivi des hypothèses' },
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

        {/* ── TAB : SUIVI DES HYPOTHÈSES (Kanban) ──────────────────────────────── */}
        {activeTab === 'suivi' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">Suivi des hypothèses</h2>
            </div>
            {(!evaluations || evaluations.length === 0) ? (
              <div className="rounded-2xl py-12 text-center" style={cardStyle}>
                <p className="text-sm font-medium text-white mb-1">Aucune évaluation d'hypothèse</p>
                <p className="text-xs" style={{ color: '#6b7280' }}>Lancez l'enrichissement IA pour générer des évaluations</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 min-h-[400px]">
                {[
                  { key: 'OPEN', label: 'À évaluer', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
                  { key: 'NEEDS_MORE_RESEARCH', label: 'Plus de données', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
                  { key: 'PARTIALLY_SUPPORTED', label: 'Partiellement soutenu', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
                  { key: 'SUPPORTED', label: 'Soutenu', color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
                  { key: 'CONTRADICTED', label: 'Contredit', color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
                ].map(col => {
                  const items = evaluations.filter((e: any) => e.status === col.key);
                  return (
                    <div key={col.key} className="rounded-xl p-3" style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: col.color }}>{col.label}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ background: col.bg, color: col.color }}>{items.length}</span>
                      </div>
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {items.length === 0 ? (
                          <p className="text-xs text-center py-4" style={{ color: '#4b5568' }}>—</p>
                        ) : items.map((ev: any) => {
                          const hyp = objectives
                            .flatMap((o: any) => o.axes || [])
                            .flatMap((a: any) => a.hypotheses || [])
                            .find((h: any) => h.id === ev.hypothesis_id);
                          return (
                            <div key={ev.id} className="rounded-lg p-3 cursor-pointer transition hover:bg-white/[0.03]"
                              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e2535', borderLeft: `3px solid ${col.color}` }}>
                              <p className="text-xs font-medium text-white mb-1 leading-relaxed">
                                {hyp?.content || '(hypothèse supprimée)'}
                              </p>
                              <div className="flex items-center gap-2 text-[10px]" style={{ color: '#6b7280' }}>
                                <span>Conf: {ev.confidence ? Math.round(ev.confidence * 100) : '—'}%</span>
                                <span>·</span>
                                <span>{ev.evidence_count || 0} preuve(s)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
              objectives.map((obj: any, idx: number) => {
                const objOpen = !!expandedObjectives[obj.id];
                const axesCount = obj.axes?.length || 0;
                return (
                <div key={obj.id}
                  className="overflow-hidden transition-all duration-200"
                  style={cardStyle}>

                  {/* ── Objectif header ── */}
                  <div
                    onClick={() => setExpandedObjectives(p => ({ ...p, [obj.id]: !objOpen }))}
                    className="px-5 py-4 flex items-center justify-between cursor-pointer transition-colors duration-150 hover:bg-white/[0.02]"
                    style={{ borderBottom: objOpen ? '1px solid #1e2535' : 'none', borderLeft: '3px solid #3b82f6', borderRadius: '0 0 0 0' }}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg shrink-0"
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Objectif {obj.priority}
                      </span>
                      {editingItem?.id === obj.id && editingItem?.type === 'objective' ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 text-sm font-semibold bg-transparent border rounded-lg px-2 py-1 text-white outline-none"
                          style={{ borderColor: '#3b82f6' }} autoFocus />
                      ) : (
                        <p className="text-sm font-semibold text-white truncate">{obj.content}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {axesCount > 0 && !objOpen && (
                        <>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1"
                            style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                            {axesCount} axe{axesCount > 1 ? 's' : ''}
                          </span>
                          <button onClick={e => { e.stopPropagation(); setExpandedObjectives(p => ({ ...p, [obj.id]: true })); }}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded mr-1 transition"
                            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
                            Consulter les axes
                          </button>
                        </>
                      )}
                      {canCreateOrModify && editingItem?.id === obj.id && editingItem?.type === 'objective' ? (
                        <>
                          <button onClick={e => { e.stopPropagation(); updateObjectiveMutation.mutate({ objId: obj.id, data: { content: editValue } }); }}
                            className="hover:text-green-400 transition-colors" style={actionBtnStyle}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); setEditingItem(null); }}
                            className="hover:text-red-400 transition-colors" style={actionBtnStyle}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : canCreateOrModify && (
                        <button onClick={e => { e.stopPropagation(); setEditingItem({ type: 'objective', id: obj.id, parentId: id!, value: obj.content }); setEditValue(obj.content); }}
                          className="hover:text-blue-400 transition-colors" style={actionBtnStyle}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {canCreateOrModify && editingItem?.id !== obj.id && (
                        <button onClick={e => { e.stopPropagation(); if (window.confirm('Supprimer cet objectif ?')) deleteObjectiveMutation.mutate(obj.id); }}
                          className="hover:text-red-400 transition-colors" style={actionBtnStyle}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      <svg className={`w-5 h-5 transition-transform duration-200 ${objOpen ? 'rotate-180' : ''}`}
                        style={{ color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* ── Objectif body (expandable) ── */}
                  <div className={`transition-all duration-200 overflow-hidden ${objOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    {obj.axes?.length === 0 && (
                      <div className="px-5 py-4 text-center">
                        <p className="text-xs" style={{ color: '#4b5568' }}>Aucun axe défini</p>
                      </div>
                    )}

                    {obj.axes?.map((axe: any, axeIdx: number) => {
                      const axeOpen = !!expandedAxes[axe.id];
                      const hypCount = axe.hypotheses?.length || 0;
                      return (
                      <div key={axe.id}
                        style={{ borderBottom: '1px solid #1e2535', borderLeft: '3px solid #6366f1', background: 'rgba(99,102,241,0.02)', marginLeft: '12px' }}>

                        {/* ── Axe header ── */}
                        <div
                          onClick={() => setExpandedAxes(p => ({ ...p, [axe.id]: !axeOpen }))}
                          className="pl-4 pr-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors duration-150 hover:bg-white/[0.02]"
                          style={{ borderBottom: axeOpen ? '1px solid #1e2535' : 'none' }}>
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-px h-4 shrink-0 self-center mr-1" style={{ background: 'linear-gradient(to bottom, #6366f1, transparent)' }} />
                            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0"
                              style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                              </svg>
                              Axe
                            </span>
                            {editingItem?.id === axe.id && editingItem?.type === 'axis' ? (
                              <div className="flex-1 space-y-1.5 min-w-0">
                                <input value={editValue} onChange={e => setEditValue(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-full text-sm font-medium bg-transparent border rounded-lg px-2 py-1 text-white outline-none"
                                  style={{ borderColor: '#6366f1' }} autoFocus placeholder="Nom de l'axe" />
                                <textarea value={editAxisDescription} onChange={e => setEditAxisDescription(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-full text-xs bg-transparent border rounded-lg px-2 py-1 text-white outline-none"
                                  style={{ borderColor: '#6366f1', resize: 'none' }} rows={2} placeholder="Description (optionnelle)" />
                              </div>
                            ) : (
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{axe.name}</p>
                                {axe.description && (
                                  <p className="text-xs truncate mt-0.5" style={{ color: '#9ca3af' }}>{axe.description}</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-3">
                            {hypCount > 0 && !axeOpen && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1"
                                style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
                                {hypCount} hyp.
                              </span>
                            )}
                            {canCreateOrModify && editingItem?.id === axe.id && editingItem?.type === 'axis' ? (
                              <>
                                <button onClick={e => { e.stopPropagation(); updateAxisMutation.mutate({ objectiveId: obj.id, axisId: axe.id, data: { name: editValue, description: editAxisDescription } }); }}
                                  className="hover:text-green-400 transition-colors" style={actionBtnStyle}>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button onClick={e => { e.stopPropagation(); setEditingItem(null); }}
                                  className="hover:text-red-400 transition-colors" style={actionBtnStyle}>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            ) : canCreateOrModify && (
                              <button onClick={e => { e.stopPropagation(); setEditingItem({ type: 'axis', id: axe.id, parentId: obj.id, value: axe.name }); setEditValue(axe.name); setEditAxisDescription(axe.description || ''); }}
                                className="hover:text-blue-400 transition-colors" style={actionBtnStyle}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            {canCreateOrModify && editingItem?.id !== axe.id && (
                              <button onClick={e => { e.stopPropagation(); if (window.confirm('Supprimer cet axe ?')) deleteAxisMutation.mutate({ objectiveId: obj.id, axisId: axe.id }); }}
                                className="hover:text-red-400 transition-colors" style={actionBtnStyle}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                            <svg className={`w-4 h-4 transition-transform duration-200 ${axeOpen ? 'rotate-180' : ''}`}
                              style={{ color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* ── Axe body (expandable) ── */}
                        <div className={`transition-all duration-200 overflow-hidden ${axeOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                          {axe.description && (
                            <div className="px-5 py-2" style={{ marginLeft: '12px' }}>
                              <p className="text-xs italic" style={{ color: '#9ca3af' }}>{axe.description}</p>
                            </div>
                          )}
                          {axe.hypotheses?.length === 0 && (
                            <div className="pl-6 py-2.5 text-center">
                              <p className="text-xs" style={{ color: '#4b5568' }}>Aucune hypothèse</p>
                            </div>
                          )}

                          {axe.hypotheses?.map((hyp: any, hypIdx: number) => {
                            const hypOpen = !!expandedHypotheses[hyp.id];
                            const plans = hyp.collection_plans || [];
                            return (
                            <div key={hyp.id}
                              style={{ borderBottom: '1px solid #1e2535', borderLeft: '3px solid #34d399', background: 'rgba(16,185,129,0.02)', marginLeft: '24px' }}>

                              {/* ── Hypothèse header ── */}
                              <div
                                onClick={() => setExpandedHypotheses(p => ({ ...p, [hyp.id]: !hypOpen }))}
                                className="pl-3 pr-3 py-2 flex items-center justify-between cursor-pointer transition-colors duration-150 hover:bg-white/[0.02]"
                                style={{ borderBottom: hypOpen ? '1px solid #1e2535' : 'none' }}>
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div className="w-px h-3 shrink-0 self-center mr-0.5" style={{ background: 'linear-gradient(to bottom, #34d399, transparent)' }} />
                                  <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0"
                                    style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    Hyp.
                                  </span>
                                  {editingItem?.id === hyp.id && editingItem?.type === 'hypothesis' ? (
                                    <input value={editValue} onChange={e => setEditValue(e.target.value)}
                                      onClick={e => e.stopPropagation()}
                                      className="flex-1 text-sm bg-transparent border rounded-lg px-2 py-1 text-white outline-none"
                                      style={{ borderColor: '#34d399' }} autoFocus />
                                  ) : (
                                    <p className="text-sm text-white truncate">{hyp.content}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-3">
                                  {plans.length > 0 && !hypOpen && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1"
                                      style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                                      {plans.length} plan{plans.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {canCreateOrModify && editingItem?.id === hyp.id && editingItem?.type === 'hypothesis' ? (
                                    <>
                                      <button onClick={e => { e.stopPropagation(); updateHypothesisMutation.mutate({ axisId: axe.id, hypId: hyp.id, data: { content: editValue } }); }}
                                        className="hover:text-green-400 transition-colors" style={actionBtnStyle}>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </button>
                                      <button onClick={e => { e.stopPropagation(); setEditingItem(null); }}
                                        className="hover:text-red-400 transition-colors" style={actionBtnStyle}>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </>
                                  ) : canCreateOrModify && (
                                    <button onClick={e => { e.stopPropagation(); setEditingItem({ type: 'hypothesis', id: hyp.id, parentId: axe.id, value: hyp.content }); setEditValue(hyp.content); }}
                                      className="hover:text-blue-400 transition-colors" style={actionBtnStyle}>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                  )}
                                  {canCreateOrModify && editingItem?.id !== hyp.id && (
                                    <button onClick={e => { e.stopPropagation(); if (window.confirm('Supprimer cette hypothèse ?')) deleteHypothesisMutation.mutate({ axisId: axe.id, hypId: hyp.id }); }}
                                      className="hover:text-red-400 transition-colors" style={actionBtnStyle}>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                  <svg className={`w-4 h-4 transition-transform duration-200 ${hypOpen ? 'rotate-180' : ''}`}
                                    style={{ color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {/* ── Hypothèse body: Collection Plans ── */}
                              <div className={`transition-all duration-200 overflow-hidden ${hypOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="pl-8 pr-3 py-2.5 space-y-1.5">
                                  {plans.length === 0 && (
                                    <p className="text-[11px]" style={{ color: '#4b5568' }}>
                                      Aucun plan de collecte
                                    </p>
                                  )}
                                  {plans.map((plan: any, planIdx: number) => {
                                    return (
                                    <div key={plan.id}
                                      className="flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-150 group"
                                      style={{ background: '#0f1117', border: '1px solid #1e2535', borderLeft: '2px solid #6366f1' }}>
                                      <Link to={`/projects/${id}/plans/${plan.id}`} className="flex items-center gap-2 min-w-0 flex-1" onClick={e => e.stopPropagation()}>
                                        <svg className="w-3 h-3 shrink-0" style={{ color: '#a5b4fc' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        <p className="text-xs text-white truncate group-hover:text-blue-400 transition-colors">
                                          {plan.question}
                                        </p>
                                      </Link>
                                      <span className="text-[10px] shrink-0 ml-2 px-1.5 py-0.5 rounded"
                                        style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                                        {plan.frequency}
                                      </span>
                                    </div>
                                  )})}
                                </div>

                              {/* ── Add collection plan ── */}
                              {canCreateOrModify && (
                                <div className="pl-8 pr-3 pb-2.5">
                                  {newPlanHypothesisId === hyp.id ? (
                                    <div className="space-y-1.5">
                                      <SuggestionPanel
                                        prompt={`Tu es un expert en veille. Propose 3 questions de recherche précises en français pour cette hypothèse.

Hypothèse: "${hyp.content}"
Projet: "${project.nom}"

Une question de recherche guide la collecte de données et doit être précise et actionnable.

Réponds uniquement au format JSON : { "options": ["Question 1", "Question 2", "Question 3"] }`}
                                        onSelect={(v) => setNewPlanQuestion(v)}
                                        disabled={!project} />
                                      <input value={newPlanQuestion} onChange={e => setNewPlanQuestion(e.target.value)}
                                        placeholder="Question / objectif du plan..."
                                        style={inputStyle}
                                        onKeyDown={e => { if (e.key === 'Enter' && newPlanQuestion.trim()) createPlanMutation.mutate({ hypothesisId: hyp.id, data: { question: newPlanQuestion.trim(), frequency: newPlanFrequency } }); }}
                                      />
                                      <select value={newPlanFrequency} onChange={e => setNewPlanFrequency(e.target.value)}
                                        style={inputStyle}>
                                        <option value="ON_DEMAND">À la demande</option>
                                        <option value="DAILY">Quotidien</option>
                                        <option value="WEEKLY">Hebdomadaire</option>
                                        <option value="MONTHLY">Mensuel</option>
                                      </select>
                                      <div className="flex gap-2">
                                        <button onClick={() => { if (newPlanQuestion.trim()) createPlanMutation.mutate({ hypothesisId: hyp.id, data: { question: newPlanQuestion.trim(), frequency: newPlanFrequency } }); }}
                                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                                          style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                                          Ajouter
                                        </button>
                                        <button onClick={() => { setNewPlanHypothesisId(null); setNewPlanQuestion(''); }}
                                          className="px-3 py-1.5 rounded-xl text-xs" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>
                                          Annuler
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button onClick={() => setNewPlanHypothesisId(hyp.id)}
                                      className="text-[11px] font-semibold w-full py-1.5 rounded-lg transition"
                                      style={{ border: '1px dashed #1e2535', color: '#a5b4fc' }}>
                                      + Ajouter un plan de collecte
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )})}

                        {/* ── Add hypothesis ── */}
                        {canCreateOrModify && (
                          <div className="px-5 py-3" style={{ borderTop: '1px solid #1e2535', marginLeft: '12px' }}>
                            {newHypothesisAxisId === axe.id ? (
                              <div className="space-y-2">
                                <SuggestionPanel
                                  prompt={`Tu es un expert en veille stratégique. Propose 3 hypothèses testables en français pour cet axe.

Axe: "${axe.name}"
Objectif lié: "${objectives?.find((o: any) => o.id === axe.objective_id)?.content || ''}"
Projet: "${project.nom}"

Une hypothèse est une supposition qui pourra être confirmée ou infirmée par la collecte de données.

Réponds uniquement au format JSON : { "options": ["Hypothèse 1", "Hypothèse 2", "Hypothèse 3"] }`}
                                  onSelect={(v) => setNewHypothesisContent(v)}
                                  disabled={!project} />
                                <input value={newHypothesisContent} onChange={e => setNewHypothesisContent(e.target.value)}
                                  placeholder="Contenu de l'hypothèse..."
                                  style={inputStyle}
                                  onKeyDown={e => { if (e.key === 'Enter' && newHypothesisContent.trim()) createHypothesisMutation.mutate({ axisId: axe.id, data: { content: newHypothesisContent.trim() } }); }}
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => { if (newHypothesisContent.trim()) createHypothesisMutation.mutate({ axisId: axe.id, data: { content: newHypothesisContent.trim() } }); }}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                                    style={{ background: 'linear-gradient(135deg,#34d399,#10b981)' }}>
                                    Ajouter
                                  </button>
                                  <button onClick={() => { setNewHypothesisAxisId(null); setNewHypothesisContent(''); }}
                                    className="px-3 py-1.5 rounded-xl text-xs" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setNewHypothesisAxisId(axe.id)}
                                className="text-xs font-semibold w-full py-2 rounded-lg transition"
                                style={{ border: '1px dashed #1e2535', color: '#34d399' }}>
                                + Ajouter une hypothèse
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )})}

                  {/* ── Add axis ── */}
                  {canCreateOrModify && (
                    <div className="px-5 py-3" style={{ borderTop: '1px solid #1e2535', marginLeft: '12px' }}>
                      {newAxisObjectiveId === obj.id ? (
                        <div className="space-y-2">
                          <SuggestionPanel
                            prompt={`Tu es un expert en veille stratégique. Pour cet objectif, propose 3 axes d'analyse avec leur description en français.

Objectif: "${obj.content}"
Projet: "${project.nom}"
Problématique: "${project.problematique}"

Chaque axe doit avoir un nom précis et une description claire.
Retourne chaque option au format: "Nom de l'axe|Description de l'axe"

Exemple: "Axe technologique|Suivi des innovations et ruptures technologiques dans le secteur"

Réponds uniquement au format JSON : { "options": ["Axe 1|Description 1", "Axe 2|Description 2", "Axe 3|Description 3"] }`}
                            onSelect={(v) => {
                              const [name, desc] = v.split('|');
                              setNewAxisName(name.trim());
                              if (desc) setNewAxisDescription(desc.trim());
                            }}
                            disabled={!project} />
                          <input value={newAxisName} onChange={e => setNewAxisName(e.target.value)}
                            placeholder="Nom de l'axe..."
                            style={inputStyle}
                            onKeyDown={e => { if (e.key === 'Enter' && newAxisName.trim()) createAxisMutation.mutate({ objectiveId: obj.id, data: { name: newAxisName.trim(), description: newAxisDescription.trim() } }); }}
                          />
                          <textarea value={newAxisDescription} onChange={e => setNewAxisDescription(e.target.value)}
                            placeholder="Description (optionnelle)..."
                            rows={2}
                            style={{ ...inputStyle, resize: 'none' } as React.CSSProperties}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => { if (newAxisName.trim()) createAxisMutation.mutate({ objectiveId: obj.id, data: { name: newAxisName.trim(), description: newAxisDescription.trim() } }); }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                              style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                              Ajouter
                            </button>
                            <button onClick={() => { setNewAxisObjectiveId(null); setNewAxisName(''); setNewAxisDescription(''); }}
                              className="px-3 py-1.5 rounded-xl text-xs" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setNewAxisObjectiveId(obj.id)}
                          className="text-xs font-semibold w-full py-2 rounded-lg transition"
                          style={{ border: '1px dashed #1e2535', color: '#a5b4fc' }}>
                          + Ajouter un axe
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              )})
            )}

            {/* ── Ajouter un objectif ── */}
            {canCreateOrModify && (
              <div style={cardStyle} className="p-4">
                {showNewObjective ? (
                  <div className="space-y-2">
                    <SuggestionPanel
                      prompt={`Tu es un expert en stratégie de veille. Propose 3 objectifs stratégiques en français pour ce projet.

Projet: "${project.nom}"
Description: "${project.description}"
Problématique: "${project.problematique}"
Type de veille: "${MONITORING_LABELS[project.monitoring_type] || project.monitoring_type}"

Chaque objectif doit commencer par un verbe d'action et être précis.

Réponds uniquement au format JSON : { "options": ["Objectif 1", "Objectif 2", "Objectif 3"] }`}
                      onSelect={(v) => setNewObjectiveContent(v)}
                      disabled={!project} />
                    <div className="flex gap-2">
                      <input value={newObjectiveContent} onChange={e => setNewObjectiveContent(e.target.value)}
                        placeholder="Nouvel objectif..."
                        style={inputStyle}
                        onKeyDown={e => { if (e.key === 'Enter' && newObjectiveContent.trim()) createObjectiveMutation.mutate(newObjectiveContent.trim()); }}
                      />
                      <button onClick={() => { if (newObjectiveContent.trim()) createObjectiveMutation.mutate(newObjectiveContent.trim()); }}
                        disabled={createObjectiveMutation.isPending || !newObjectiveContent.trim()}
                        className="px-3 py-2 rounded-xl text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', opacity: createObjectiveMutation.isPending || !newObjectiveContent.trim() ? 0.5 : 1 }}>
                        {createObjectiveMutation.isPending ? '...' : 'Ajouter'}
                      </button>
                      <button onClick={() => { setShowNewObjective(false); setNewObjectiveContent(''); }}
                        className="px-3 py-2 rounded-xl text-sm" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowNewObjective(true)}
                    className="text-sm font-semibold w-full py-2 rounded-xl transition"
                    style={{ border: '1px dashed #1e2535', color: '#60a5fa' }}>
                    + Ajouter un objectif
                  </button>
                )}
              </div>
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
