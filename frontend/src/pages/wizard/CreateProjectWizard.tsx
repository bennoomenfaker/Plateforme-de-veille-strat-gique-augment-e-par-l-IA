import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';

const STEPS = [
  { id: 1, label: 'Projet' },
  { id: 2, label: 'Objectifs' },
  { id: 3, label: 'Axes' },
  { id: 4, label: 'Hypothèses' },
  { id: 5, label: 'Périmètres' },
  { id: 6, label: 'Plans de collecte' },
  { id: 7, label: 'Stakeholders' },
  { id: 8, label: 'Révision' },
];

export default function CreateProjectWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Données créées au fur et à mesure
  const [projectId, setProjectId] = useState('');
  const [objectives, setObjectives] = useState<any[]>([]);
  const [axes, setAxes] = useState<any[]>([]);
  const [hypotheses, setHypotheses] = useState<any[]>([]);
  const [perimeters, setPerimeters] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  // Step 1 — Projet
  const [projectForm, setProjectForm] = useState({
    nom: '', description: '', veille_type: 'RSS',
    frequency: 'DAILY', start_date: '', end_date: '', folder_id: ''
  });

  // Step 2 — Objectif courant
  const [objForm, setObjForm] = useState({ content: '', priority: 1 });

  // Step 3 — Axe courant
  const [axeForm, setAxeForm] = useState({ name: '', description: '', priority: 1, objective_id: '' });

  // Step 4 — Hypothèse courante
  const [hypForm, setHypForm] = useState({ content: '', priority: 1, axis_id: '' });

  // Step 5 — Périmètre courant
  const [perimForm, setPerimForm] = useState({ name: '', type: 'GEOGRAPHIC', parent_id: '' });

  // Step 6 — Plan courant
  const [planForm, setPlanForm] = useState({
    question: '', frequency: 'DAILY',
    collection_start_date: '', collection_end_date: '',
    hypothesis_id: '', sources: [] as any[], keywords: [] as any[]
  });
  const [sourceForm, setSourceForm] = useState({ source_type: 'RSS', source_label: '', source_url: '' });
  const [kwForm, setKwForm] = useState({ keyword: '', keyword_type: 'PRINCIPAL' });

  // Step 7 — Stakeholder
  

  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.get('/folders').then(r => r.data),
  });

  const inputStyle = {
    background: '#0f1117', border: '1px solid #1e2535', color: 'white',
    borderRadius: '0.75rem', padding: '0.625rem 1rem', fontSize: '0.875rem',
    width: '100%', outline: 'none'
  };

  const cardStyle = { background: '#161b27', border: '1px solid #1e2535', borderRadius: '1rem', padding: '1.25rem' };

  // ─── STEP 1 : Créer le projet ─────────────────────────────────────────────
  const handleCreateProject = async () => {
    if (!projectForm.nom) { setError('Le nom du projet est obligatoire'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/projects', {
        nom: projectForm.nom,
        description: projectForm.description,
        veille_type: projectForm.veille_type,
        frequency: projectForm.frequency,
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null,
        folder_id: projectForm.folder_id || null,
      });
      setProjectId(res.data.id);
      setStep(2);
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  // ─── STEP 2 : Ajouter objectif ────────────────────────────────────────────
  const handleAddObjective = async () => {
    if (!objForm.content) { setError('Le contenu est obligatoire'); return; }
    if (objectives.length >= 5) { setError('Maximum 5 objectifs'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/projects/${projectId}/objectives`, {
        content: objForm.content, priority: objectives.length + 1
      });
      setObjectives([...objectives, res.data]);
      setObjForm({ content: '', priority: 1 });
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  // ─── STEP 3 : Ajouter axe ─────────────────────────────────────────────────
  const handleAddAxe = async () => {
    if (!axeForm.name || !axeForm.objective_id) { setError('Nom et objectif obligatoires'); return; }
    if (axes.filter(a => a.objective_id === axeForm.objective_id).length >= 5) {
      setError('Maximum 5 axes par objectif'); return;
    }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/objectives/${axeForm.objective_id}/axes`, {
        name: axeForm.name, description: axeForm.description, priority: 1
      });
      setAxes([...axes, { ...res.data, objective_id: axeForm.objective_id }]);
      setAxeForm({ name: '', description: '', priority: 1, objective_id: '' });
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  // ─── STEP 4 : Ajouter hypothèse ───────────────────────────────────────────
  const handleAddHypothesis = async () => {
    if (!hypForm.content || !hypForm.axis_id) { setError('Contenu et axe obligatoires'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/axes/${hypForm.axis_id}/hypotheses`, {
        content: hypForm.content, priority: 1
      });
      setHypotheses([...hypotheses, { ...res.data, axis_id: hypForm.axis_id }]);
      setHypForm({ content: '', priority: 1, axis_id: '' });
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  // ─── STEP 5 : Ajouter périmètre ───────────────────────────────────────────
  const handleAddPerimeter = async () => {
    if (!perimForm.name) { setError('Nom obligatoire'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/projects/${projectId}/perimeters`, {
        name: perimForm.name, type: perimForm.type,
        parent_id: perimForm.parent_id || null
      });
      setPerimeters([...perimeters, res.data]);
      setPerimForm({ name: '', type: 'GEOGRAPHIC', parent_id: '' });
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  // ─── STEP 6 : Créer plan de collecte ──────────────────────────────────────
  const handleCreatePlan = async () => {
    if (!planForm.question || !planForm.hypothesis_id) {
      setError('Question et hypothèse obligatoires'); return;
    }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/hypotheses/${planForm.hypothesis_id}/collection-plans`, {
        question: planForm.question,
        frequency: planForm.frequency,
        collection_start_date: planForm.collection_start_date || null,
        collection_end_date: planForm.collection_end_date || null,
      });
      const planId = res.data.id;

      // Ajouter sources
      for (const src of planForm.sources) {
        await api.post(`/collection-plans/${planId}/sources`, src);
      }
      // Ajouter keywords
      for (const kw of planForm.keywords) {
        await api.post(`/collection-plans/${planId}/keywords`, kw);
      }

      setPlans([...plans, { ...res.data, sources: planForm.sources, keywords: planForm.keywords }]);
      setPlanForm({ question: '', frequency: 'DAILY', collection_start_date: '', collection_end_date: '', hypothesis_id: '', sources: [], keywords: [] });
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  const next = () => { setError(''); setStep(s => s + 1); };
  const prev = () => { setError(''); setStep(s => s - 1); };

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3b82f6' }}>Sprint 2</p>
          <h1 className="text-2xl font-bold text-white">Nouveau projet de veille</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>Configurez votre projet étape par étape</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 shrink-0">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition"
                  style={step === s.id
                    ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                    : step > s.id
                      ? { background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }
                      : { background: '#1e2535', color: '#6b7280' }
                  }>
                  {step > s.id ? '✓' : s.id}
                </div>
                <p className="text-xs mt-1 text-center hidden md:block" style={{ color: step === s.id ? '#60a5fa' : '#6b7280' }}>
                  {s.label}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-6 h-0.5 mb-4" style={{ background: step > s.id ? '#34d399' : '#1e2535' }} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-3 mb-5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* ─── STEP 1 : PROJET ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-6">Informations du projet</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Nom du projet *</label>
                <input style={inputStyle} value={projectForm.nom} onChange={e => setProjectForm({ ...projectForm, nom: e.target.value })} placeholder="Ex: Veille concurrentielle IA" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Description</label>
                <textarea style={{ ...inputStyle, resize: 'none' } as any} rows={3} value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="Objectif de ce projet..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Type de veille</label>
                  <select style={inputStyle} value={projectForm.veille_type} onChange={e => setProjectForm({ ...projectForm, veille_type: e.target.value })}>
                    <option value="RSS">RSS</option>
                    <option value="WEB">Web</option>
                    <option value="API">API</option>
                    <option value="DOCUMENT">Document</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Fréquence</label>
                  <select style={inputStyle} value={projectForm.frequency} onChange={e => setProjectForm({ ...projectForm, frequency: e.target.value })}>
                    <option value="ON_DEMAND">À la demande</option>
                    <option value="DAILY">Quotidienne</option>
                    <option value="WEEKLY">Hebdomadaire</option>
                    <option value="MONTHLY">Mensuelle</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Date début</label>
                  <input type="date" style={inputStyle} value={projectForm.start_date} onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Date fin</label>
                  <input type="date" style={inputStyle} value={projectForm.end_date} onChange={e => setProjectForm({ ...projectForm, end_date: e.target.value })} />
                </div>
              </div>
              {foldersData?.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Dossier (optionnel)</label>
                  <select style={inputStyle} value={projectForm.folder_id} onChange={e => setProjectForm({ ...projectForm, folder_id: e.target.value })}>
                    <option value="">Aucun dossier</option>
                    {foldersData.map((f: any) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={handleCreateProject} disabled={loading}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Création...' : 'Créer le projet →'}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2 : OBJECTIFS ──────────────────────────────────────────── */}
        {step === 2 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Objectifs stratégiques</h2>
            <p className="text-xs mb-6" style={{ color: '#6b7280' }}>Définissez le "pourquoi" de votre veille (max 5 objectifs)</p>

            {objectives.length > 0 && (
              <div className="space-y-2 mb-6">
                {objectives.map((obj, i) => (
                  <div key={obj.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>O{i + 1}</span>
                    <p className="text-sm text-white">{obj.content}</p>
                  </div>
                ))}
              </div>
            )}

            {objectives.length < 5 && (
              <div className="flex gap-3">
                <input style={{ ...inputStyle, flex: 1 }} value={objForm.content}
                  onChange={e => setObjForm({ ...objForm, content: e.target.value })}
                  placeholder="Ex: Surveiller les tendances IA en Europe"
                  onKeyDown={e => e.key === 'Enter' && handleAddObjective()}
                />
                <button onClick={handleAddObjective} disabled={loading}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                  + Ajouter
                </button>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button onClick={prev} className="px-4 py-2 rounded-xl text-sm" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>← Retour</button>
              <button onClick={next} disabled={objectives.length === 0}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: objectives.length > 0 ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : '#1e2535', opacity: objectives.length === 0 ? 0.5 : 1 }}>
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3 : AXES ───────────────────────────────────────────────── */}
        {step === 3 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Axes d'analyse</h2>
            <p className="text-xs mb-6" style={{ color: '#6b7280' }}>Définissez les dimensions d'analyse (max 5 axes par objectif)</p>

            {axes.length > 0 && (
              <div className="space-y-2 mb-6">
                {axes.map((axe) => {
                  const obj = objectives.find(o => o.id === axe.objective_id);
                  return (
                    <div key={axe.id} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                      <p className="text-xs mb-1" style={{ color: '#a5b4fc' }}>Objectif : {obj?.content?.substring(0, 50)}...</p>
                      <p className="text-sm font-semibold text-white">{axe.name}</p>
                      {axe.description && <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{axe.description}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Objectif associé *</label>
                <select style={inputStyle} value={axeForm.objective_id} onChange={e => setAxeForm({ ...axeForm, objective_id: e.target.value })}>
                  <option value="">Sélectionner un objectif</option>
                  {objectives.map(obj => <option key={obj.id} value={obj.id}>{obj.content.substring(0, 60)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Nom de l'axe *</label>
                <input style={inputStyle} value={axeForm.name} onChange={e => setAxeForm({ ...axeForm, name: e.target.value })} placeholder="Ex: Axe technologique" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Description</label>
                <input style={inputStyle} value={axeForm.description} onChange={e => setAxeForm({ ...axeForm, description: e.target.value })} placeholder="Description optionnelle" />
              </div>
              <button onClick={handleAddAxe} disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                + Ajouter l'axe
              </button>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={prev} className="px-4 py-2 rounded-xl text-sm" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>← Retour</button>
              <button onClick={next} disabled={axes.length === 0}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: axes.length > 0 ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : '#1e2535', opacity: axes.length === 0 ? 0.5 : 1 }}>
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4 : HYPOTHESES ─────────────────────────────────────────── */}
        {step === 4 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Hypothèses stratégiques</h2>
            <p className="text-xs mb-6" style={{ color: '#6b7280' }}>Suppositions à tester par la collecte</p>

            {hypotheses.length > 0 && (
              <div className="space-y-2 mb-6">
                {hypotheses.map((hyp) => {
                  const axe = axes.find(a => a.id === hyp.axis_id);
                  return (
                    <div key={hyp.id} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                      <p className="text-xs mb-1" style={{ color: '#34d399' }}>Axe : {axe?.name}</p>
                      <p className="text-sm text-white">{hyp.content}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Axe associé *</label>
                <select style={inputStyle} value={hypForm.axis_id} onChange={e => setHypForm({ ...hypForm, axis_id: e.target.value })}>
                  <option value="">Sélectionner un axe</option>
                  {axes.map(axe => <option key={axe.id} value={axe.id}>{axe.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Hypothèse *</label>
                <textarea style={{ ...inputStyle, resize: 'none' } as any} rows={2} value={hypForm.content}
                  onChange={e => setHypForm({ ...hypForm, content: e.target.value })}
                  placeholder="Ex: Les LLM vont dominer le marché IA en 2026" />
              </div>
              <button onClick={handleAddHypothesis} disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                + Ajouter l'hypothèse
              </button>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={prev} className="px-4 py-2 rounded-xl text-sm" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>← Retour</button>
              <button onClick={next} disabled={hypotheses.length === 0}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: hypotheses.length > 0 ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : '#1e2535', opacity: hypotheses.length === 0 ? 0.5 : 1 }}>
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 5 : PERIMETRES ─────────────────────────────────────────── */}
        {step === 5 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Périmètres</h2>
            <p className="text-xs mb-6" style={{ color: '#6b7280' }}>Définissez les périmètres géographiques et sectoriels</p>

            {perimeters.length > 0 && (
              <div className="space-y-2 mb-6">
                {perimeters.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)' }}>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={p.type === 'GEOGRAPHIC'
                        ? { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }
                        : { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }
                      }>{p.type}</span>
                    <p className="text-sm text-white">{p.name}</p>
                    {p.parent_id && <p className="text-xs" style={{ color: '#6b7280' }}>sous-périmètre</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Nom *</label>
                  <input style={inputStyle} value={perimForm.name} onChange={e => setPerimForm({ ...perimForm, name: e.target.value })} placeholder="Ex: Europe, Tech..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Type *</label>
                  <select style={inputStyle} value={perimForm.type} onChange={e => setPerimForm({ ...perimForm, type: e.target.value })}>
                    <option value="GEOGRAPHIC">Géographique</option>
                    <option value="SECTORAL">Sectoriel</option>
                  </select>
                </div>
              </div>
              {perimeters.filter(p => p.type === perimForm.type).length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Parent (optionnel)</label>
                  <select style={inputStyle} value={perimForm.parent_id} onChange={e => setPerimForm({ ...perimForm, parent_id: e.target.value })}>
                    <option value="">Aucun parent</option>
                    {perimeters.filter(p => p.type === perimForm.type).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button onClick={handleAddPerimeter} disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                + Ajouter le périmètre
              </button>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={prev} className="px-4 py-2 rounded-xl text-sm" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>← Retour</button>
              <button onClick={next}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 6 : COLLECTION PLANS ───────────────────────────────────── */}
        {step === 6 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Plans de collecte</h2>
            <p className="text-xs mb-6" style={{ color: '#6b7280' }}>Configurez les questions et stratégies de collecte pour chaque hypothèse</p>

            {plans.length > 0 && (
              <div className="space-y-2 mb-6">
                {plans.map((plan) => (
                  <div key={plan.id} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <p className="text-sm font-semibold text-white mb-1">{plan.question}</p>
                    <div className="flex gap-3 text-xs" style={{ color: '#6b7280' }}>
                      <span>{plan.frequency}</span>
                      <span>{plan.sources.length} source(s)</span>
                      <span>{plan.keywords.length} mot(s)-clé(s)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Hypothèse associée *</label>
                <select style={inputStyle} value={planForm.hypothesis_id} onChange={e => setPlanForm({ ...planForm, hypothesis_id: e.target.value })}>
                  <option value="">Sélectionner une hypothèse</option>
                  {hypotheses.map(h => <option key={h.id} value={h.id}>{h.content.substring(0, 70)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Question *</label>
                <textarea style={{ ...inputStyle, resize: 'none' } as any} rows={2} value={planForm.question}
                  onChange={e => setPlanForm({ ...planForm, question: e.target.value })}
                  placeholder="Ex: Quelles sont les dernières publications sur les LLM ?" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Fréquence *</label>
                  <select style={inputStyle} value={planForm.frequency} onChange={e => setPlanForm({ ...planForm, frequency: e.target.value })}>
                    <option value="ON_DEMAND">À la demande</option>
                    <option value="DAILY">Quotidienne</option>
                    <option value="WEEKLY">Hebdomadaire</option>
                    <option value="MONTHLY">Mensuelle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Début collecte</label>
                  <input type="date" style={inputStyle} value={planForm.collection_start_date} onChange={e => setPlanForm({ ...planForm, collection_start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Fin collecte</label>
                  <input type="date" style={inputStyle} value={planForm.collection_end_date} onChange={e => setPlanForm({ ...planForm, collection_end_date: e.target.value })} />
                </div>
              </div>

              {/* Sources */}
              <div className="rounded-xl p-4" style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9ca3af' }}>Sources</p>
                {planForm.sources.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2 text-xs" style={{ color: '#9ca3af' }}>
                    <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>{s.source_type}</span>
                    <span>{s.source_label}</span>
                    <button onClick={() => setPlanForm({ ...planForm, sources: planForm.sources.filter((_, j) => j !== i) })}
                      style={{ color: '#ef4444', marginLeft: 'auto' }}>×</button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <select style={{ ...inputStyle, flex: '0 0 100px' }} value={sourceForm.source_type} onChange={e => setSourceForm({ ...sourceForm, source_type: e.target.value })}>
                    <option value="RSS">RSS</option>
                    <option value="WEB">Web</option>
                    <option value="API">API</option>
                    <option value="DOCUMENT">Doc</option>
                  </select>
                  <input style={{ ...inputStyle, flex: 1 }} value={sourceForm.source_label} onChange={e => setSourceForm({ ...sourceForm, source_label: e.target.value })} placeholder="Label" />
                  <input style={{ ...inputStyle, flex: 2 }} value={sourceForm.source_url} onChange={e => setSourceForm({ ...sourceForm, source_url: e.target.value })} placeholder="URL" />
                  <button onClick={() => {
                    if (sourceForm.source_label && sourceForm.source_url) {
                      setPlanForm({ ...planForm, sources: [...planForm.sources, { ...sourceForm }] });
                      setSourceForm({ source_type: 'RSS', source_label: '', source_url: '' });
                    }
                  }} className="px-3 py-1 rounded-lg text-sm font-bold text-white shrink-0" style={{ background: '#3b82f6' }}>+</button>
                </div>
              </div>

              {/* Keywords */}
              <div className="rounded-xl p-4" style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9ca3af' }}>Mots-clés</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {planForm.keywords.map((kw, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
                      {kw.keyword}
                      <button onClick={() => setPlanForm({ ...planForm, keywords: planForm.keywords.filter((_, j) => j !== i) })} style={{ color: '#ef4444' }}>×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select style={{ ...inputStyle, flex: '0 0 130px' }} value={kwForm.keyword_type} onChange={e => setKwForm({ ...kwForm, keyword_type: e.target.value })}>
                    <option value="PRINCIPAL">Principal</option>
                    <option value="SYNONYME">Synonyme</option>
                    <option value="EXPRESSION">Expression</option>
                  </select>
                  <input style={{ ...inputStyle, flex: 1 }} value={kwForm.keyword} onChange={e => setKwForm({ ...kwForm, keyword: e.target.value })}
                    placeholder="Mot-clé" onKeyDown={e => {
                      if (e.key === 'Enter' && kwForm.keyword) {
                        setPlanForm({ ...planForm, keywords: [...planForm.keywords, { ...kwForm }] });
                        setKwForm({ keyword: '', keyword_type: 'PRINCIPAL' });
                      }
                    }} />
                  <button onClick={() => {
                    if (kwForm.keyword) {
                      setPlanForm({ ...planForm, keywords: [...planForm.keywords, { ...kwForm }] });
                      setKwForm({ keyword: '', keyword_type: 'PRINCIPAL' });
                    }
                  }} className="px-3 py-1 rounded-lg text-sm font-bold text-white shrink-0" style={{ background: '#6366f1' }}>+</button>
                </div>
              </div>

              <button onClick={handleCreatePlan} disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                {loading ? 'Création...' : '+ Créer le plan de collecte'}
              </button>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={prev} className="px-4 py-2 rounded-xl text-sm" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>← Retour</button>
              <button onClick={next} disabled={plans.length === 0}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: plans.length > 0 ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : '#1e2535', opacity: plans.length === 0 ? 0.5 : 1 }}>
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 7 : STAKEHOLDERS ───────────────────────────────────────── */}
        {step === 7 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Parties prenantes</h2>
            <p className="text-xs mb-6" style={{ color: '#6b7280' }}>Uniquement pour les projets organisation (optionnel)</p>
            <div className="rounded-xl p-4 text-center" style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Les stakeholders peuvent être ajoutés depuis la page du projet après sa création.
              </p>
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={prev} className="px-4 py-2 rounded-xl text-sm" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>← Retour</button>
              <button onClick={next}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 8 : REVIEW ─────────────────────────────────────────────── */}
        {step === 8 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-6">Révision du projet</h2>

            <div className="space-y-4">
              {[
                { label: 'Projet', value: projectForm.nom, color: '#60a5fa', count: null },
                { label: 'Objectifs', value: null, color: '#34d399', count: objectives.length },
                { label: 'Axes', value: null, color: '#a5b4fc', count: axes.length },
                { label: 'Hypothèses', value: null, color: '#fb923c', count: hypotheses.length },
                { label: 'Périmètres', value: null, color: '#f472b6', count: perimeters.length },
                { label: 'Plans de collecte', value: null, color: '#34d399', count: plans.length },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  {item.value
                    ? <p className="text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
                    : <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: `rgba(59,130,246,0.1)`, color: item.color }}>
                        {item.count} élément(s)
                      </span>
                  }
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p className="text-sm font-semibold" style={{ color: '#34d399' }}>✓ Projet prêt pour la collecte</p>
              <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Vos plans de collecte sont configurés. Vous pouvez maintenant lancer la collecte depuis la page du projet.</p>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={prev} className="px-4 py-2 rounded-xl text-sm" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>← Retour</button>
              <button onClick={() => navigate(`/projects/${projectId}`)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                Accéder au projet →
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
