import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

const MONITORING_TYPES = [
  { value: 'TECHNOLOGICAL', label: 'Veille technologique' },
  { value: 'COMPETITIVE',   label: 'Veille concurrentielle' },
  { value: 'REGULATORY',    label: 'Veille réglementaire' },
  { value: 'GEOPOLITICAL',  label: 'Veille géopolitique' },
  { value: 'ECONOMIC',      label: 'Veille économique' },
  { value: 'SCIENTIFIC',    label: 'Veille scientifique' },
  { value: 'CYBERSECURITY', label: 'Veille cybersécurité' },
];

const SESSION_KEY = 'wizard_state';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(state: any) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch {}
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

export default function CreateProjectWizard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Restaurer depuis sessionStorage si dispo
  const session = loadSession();

  const [step,        setStep]        = useState(session?.step        ?? 1);
  const [projectId,   setProjectId]   = useState(session?.projectId   ?? '');
  const [objectives,  setObjectives]  = useState(session?.objectives  ?? []);
  const [axes,        setAxes]        = useState(session?.axes        ?? []);
  const [hypotheses,  setHypotheses]  = useState(session?.hypotheses  ?? []);
  const [perimeters,  setPerimeters]  = useState(session?.perimeters  ?? []);
  const [plans,       setPlans]       = useState(session?.plans       ?? []);
  const [projectForm, setProjectForm] = useState(session?.projectForm ?? {
    nom: '', description: '', monitoring_type: 'TECHNOLOGICAL', folder_id: '',
  });

  const [objForm,    setObjForm]    = useState({ content: '' });
  const [axeForm,    setAxeForm]    = useState({ name: '', description: '', objective_id: '' });
  const [hypForm,    setHypForm]    = useState({ content: '', axis_id: '' });
  const [perimForm,  setPerimForm]  = useState({ name: '', type: 'GEOGRAPHIC', parent_id: '' });
  const [planForm,   setPlanForm]   = useState({
    question: '', frequency: 'DAILY', collection_start_date: '',
    collection_end_date: '', hypothesis_id: '', sources: [] as any[], keywords: [] as any[],
  });
  const [sourceForm, setSourceForm] = useState({ source_type: 'RSS', source_label: '', source_url: '', frequency: 'DAILY' });
  const [kwForm,     setKwForm]     = useState({ keyword: '', keyword_type: 'INCLUDE' });

  // Sauvegarder dans sessionStorage à chaque changement d'état important
  useEffect(() => {
    if (step > 1 || projectId) {
      saveSession({ step, projectId, objectives, axes, hypotheses, perimeters, plans, projectForm });
    }
  }, [step, projectId, objectives, axes, hypotheses, perimeters, plans]);

  const inputStyle: React.CSSProperties = {
    background: '#0f1117', border: '1px solid #1e2535', color: 'white',
    borderRadius: '0.75rem', padding: '0.625rem 1rem', fontSize: '0.875rem',
    width: '100%', outline: 'none',
  };
  const cardStyle: React.CSSProperties = {
    background: '#161b27', border: '1px solid #1e2535', borderRadius: '1rem', padding: '1.5rem',
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreateProject = async () => {
    if (!projectForm.nom) { setError('Le nom du projet est obligatoire'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/projects', {
        nom: projectForm.nom, description: projectForm.description,
        monitoring_type: projectForm.monitoring_type,
        folder_id: projectForm.folder_id || null,
      });
      setProjectId(res.data.id);
      setStep(2);
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur création projet'); }
    finally { setLoading(false); }
  };

  const handleAddObjective = async () => {
    if (!objForm.content) { setError('Contenu obligatoire'); return; }
    if (objectives.length >= 5) { setError('Maximum 5 objectifs'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/projects/${projectId}/objectives`, {
        content: objForm.content, priority: objectives.length + 1,
      });
      setObjectives([...objectives, res.data]);
      setObjForm({ content: '' });
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur objectif'); }
    finally { setLoading(false); }
  };

  const handleDeleteObjective = async (id: string) => {
    try {
      await api.delete(`/projects/${projectId}/objectives/${id}`);
      setObjectives(objectives.filter((o: any) => o.id !== id));
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur suppression objectif'); }
  };

  const handleAddAxe = async () => {
    if (!axeForm.name || !axeForm.objective_id) { setError('Nom et objectif obligatoires'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/objectives/${axeForm.objective_id}/axes`, {
        name: axeForm.name, description: axeForm.description, priority: 1,
      });
      setAxes([...axes, { ...res.data, objective_id: axeForm.objective_id }]);
      setAxeForm({ ...axeForm, name: '', description: '' });
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur axe'); }
    finally { setLoading(false); }
  };

  const handleDeleteAxe = async (id: string, objectiveId: string) => {
    try {
      await api.delete(`/objectives/${objectiveId}/axes/${id}`);
      setAxes(axes.filter((a: any) => a.id !== id));
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur suppression axe'); }
  };

  const handleAddHypothesis = async () => {
    if (!hypForm.content || !hypForm.axis_id) { setError('Contenu et axe obligatoires'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/axes/${hypForm.axis_id}/hypotheses`, {
        content: hypForm.content, priority: 1,
      });
      setHypotheses([...hypotheses, { ...res.data, axis_id: hypForm.axis_id }]);
      setHypForm({ ...hypForm, content: '' });
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur hypothèse'); }
    finally { setLoading(false); }
  };

  const handleDeleteHyp = async (id: string, axisId: string) => {
    try {
      await api.delete(`/axes/${axisId}/hypotheses/${id}`);
      setHypotheses(hypotheses.filter((h: any) => h.id !== id));
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur suppression hypothèse'); }
  };

  const handleAddPerimeter = async () => {
    if (!perimForm.name) { setError('Nom obligatoire'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/projects/${projectId}/perimeters`, {
        name: perimForm.name, type: perimForm.type, parent_id: perimForm.parent_id || null,
      });
      setPerimeters([...perimeters, res.data]);
      setPerimForm({ ...perimForm, name: '', parent_id: '' });
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur périmètre'); }
    finally { setLoading(false); }
  };

  const handleDeletePerimeter = async (id: string) => {
    try {
      await api.delete(`/perimeters/${id}`);
      setPerimeters(perimeters.filter((p: any) => p.id !== id));
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur suppression périmètre'); }
  };

  const handleCreatePlan = async () => {
    if (!planForm.question || !planForm.hypothesis_id) { setError('Question et hypothèse obligatoires'); return; }
    if (planForm.collection_start_date && planForm.collection_end_date) {
      if (new Date(planForm.collection_end_date) < new Date(planForm.collection_start_date)) {
        setError('La date de fin ne peut pas être avant la date de début'); return;
      }
    }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/hypotheses/${planForm.hypothesis_id}/collection-plans`, {
        question: planForm.question, frequency: planForm.frequency,
        collection_start_date: planForm.collection_start_date || null,
        collection_end_date: planForm.collection_end_date || null,
      });
      const planId = res.data.id;
      for (const src of planForm.sources) {
        await api.post(`/collection-plans/${planId}/sources`, src);
      }
      for (const kw of planForm.keywords) {
        await api.post(`/collection-plans/${planId}/keywords`, kw);
      }
      setPlans([...plans, { ...res.data, sources: planForm.sources, keywords: planForm.keywords }]);
      setPlanForm({ question: '', frequency: 'DAILY', collection_start_date: '', collection_end_date: '', hypothesis_id: '', sources: [], keywords: [] });
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur plan de collecte'); }
    finally { setLoading(false); }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await api.delete(`/collection-plans/${id}`);
      setPlans(plans.filter((p: any) => p.id !== id));
    } catch (e: any) { setError(e.response?.data?.message || 'Erreur suppression plan'); }
  };

  const next = () => { setError(''); setStep((s: number) => s + 1); };
  const prev = () => { setError(''); setStep((s: number) => s - 1); };

  const handleFinish = () => {
    clearSession();
    navigate(`/projects/${projectId}`);
  };

  const DeleteBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="p-1.5 rounded-lg transition shrink-0"
      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );

  const label = (text: string) => (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>{text}</label>
  );

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3b82f6' }}>Sprint 2</p>
          <h1 className="text-2xl font-bold text-white">Nouveau projet de veille</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>Configurez votre projet étape par étape</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 shrink-0">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={step === s.id
                    ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                    : step > s.id
                      ? { background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }
                      : { background: '#1e2535', color: '#6b7280' }
                  }>
                  {step > s.id ? '✓' : s.id}
                </div>
                <p className="text-xs mt-1 hidden md:block" style={{ color: step === s.id ? '#60a5fa' : '#6b7280' }}>{s.label}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-6 h-0.5 mb-4" style={{ background: step > s.id ? '#34d399' : '#1e2535' }} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl p-3 mb-5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* ── STEP 1 : PROJET ── */}
        {step === 1 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-6">Informations du projet</h2>
            <div className="space-y-4">
              <div>
                {label('Nom du projet *')}
                <input style={inputStyle} value={projectForm.nom}
                  onChange={e => setProjectForm({ ...projectForm, nom: e.target.value })}
                  placeholder="Ex: Veille concurrentielle IA" />
              </div>
              <div>
                {label('Description')}
                <textarea style={{ ...inputStyle, resize: 'none' } as React.CSSProperties} rows={3}
                  value={projectForm.description}
                  onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="Objectif de ce projet..." />
              </div>
              <div>
                {label('Type de veille *')}
                <select style={inputStyle} value={projectForm.monitoring_type}
                  onChange={e => setProjectForm({ ...projectForm, monitoring_type: e.target.value })}>
                  {MONITORING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
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

        {/* ── STEP 2 : OBJECTIFS ── */}
        {step === 2 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Objectifs stratégiques</h2>
            <p className="text-xs mb-5" style={{ color: '#6b7280' }}>Définissez le "pourquoi" de votre veille (max 5 objectifs)</p>
            <div className="space-y-2 mb-5">
              {objectives.map((obj: any, i: number) => (
                <div key={obj.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>O{i + 1}</span>
                  <p className="text-sm text-white flex-1">{obj.content}</p>
                  <DeleteBtn onClick={() => handleDeleteObjective(obj.id)} />
                </div>
              ))}
            </div>
            {objectives.length < 5 && (
              <div className="flex gap-3">
                <input style={{ ...inputStyle, flex: 1 }} value={objForm.content}
                  onChange={e => setObjForm({ content: e.target.value })}
                  placeholder="Ex: Surveiller les tendances IA en Europe"
                  onKeyDown={e => e.key === 'Enter' && handleAddObjective()} />
                <button onClick={handleAddObjective} disabled={loading}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>+ Ajouter</button>
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

        {/* ── STEP 3 : AXES ── */}
        {step === 3 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Axes d'analyse</h2>
            <p className="text-xs mb-5" style={{ color: '#6b7280' }}>Associez des axes à chaque objectif (max 5 par objectif)</p>
            <div className="space-y-2 mb-5">
              {axes.map((axe: any) => {
                const obj = objectives.find((o: any) => o.id === axe.objective_id);
                return (
                  <div key={axe.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <div className="flex-1">
                      <p className="text-xs mb-0.5" style={{ color: '#a5b4fc' }}>{obj?.content?.substring(0, 40)}...</p>
                      <p className="text-sm font-semibold text-white">{axe.name}</p>
                    </div>
                    <DeleteBtn onClick={() => handleDeleteAxe(axe.id, axe.objective_id)} />
                  </div>
                );
              })}
            </div>
            <div className="space-y-3">
              <div>
                {label('Objectif associé *')}
                <select style={inputStyle} value={axeForm.objective_id}
                  onChange={e => setAxeForm({ ...axeForm, objective_id: e.target.value })}>
                  <option value="">Sélectionner un objectif</option>
                  {objectives.map((obj: any) => <option key={obj.id} value={obj.id}>{obj.content.substring(0, 60)}</option>)}
                </select>
              </div>
              <div>
                {label("Nom de l'axe *")}
                <input style={inputStyle} value={axeForm.name}
                  onChange={e => setAxeForm({ ...axeForm, name: e.target.value })}
                  placeholder="Ex: Axe technologique" />
              </div>
              <div>
                {label('Description')}
                <input style={inputStyle} value={axeForm.description}
                  onChange={e => setAxeForm({ ...axeForm, description: e.target.value })}
                  placeholder="Description optionnelle" />
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

        {/* ── STEP 4 : HYPOTHÈSES ── */}
        {step === 4 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Hypothèses stratégiques</h2>
            <p className="text-xs mb-5" style={{ color: '#6b7280' }}>Suppositions à tester par la collecte</p>
            <div className="space-y-2 mb-5">
              {hypotheses.map((hyp: any) => {
                const axe = axes.find((a: any) => a.id === hyp.axis_id);
                return (
                  <div key={hyp.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div className="flex-1">
                      <p className="text-xs mb-0.5" style={{ color: '#34d399' }}>Axe : {axe?.name}</p>
                      <p className="text-sm text-white">{hyp.content}</p>
                    </div>
                    <DeleteBtn onClick={() => handleDeleteHyp(hyp.id, hyp.axis_id)} />
                  </div>
                );
              })}
            </div>
            <div className="space-y-3">
              <div>
                {label('Axe associé *')}
                <select style={inputStyle} value={hypForm.axis_id}
                  onChange={e => setHypForm({ ...hypForm, axis_id: e.target.value })}>
                  <option value="">Sélectionner un axe</option>
                  {axes.map((axe: any) => <option key={axe.id} value={axe.id}>{axe.name}</option>)}
                </select>
              </div>
              <div>
                {label('Hypothèse *')}
                <textarea style={{ ...inputStyle, resize: 'none' } as React.CSSProperties} rows={2}
                  value={hypForm.content}
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

        {/* ── STEP 5 : PÉRIMÈTRES ── */}
        {step === 5 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Périmètres</h2>
            <p className="text-xs mb-5" style={{ color: '#6b7280' }}>Définissez les périmètres géographiques et sectoriels</p>
            <div className="space-y-2 mb-5">
              {perimeters.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)' }}>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold shrink-0"
                    style={p.type === 'GEOGRAPHIC'
                      ? { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }
                      : { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }
                    }>{p.type === 'GEOGRAPHIC' ? 'GEO' : 'SEC'}</span>
                  <p className="text-sm text-white flex-1">{p.name}</p>
                  <DeleteBtn onClick={() => handleDeletePerimeter(p.id)} />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {label('Nom *')}
                  <input style={inputStyle} value={perimForm.name}
                    onChange={e => setPerimForm({ ...perimForm, name: e.target.value })}
                    placeholder="Ex: Europe, Fintech..." />
                </div>
                <div>
                  {label('Type *')}
                  <select style={inputStyle} value={perimForm.type}
                    onChange={e => setPerimForm({ ...perimForm, type: e.target.value })}>
                    <option value="GEOGRAPHIC">Géographique</option>
                    <option value="SECTORAL">Sectoriel</option>
                  </select>
                </div>
              </div>
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

        {/* ── STEP 6 : PLANS DE COLLECTE ── */}
        {step === 6 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Plans de collecte</h2>
            <p className="text-xs mb-5" style={{ color: '#6b7280' }}>Configurez les questions et stratégies de collecte par hypothèse</p>
            <div className="space-y-2 mb-5">
              {plans.map((plan: any) => (
                <div key={plan.id} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-1">{plan.question}</p>
                    <div className="flex gap-3 text-xs" style={{ color: '#6b7280' }}>
                      <span>{plan.frequency}</span>
                      <span>{plan.sources?.length || 0} source(s)</span>
                      <span>{plan.keywords?.length || 0} mot(s)-clé(s)</span>
                    </div>
                  </div>
                  <DeleteBtn onClick={() => handleDeletePlan(plan.id)} />
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div>
                {label('Hypothèse associée *')}
                <select style={inputStyle} value={planForm.hypothesis_id}
                  onChange={e => setPlanForm({ ...planForm, hypothesis_id: e.target.value })}>
                  <option value="">Sélectionner une hypothèse</option>
                  {hypotheses.map((h: any) => <option key={h.id} value={h.id}>{h.content.substring(0, 70)}</option>)}
                </select>
              </div>
              <div>
                {label('Question de recherche *')}
                <textarea style={{ ...inputStyle, resize: 'none' } as React.CSSProperties} rows={2}
                  value={planForm.question}
                  onChange={e => setPlanForm({ ...planForm, question: e.target.value })}
                  placeholder="Ex: Quelles sont les dernières publications sur les LLM ?" />
              </div>
              <div>
                {label('Fréquence de collecte *')}
                <select style={inputStyle} value={planForm.frequency}
                  onChange={e => setPlanForm({ ...planForm, frequency: e.target.value })}>
                  <option value="ON_DEMAND">À la demande</option>
                  <option value="DAILY">Quotidienne</option>
                  <option value="WEEKLY">Hebdomadaire</option>
                  <option value="MONTHLY">Mensuelle</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {label('Début collecte')}
                  <input type="date" style={inputStyle} value={planForm.collection_start_date}
                    onChange={e => setPlanForm({ ...planForm, collection_start_date: e.target.value })} />
                </div>
                <div>
                  {label('Fin collecte')}
                  <input type="date" style={inputStyle} value={planForm.collection_end_date}
                    onChange={e => setPlanForm({ ...planForm, collection_end_date: e.target.value })} />
                </div>
              </div>

              {/* Sources */}
              <div className="rounded-xl p-4" style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
                {label('Sources de collecte')}
                <div className="space-y-2 mb-3">
                  {planForm.sources.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <span className="font-bold shrink-0" style={{ color: '#60a5fa' }}>{s.source_type}</span>
                      <span className="text-white shrink-0">{s.source_label}</span>
                      {s.source_url && <span className="truncate flex-1" style={{ color: '#6b7280' }}>{s.source_url}</span>}
                      <button onClick={() => setPlanForm({ ...planForm, sources: planForm.sources.filter((_: any, j: number) => j !== i) })}
                        style={{ color: '#ef4444' }}>×</button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      {label('Type de source')}
                      <select style={inputStyle} value={sourceForm.source_type}
                        onChange={e => setSourceForm({ ...sourceForm, source_type: e.target.value, source_url: '' })}>
                        <option value="RSS">RSS — Flux RSS</option>
                        <option value="WEB">Web — Page web</option>
                        <option value="API">API — Endpoint REST</option>
                        <option value="DOCUMENT">Document — PDF / fichier</option>
                      </select>
                    </div>
                    <div>
                      {label('Libellé *')}
                      <input style={inputStyle} value={sourceForm.source_label}
                        onChange={e => setSourceForm({ ...sourceForm, source_label: e.target.value })}
                        placeholder="Ex: Reuters RSS, Mon PDF..." />
                    </div>
                  </div>
                  {(sourceForm.source_type === 'RSS' || sourceForm.source_type === 'WEB' || sourceForm.source_type === 'API') && (
                    <div>
                      {label(sourceForm.source_type === 'RSS' ? 'URL du flux RSS *' : sourceForm.source_type === 'API' ? "URL de l'endpoint API *" : 'URL de la page web *')}
                      <input style={inputStyle} value={sourceForm.source_url}
                        onChange={e => setSourceForm({ ...sourceForm, source_url: e.target.value })}
                        placeholder={sourceForm.source_type === 'RSS' ? 'https://feeds.reuters.com/...' : 'https://...'}  />
                    </div>
                  )}
                  {sourceForm.source_type === 'DOCUMENT' && (
                    <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                      Les documents PDF peuvent être uploadés depuis la page du plan de collecte après la création du projet.
                    </div>
                  )}
                  <div>
                    {label('Fréquence de collecte')}
                    <select style={inputStyle} value={sourceForm.frequency}
                      onChange={e => setSourceForm({ ...sourceForm, frequency: e.target.value })}>
                      <option value="ON_DEMAND">À la demande</option>
                      <option value="DAILY">Quotidienne</option>
                      <option value="WEEKLY">Hebdomadaire</option>
                      <option value="MONTHLY">Mensuelle</option>
                    </select>
                  </div>
                  <button onClick={() => {
                    if (sourceForm.source_label) {
                      setPlanForm({ ...planForm, sources: [...planForm.sources, { ...sourceForm }] });
                      setSourceForm({ source_type: 'RSS', source_label: '', source_url: '', frequency: 'DAILY' });
                    }
                  }} className="w-full py-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: '#3b82f6' }}>+ Ajouter la source</button>
                </div>
              </div>

              {/* Mots-clés */}
              <div className="rounded-xl p-4" style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
                {label('Mots-clés de filtrage')}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#34d399' }}>Inclus</p>
                    <div className="flex flex-wrap gap-1.5 min-h-6">
                      {planForm.keywords.filter((k: any) => k.keyword_type === 'INCLUDE').map((kw: any, i: number) => (
                        <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                          {kw.keyword}
                          <button onClick={() => setPlanForm({ ...planForm, keywords: planForm.keywords.filter((_: any, j: number) => planForm.keywords.indexOf(kw) !== j) })}
                            style={{ color: '#ef4444' }}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#f87171' }}>Exclus</p>
                    <div className="flex flex-wrap gap-1.5 min-h-6">
                      {planForm.keywords.filter((k: any) => k.keyword_type === 'EXCLUDE').map((kw: any, i: number) => (
                        <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                          {kw.keyword}
                          <button onClick={() => setPlanForm({ ...planForm, keywords: planForm.keywords.filter((_: any, j: number) => planForm.keywords.indexOf(kw) !== j) })}
                            style={{ color: '#ef4444' }}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <select style={{ ...inputStyle, flex: '0 0 120px' }} value={kwForm.keyword_type}
                    onChange={e => setKwForm({ ...kwForm, keyword_type: e.target.value })}>
                    <option value="INCLUDE">Inclure</option>
                    <option value="EXCLUDE">Exclure</option>
                  </select>
                  <input style={{ ...inputStyle, flex: 1 }} value={kwForm.keyword}
                    onChange={e => setKwForm({ ...kwForm, keyword: e.target.value })}
                    placeholder="Mot-clé..."
                    onKeyDown={e => {
                      if (e.key === 'Enter' && kwForm.keyword) {
                        setPlanForm({ ...planForm, keywords: [...planForm.keywords, { ...kwForm }] });
                        setKwForm({ keyword: '', keyword_type: kwForm.keyword_type });
                      }
                    }} />
                  <button onClick={() => {
                    if (kwForm.keyword) {
                      setPlanForm({ ...planForm, keywords: [...planForm.keywords, { ...kwForm }] });
                      setKwForm({ keyword: '', keyword_type: kwForm.keyword_type });
                    }
                  }} className="px-3 py-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: '#6366f1' }}>+</button>
                </div>
              </div>

              <button onClick={handleCreatePlan} disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', opacity: loading ? 0.5 : 1 }}>
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

        {/* ── STEP 7 : STAKEHOLDERS ── */}
        {step === 7 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-2">Parties prenantes</h2>
            <p className="text-xs mb-6" style={{ color: '#6b7280' }}>Optionnel — peuvent être ajoutés depuis la page du projet</p>
            <div className="rounded-xl p-4 text-center" style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Les stakeholders peuvent être ajoutés depuis la page du projet après sa création.
              </p>
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={prev} className="px-4 py-2 rounded-xl text-sm" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>← Retour</button>
              <button onClick={next} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>Suivant →</button>
            </div>
          </div>
        )}

        {/* ── STEP 8 : RÉVISION ── */}
        {step === 8 && (
          <div style={cardStyle}>
            <h2 className="text-lg font-bold text-white mb-6">Révision du projet</h2>
            <div className="space-y-3">
              {[
                { label: 'Projet',           value: projectForm.nom,                                                         color: '#60a5fa' },
                { label: 'Type de veille',   value: MONITORING_TYPES.find(t => t.value === projectForm.monitoring_type)?.label, color: '#a5b4fc' },
                { label: 'Objectifs',        count: objectives.length,  color: '#34d399' },
                { label: 'Axes',             count: axes.length,        color: '#a5b4fc' },
                { label: 'Hypothèses',       count: hypotheses.length,  color: '#fb923c' },
                { label: 'Périmètres',       count: perimeters.length,  color: '#f472b6' },
                { label: 'Plans de collecte',count: plans.length,       color: '#34d399' },
              ].map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  {item.value
                    ? <p className="text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
                    : <span className="text-sm font-bold px-3 py-1 rounded-full"
                        style={{ background: 'rgba(59,130,246,0.1)', color: item.color }}>
                        {item.count} élément(s)
                      </span>
                  }
                </div>
              ))}
            </div>
            <div className="mt-5 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p className="text-sm font-semibold" style={{ color: '#34d399' }}>Projet prêt pour la collecte</p>
              <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Vous pouvez maintenant lancer la collecte depuis la page du projet.</p>
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={prev} className="px-4 py-2 rounded-xl text-sm" style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>← Retour</button>
              <button onClick={handleFinish}
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
