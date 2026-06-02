import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import { collectionPlanService, uploadService } from '../../services/api';

import type { CollectionJob, RawItem } from '../../types';

const SOURCE_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  RSS:    { bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', border: 'rgba(59,130,246,0.2)' },
  WEB:    { bg: 'rgba(16,185,129,0.1)', color: '#34d399', border: 'rgba(16,185,129,0.2)' },
  PDF:    { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', border: 'rgba(239,68,68,0.2)'  },
  UPLOAD: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
};

const JOB_STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING: { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', border: 'rgba(251,191,36,0.2)',  label: 'En attente'  },
  RUNNING: { bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', border: 'rgba(59,130,246,0.2)',  label: 'En cours'    },
  DONE:    { bg: 'rgba(16,185,129,0.1)',  color: '#34d399', border: 'rgba(16,185,129,0.2)',  label: 'Termine'     },
  FAILED:  { bg: 'rgba(239,68,68,0.1)',   color: '#f87171', border: 'rgba(239,68,68,0.2)',   label: 'Echoue'      },
};

const SUGGESTED_RSS = [
  { label: 'TechCrunch IA',     url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { label: 'TechCrunch',        url: 'https://techcrunch.com/feed/' },
  { label: 'MIT Tech Review',   url: 'https://www.technologyreview.com/feed/' },
  { label: 'The Verge',         url: 'https://www.theverge.com/rss/index.xml' },
  { label: 'Wired',             url: 'https://www.wired.com/feed/rss' },
  { label: 'Les Echos Finance', url: 'https://www.lesechos.fr/rss/rss_finance_marches.xml' },
];

const cardStyle = {
  background: '#161b27',
  border: '1px solid #1e2535',
  borderRadius: '1rem',
};

const inputStyle: React.CSSProperties = {
  background: '#0f1117',
  border: '1px solid #1e2535',
  color: 'white',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.8125rem',
  outline: 'none',
  width: '100%',
};

export default function CollectionPlanDetailPage() {
  const { planId, projectId } = useParams<{ planId: string; projectId: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'rawdata' | 'upload'>('overview');
  const [rawPage, setRawPage] = useState(1);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [deletingPdfId, setDeletingPdfId] = useState<string | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);

  const [newSource, setNewSource] = useState({
    source_type: 'RSS',
    source_label: '',
    source_url: '',
    frequency: 'DAILY',
    api_key: '',
    api_method: 'GET',
    document_note: '',
  });
  const [addingSource, setAddingSource] = useState(false);
  const [addSourceMsg, setAddSourceMsg] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordType, setNewKeywordType] = useState<'PRINCIPAL' | 'EXCLUDE'>('PRINCIPAL');
  const [addingKeyword, setAddingKeyword] = useState(false);

  // Queries
  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ['collection-plan', planId],
    queryFn: () => collectionPlanService.getById(planId!).then(r => r.data),
    enabled: !!planId,
  });

  const { data: jobsData, refetch: refetchJobs } = useQuery({
    queryKey: ['jobs', planId],
    queryFn: () => collectionPlanService.getJobs(planId!).then(r => r.data),
    enabled: !!planId,
    refetchInterval: running ? 3000 : false,
  });

  const { data: rawData, refetch: refetchRaw } = useQuery({
    queryKey: ['raw-items', planId, rawPage],
    queryFn: () => collectionPlanService.getRawItems(planId!, rawPage, 15).then(r => r.data),
    enabled: !!planId,
  });

  const { data: uploadsData, refetch: refetchUploads } = useQuery({
    queryKey: ['uploads', planId],
    queryFn: () => uploadService.getByPlan(planId!).then(r => r.data),
    enabled: !!planId,
  });

  // Mutations
  const removeSourceMutation = useMutation({
    mutationFn: (sourceId: string) => collectionPlanService.removeSource(sourceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collection-plan', planId] }),
  });

  const removeKeywordMutation = useMutation({
    mutationFn: (keywordId: string) => collectionPlanService.removeKeyword(keywordId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collection-plan', planId] }),
  });

  const deletePdfMutation = useMutation({
    mutationFn: (rawItemId: string) => uploadService.deletePdf(rawItemId),
    onSuccess: async () => {
      await Promise.all([
        refetchUploads(),
        refetchRaw(),
        queryClient.invalidateQueries({ queryKey: ['raw-items', planId] }),
      ]);
      setUploadMsg('PDF supprimé avec succès');
    },
    onError: (e: any) => {
      setUploadMsg(e.response?.data?.message || 'Erreur lors de la suppression');
    },
    onSettled: () => setDeletingPdfId(null),
  });

  // Handlers
  const handleAddSource = async () => {
    const type = newSource.source_type.toUpperCase();
    if (!newSource.source_label.trim()) {
      setAddSourceMsg('Le libellé est obligatoire');
      return;
    }
    if ((type === 'RSS' || type === 'WEB' || type === 'PDF' || type === 'API') && !newSource.source_url.trim()) {
      setAddSourceMsg('URL obligatoire pour ce type de source');
      return;
    }
    setAddingSource(true);
    setAddSourceMsg('');
    try {
      await collectionPlanService.addSource(planId!, {
        source_type: type,
        source_label: newSource.source_label.trim(),
        source_url: newSource.source_url.trim() || undefined,
        frequency: newSource.frequency,
        api_key: newSource.api_key || undefined,
        api_method: newSource.api_method,
        metadata:
          type === 'API'
            ? { api_key: newSource.api_key, api_method: newSource.api_method }
            : type === 'DOCUMENT'
              ? { document_note: newSource.document_note }
              : undefined,
      });
      setNewSource({ source_type: 'RSS', source_label: '', source_url: '', frequency: 'DAILY', api_key: '', api_method: 'GET', document_note: '' });
      setShowAddSource(false);
      setAddSourceMsg('Source ajoutee avec succes');
      queryClient.invalidateQueries({ queryKey: ['collection-plan', planId] });
    } catch (e: any) {
      setAddSourceMsg(e.response?.data?.message || 'Erreur lors de l\'ajout');
    } finally {
      setAddingSource(false);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    setAddingKeyword(true);
    try {
      await collectionPlanService.addKeyword(planId!, {
        keyword: newKeyword.trim(),
        keyword_type: newKeywordType,
      });
      setNewKeyword('');
      queryClient.invalidateQueries({ queryKey: ['collection-plan', planId] });
    } catch (e: any) {
      console.error(e);
    } finally {
      setAddingKeyword(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setRunMsg('');
    try {
      const res = await collectionPlanService.run(planId!);
      const d = res.data;
      setRunMsg(`${d.collected} article(s) collecte(s), ${d.duplicates} doublon(s) ignore(s)`);
      await refetchJobs();
      await refetchRaw();
    } catch (e: any) {
      setRunMsg(e.response?.data?.message || 'Erreur lors de la collecte');
    } finally {
      setRunning(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !planId) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const res = await uploadService.uploadPdf(planId, uploadFile);
      const d = res.data;
      setUploadMsg(d.duplicate ? 'Ce fichier existe deja' : 'PDF uploade avec succes');
      setUploadFile(null);
      await refetchUploads();
      await refetchRaw();
    } catch (e: any) {
      setUploadMsg(e.response?.data?.message || 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePdf = (rawItemId: string, title?: string | null) => {
    const label = title || 'ce PDF';
    if (!confirm(`Supprimer « ${label} » ? Cette action est irréversible.`)) return;
    setDeletingPdfId(rawItemId);
    deletePdfMutation.mutate(rawItemId);
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const jobs: CollectionJob[] = Array.isArray(jobsData) ? jobsData : [];
  const rawItems: RawItem[] = rawData?.data || [];
  const uploads: RawItem[] = Array.isArray(uploadsData) ? uploadsData : Array.isArray(uploadsData?.data) ? uploadsData.data : [];

  const tabs = [
    { key: 'overview', label: 'Vue d\'ensemble'                         },
    { key: 'jobs',     label: `Jobs (${jobs.length})`                   },
    { key: 'rawdata',  label: `Donnees collectees (${rawData?.total || 0})` },
    { key: 'upload',   label: `Upload PDF (${uploads.length})`          },
  ];

  if (planLoading) {
    return (
      <Layout>
        <div className="p-8 text-sm" style={{ color: '#6b7280' }}>Chargement...</div>
      </Layout>
    );
  }

  if (!plan) {
    return (
      <Layout>
        <div className="p-8 text-sm" style={{ color: '#f87171' }}>Plan introuvable</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-xs" style={{ color: '#6b7280' }}>
          <Link to="/projects" className="hover:text-white transition">Projets</Link>
          <span>/</span>
          <Link to={`/projects/${projectId}`} className="hover:text-white transition">Projet</Link>
          <span>/</span>
          <span style={{ color: '#e5e7eb' }}>Plan de collecte</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white mb-3 leading-snug max-w-3xl">
              {plan.question}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
                {plan.frequency}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={plan.is_active
                  ? { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }
                  : { background: 'rgba(107,114,128,0.1)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.2)' }
                }>
                {plan.is_active ? 'Actif' : 'Inactif'}
              </span>
              {plan.last_run_at && (
                <span className="text-xs" style={{ color: '#6b7280' }}>
                  Dernier run : {formatDate(plan.last_run_at)}
                </span>
              )}
              {plan.next_run_at && (
                <span className="text-xs" style={{ color: '#6b7280' }}>
                  Prochain : {formatDate(plan.next_run_at)}
                </span>
              )}
            </div>
          </div>

          {/* Bouton Lancer */}
          <div className="flex flex-col items-end gap-2 ml-6">
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition"
              style={{
                background: running ? '#1e2535' : 'linear-gradient(135deg,#3b82f6,#6366f1)',
                color: running ? '#6b7280' : 'white',
                cursor: running ? 'not-allowed' : 'pointer',
              }}>
              {running ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Collecte en cours...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Lancer la collecte
                </>
              )}
            </button>
            {runMsg && (
              <p className="text-xs text-right max-w-xs"
                style={{ color: runMsg.includes('Erreur') ? '#f87171' : '#34d399' }}>
                {runMsg}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Sources',            value: plan.sources?.length || 0,  color: '#60a5fa', bg: 'rgba(59,130,246,0.1)'  },
            { label: 'Mots-cles',          value: plan.keywords?.length || 0, color: '#a5b4fc', bg: 'rgba(99,102,241,0.1)'  },
            { label: 'Jobs executes',      value: jobs.length,                color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
            { label: 'Donnees collectees', value: rawData?.total || 0,        color: '#34d399', bg: 'rgba(16,185,129,0.1)'  },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-2xl flex items-center gap-4"
              style={{ background: '#161b27', border: '1px solid #1e2535' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ background: stat.bg, color: stat.color }}>
                {stat.value}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6b7280' }}>
                  {stat.label}
                </p>
                <p className="text-sm font-semibold text-white">Total</p>
              </div>
            </div>
          ))}
        </div>

        {/* Onglets */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={activeTab === tab.key
                ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                : { background: '#161b27', color: '#6b7280', border: '1px solid #1e2535' }
              }>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: VUE D'ENSEMBLE */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Sources */}
            <div style={cardStyle} className="overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid #1e2535' }}>
                <h2 className="text-sm font-bold text-white">Sources configurees</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                    {plan.sources?.length || 0}
                  </span>
                  <button
                    onClick={() => { setShowAddSource(!showAddSource); setAddSourceMsg(''); }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }}>
                    {showAddSource ? 'Fermer' : '+ Ajouter'}
                  </button>
                </div>
              </div>

              {/* Formulaire ajout source */}
              {showAddSource && (
                <div className="p-4" style={{ borderBottom: '1px solid #1e2535', background: 'rgba(59,130,246,0.03)' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: '#60a5fa' }}>
                    Nouvelle source
                  </p>
                  <div className="space-y-2 mb-3">
                    <select
                      value={newSource.source_type}
                      onChange={e => setNewSource({ ...newSource, source_type: e.target.value })}
                      style={inputStyle}>
                      <option value="RSS">RSS</option>
                      <option value="WEB">Web</option>
                      <option value="PDF">PDF (liens)</option>
                      <option value="API">API</option>
                      <option value="DOCUMENT">Document (upload manuel)</option>
                    </select>
                    <input
                      value={newSource.source_label}
                      onChange={e => setNewSource({ ...newSource, source_label: e.target.value })}
                      placeholder="Label (ex: TechCrunch)"
                      style={inputStyle}
                    />
                    {newSource.source_type !== 'DOCUMENT' && (
                      <input
                        value={newSource.source_url}
                        onChange={e => setNewSource({ ...newSource, source_url: e.target.value })}
                        placeholder={newSource.source_type === 'API' ? 'https://api.example.com/data' : 'https://example.com/feed/'}
                        style={inputStyle}
                      />
                    )}
                    {newSource.source_type === 'API' && (
                      <>
                        <select value={newSource.api_method} onChange={e => setNewSource({ ...newSource, api_method: e.target.value })} style={inputStyle}>
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                        </select>
                        <input value={newSource.api_key} onChange={e => setNewSource({ ...newSource, api_key: e.target.value })} placeholder="Clé API (optionnel)" style={inputStyle} />
                      </>
                    )}
                    {newSource.source_type === 'DOCUMENT' && (
                      <input value={newSource.document_note} onChange={e => setNewSource({ ...newSource, document_note: e.target.value })} placeholder="Référence document / instructions" style={inputStyle} />
                    )}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca3af' }}>Fréquence</label>
                      <select value={newSource.frequency} onChange={e => setNewSource({ ...newSource, frequency: e.target.value })} style={inputStyle}>
                        <option value="ON_DEMAND">À la demande</option>
                        <option value="DAILY">Quotidienne</option>
                        <option value="WEEKLY">Hebdomadaire</option>
                        <option value="MONTHLY">Mensuelle</option>
                      </select>
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold mb-2" style={{ color: '#4b5568' }}>
                      Suggestions (cliquez pour remplir) :
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_RSS.map((s) => (
                        <button
                          key={s.url}
                          onClick={() => setNewSource({ ...newSource, source_label: s.label, source_url: s.url })}
                          className="text-[10px] px-2 py-1 rounded-lg transition hover:opacity-80"
                          style={{ background: '#1e2535', color: '#9ca3af', border: '1px solid #2d3748' }}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {addSourceMsg && (
                    <p className="text-xs mb-2"
                      style={{ color: addSourceMsg.includes('succes') ? '#34d399' : '#f87171' }}>
                      {addSourceMsg}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddSource}
                      disabled={addingSource}
                      className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', opacity: addingSource ? 0.5 : 1 }}>
                      {addingSource ? 'Ajout...' : 'Ajouter la source'}
                    </button>
                    <button
                      onClick={() => { setShowAddSource(false); setAddSourceMsg(''); }}
                      className="px-4 py-2 rounded-lg text-xs font-medium transition"
                      style={{ border: '1px solid #1e2535', color: '#9ca3af' }}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* Message succes */}
              {!showAddSource && addSourceMsg.includes('succes') && (
                <div className="px-4 py-2" style={{ background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid #1e2535' }}>
                  <p className="text-xs" style={{ color: '#34d399' }}>{addSourceMsg}</p>
                </div>
              )}

              {/* Liste sources */}
              <div className="p-4 space-y-2">
                {(!plan.sources || plan.sources.length === 0) ? (
                  <div className="py-8 text-center">
                    <p className="text-xs mb-3" style={{ color: '#6b7280' }}>Aucune source configuree</p>
                    <button
                      onClick={() => setShowAddSource(true)}
                      className="text-xs font-bold px-4 py-2 rounded-lg text-white"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                      Ajouter une source
                    </button>
                  </div>
                ) : (
                  plan.sources.map((src: any) => {
                    const srcStyle = SOURCE_TYPE_COLORS[src.source_type?.toUpperCase()] || SOURCE_TYPE_COLORS.RSS;
                    return (
                      <div key={src.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: '#0f1117', border: '1px solid #1e2535' }}>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                          style={{ background: srcStyle.bg, color: srcStyle.color, border: `1px solid ${srcStyle.border}` }}>
                          {src.source_type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{src.source_label}</p>
                          <p className="text-[10px] truncate" style={{ color: '#6b7280' }}>{src.source_url}</p>
                        </div>
                        <button
                          onClick={() => removeSourceMutation.mutate(src.id)}
                          className="p-1 rounded-lg shrink-0 transition hover:bg-red-500/10"
                          style={{ color: '#6b7280' }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Mots-cles — avec ajout inline */}
            <div style={cardStyle} className="overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid #1e2535' }}>
                <h2 className="text-sm font-bold text-white">Mots-cles</h2>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                  {plan.keywords?.length || 0}
                </span>
              </div>
              <div className="p-4">
                {/* Ajout mot-cle */}
                <div className="flex gap-2 mb-4">
                  <input
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                    placeholder="Nouveau mot-cle..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <select
                    value={newKeywordType}
                    onChange={e => setNewKeywordType(e.target.value as any)}
                    style={{ ...inputStyle, width: 'auto' }}>
                    <option value="PRINCIPAL">Inclure</option>
                    <option value="EXCLUDE">Exclure</option>
                  </select>
                  <button
                    onClick={handleAddKeyword}
                    disabled={addingKeyword || !newKeyword.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition"
                    style={{
                      background: !newKeyword.trim() ? '#1e2535' : 'linear-gradient(135deg,#3b82f6,#6366f1)',
                      opacity: addingKeyword ? 0.5 : 1,
                    }}>
                    +
                  </button>
                </div>

                {/* Inclus */}
                <div className="mb-4">
                  <p className="text-xs font-semibold mb-2" style={{ color: '#34d399' }}>Inclus</p>
                  <div className="flex flex-wrap gap-1.5 min-h-8">
                    {plan.keywords
                      ?.filter((k: any) => k.keyword_type === 'INCLUDE' || k.keyword_type === 'PRINCIPAL')
                      .map((kw: any) => (
                        <span key={kw.id}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                          {kw.keyword}
                          <button onClick={() => removeKeywordMutation.mutate(kw.id)}
                            className="ml-0.5 hover:text-red-400 transition">
                            x
                          </button>
                        </span>
                      ))}
                    {!plan.keywords?.some((k: any) => k.keyword_type === 'INCLUDE' || k.keyword_type === 'PRINCIPAL') && (
                      <span className="text-xs" style={{ color: '#4b5568' }}>Aucun</span>
                    )}
                  </div>
                </div>

                {/* Exclus */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#f87171' }}>Exclus</p>
                  <div className="flex flex-wrap gap-1.5 min-h-8">
                    {plan.keywords
                      ?.filter((k: any) => k.keyword_type === 'EXCLUDE')
                      .map((kw: any) => (
                        <span key={kw.id}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                          {kw.keyword}
                          <button onClick={() => removeKeywordMutation.mutate(kw.id)}
                            className="ml-0.5 hover:text-red-400 transition">
                            x
                          </button>
                        </span>
                      ))}
                    {!plan.keywords?.some((k: any) => k.keyword_type === 'EXCLUDE') && (
                      <span className="text-xs" style={{ color: '#4b5568' }}>Aucun</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Temporalite */}
            <div style={cardStyle} className="overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #1e2535' }}>
                <h2 className="text-sm font-bold text-white">Temporalite</h2>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'Debut de collecte', value: formatDate(plan.collection_start_date) },
                  { label: 'Fin de collecte',   value: formatDate(plan.collection_end_date)   },
                  { label: 'Frequence',          value: plan.frequency                         },
                  { label: 'Dernier run',        value: formatDate(plan.last_run_at)           },
                  { label: 'Prochain run',       value: formatDate(plan.next_run_at)           },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2"
                    style={{ borderBottom: i < 4 ? '1px solid #1e2535' : 'none' }}>
                    <p className="text-xs font-medium" style={{ color: '#6b7280' }}>{item.label}</p>
                    <p className="text-xs font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dernier job */}
            <div style={cardStyle} className="overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #1e2535' }}>
                <h2 className="text-sm font-bold text-white">Dernier job</h2>
              </div>
              <div className="p-4">
                {jobs.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs mb-4" style={{ color: '#6b7280' }}>Aucun job execute</p>
                    <button onClick={handleRun} disabled={running}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                      Lancer le premier run
                    </button>
                  </div>
                ) : (() => {
                  const lastJob = jobs[0];
                  const s = JOB_STATUS_STYLE[lastJob.status] || JOB_STATUS_STYLE.PENDING;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          {s.label}
                        </span>
                        <span className="text-xs" style={{ color: '#6b7280' }}>
                          {formatDate(lastJob.created_at)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: 'Demarre', value: formatDate(lastJob.started_at)  },
                          { label: 'Termine', value: formatDate(lastJob.finished_at) },
                          { label: 'Duree',   value: formatDuration(lastJob.started_at, lastJob.finished_at) },
                          { label: 'Trigger', value: lastJob.trigger_type            },
                        ].map((item, i) => (
                          <div key={i} className="flex justify-between py-1.5"
                            style={{ borderBottom: '1px solid #1e2535' }}>
                            <span className="text-xs" style={{ color: '#6b7280' }}>{item.label}</span>
                            <span className="text-xs font-semibold text-white">{item.value}</span>
                          </div>
                        ))}
                      </div>
                      {lastJob.logs && typeof lastJob.logs === 'object' && (
                        <div className="mt-3 p-3 rounded-xl" style={{ background: '#0f1117' }}>
                          <p className="text-[10px] font-semibold mb-1.5" style={{ color: '#6b7280' }}>RESUME</p>
                          <div className="flex gap-4">
                            {(lastJob.logs as any).collected !== undefined && (
                              <div className="text-center">
                                <p className="text-lg font-bold" style={{ color: '#34d399' }}>
                                  {(lastJob.logs as any).collected}
                                </p>
                                <p className="text-[10px]" style={{ color: '#6b7280' }}>Collectes</p>
                              </div>
                            )}
                            {(lastJob.logs as any).duplicates !== undefined && (
                              <div className="text-center">
                                <p className="text-lg font-bold" style={{ color: '#fbbf24' }}>
                                  {(lastJob.logs as any).duplicates}
                                </p>
                                <p className="text-[10px]" style={{ color: '#6b7280' }}>Doublons</p>
                              </div>
                            )}
                            {(lastJob.logs as any).error && (
                              <p className="text-xs" style={{ color: '#f87171' }}>
                                {(lastJob.logs as any).error}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB: JOBS */}
        {activeTab === 'jobs' && (
          <div style={cardStyle} className="overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid #1e2535' }}>
              <h2 className="text-sm font-bold text-white">Historique des jobs</h2>
              <button onClick={() => refetchJobs()}
                className="text-xs px-3 py-1.5 rounded-lg transition"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                Actualiser
              </button>
            </div>
            {jobs.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>Aucun job execute</p>
                <p className="text-xs mt-1" style={{ color: '#4b5568' }}>
                  Lancez une collecte pour voir les jobs ici
                </p>
              </div>
            ) : (
              <div>
                {jobs.map((job) => {
                  const s = JOB_STATUS_STYLE[job.status] || JOB_STATUS_STYLE.PENDING;
                  const logs = job.logs as any;
                  return (
                    <div key={job.id} className="px-5 py-4"
                      style={{ borderBottom: '1px solid #1e2535' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                            {s.label}
                          </span>
                          <div>
                            <p className="text-xs font-mono" style={{ color: '#6b7280' }}>
                              #{job.id.slice(0, 8)}...
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: '#4b5568' }}>
                              {job.trigger_type} · {formatDate(job.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-white">
                            Duree : {formatDuration(job.started_at, job.finished_at)}
                          </p>
                          {logs?.collected !== undefined && (
                            <p className="text-xs mt-0.5" style={{ color: '#34d399' }}>
                              {logs.collected} collecte(s), {logs.duplicates || 0} doublon(s)
                            </p>
                          )}
                          {logs?.error && (
                            <p className="text-xs mt-0.5" style={{ color: '#f87171' }}>
                              {logs.error}
                            </p>
                          )}
                        </div>
                      </div>
                      {logs?.sources && Array.isArray(logs.sources) && logs.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {logs.sources.map((src: any, i: number) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-md"
                              style={{ background: '#0f1117', color: '#9ca3af', border: '1px solid #1e2535' }}>
                              {src.source} · {src.items} items
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: RAW DATA */}
        {activeTab === 'rawdata' && (
          <div style={cardStyle} className="overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid #1e2535' }}>
              <div>
                <h2 className="text-sm font-bold text-white">Donnees brutes collectees</h2>
                <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                  {rawData?.total || 0} item(s) au total
                </p>
              </div>
              <button onClick={() => refetchRaw()}
                className="text-xs px-3 py-1.5 rounded-lg transition"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                Actualiser
              </button>
            </div>

            {rawItems.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>Aucune donnee collectee</p>
                <p className="text-xs mt-1 mb-6" style={{ color: '#4b5568' }}>
                  Ajoutez une source puis lancez la collecte
                </p>
                <button onClick={() => { setActiveTab('overview'); setShowAddSource(true); }}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                  Ajouter une source
                </button>
              </div>
            ) : (
              <>
                <div>
                  {rawItems.map((item) => {
                    const style = SOURCE_TYPE_COLORS[item.source_type?.toUpperCase()] || SOURCE_TYPE_COLORS.RSS;
                    return (
                      <div key={item.id} className="px-5 py-4 hover:bg-white/5 transition"
                        style={{ borderBottom: '1px solid #1e2535' }}>
                        <div className="flex items-start gap-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 mt-0.5"
                            style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                            {item.source_type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white leading-snug mb-1 line-clamp-2">
                              {item.title || 'Sans titre'}
                            </p>
                            {item.article_url && (
                              <a href={item.article_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs truncate block hover:underline"
                                style={{ color: '#60a5fa' }}>
                                {item.article_url}
                              </a>
                            )}
                            {item.file_path && (
                              <p className="text-xs truncate" style={{ color: '#6b7280' }}>
                                {item.file_path.split('/').pop()}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px]" style={{ color: '#4b5568' }}>
                                Source : {item.source_name || '—'}
                              </span>
                              <span className="text-[10px]" style={{ color: '#4b5568' }}>
                                Collecte : {formatDate(item.fetched_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {rawData && rawData.totalPages > 1 && (
                  <div className="px-5 py-4 flex items-center justify-between"
                    style={{ borderTop: '1px solid #1e2535' }}>
                    <button
                      onClick={() => setRawPage(p => Math.max(1, p - 1))}
                      disabled={rawPage === 1}
                      className="text-xs px-3 py-1.5 rounded-lg transition"
                      style={{
                        background: rawPage === 1 ? '#1e2535' : 'rgba(59,130,246,0.1)',
                        color: rawPage === 1 ? '#4b5568' : '#60a5fa',
                        border: '1px solid #1e2535',
                      }}>
                      Precedent
                    </button>
                    <span className="text-xs" style={{ color: '#6b7280' }}>
                      Page {rawData.page} / {rawData.totalPages}
                    </span>
                    <button
                      onClick={() => setRawPage(p => Math.min(rawData.totalPages, p + 1))}
                      disabled={rawPage === rawData.totalPages}
                      className="text-xs px-3 py-1.5 rounded-lg transition"
                      style={{
                        background: rawPage === rawData.totalPages ? '#1e2535' : 'rgba(59,130,246,0.1)',
                        color: rawPage === rawData.totalPages ? '#4b5568' : '#60a5fa',
                        border: '1px solid #1e2535',
                      }}>
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB: UPLOAD PDF */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div style={cardStyle} className="overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #1e2535' }}>
                <h2 className="text-sm font-bold text-white">Uploader un PDF</h2>
                <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                  Le fichier sera ajoute aux donnees brutes du plan
                </p>
              </div>
              <div className="p-6">
                <div
                  className="rounded-2xl p-8 text-center transition"
                  style={{ border: '2px dashed #1e2535', background: '#0f1117' }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type === 'application/pdf') {
                      setUploadFile(file);
                      setUploadMsg('');
                    } else {
                      setUploadMsg('Seuls les fichiers PDF sont acceptes');
                    }
                  }}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <svg className="w-8 h-8" style={{ color: '#f87171' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  {uploadFile ? (
                    <div>
                      <p className="text-sm font-semibold text-white mb-1">{uploadFile.name}</p>
                      <p className="text-xs" style={{ color: '#6b7280' }}>
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button onClick={() => setUploadFile(null)}
                        className="mt-2 text-xs" style={{ color: '#f87171' }}>
                        Retirer
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-white mb-1">Glissez un PDF ici</p>
                      <p className="text-xs mb-4" style={{ color: '#6b7280' }}>ou</p>
                      <label className="cursor-pointer">
                        <input type="file" accept=".pdf" className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) { setUploadFile(file); setUploadMsg(''); }
                          }}
                        />
                        <span className="inline-block text-sm font-bold px-5 py-2.5 rounded-xl text-white cursor-pointer"
                          style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                          Parcourir...
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {uploadMsg && (
                  <p className="mt-3 text-xs text-center"
                    style={{ color: uploadMsg.includes('succes') ? '#34d399' : uploadMsg.includes('deja') ? '#fbbf24' : '#f87171' }}>
                    {uploadMsg}
                  </p>
                )}

                <button onClick={handleUpload} disabled={!uploadFile || uploading}
                  className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold transition"
                  style={{
                    background: !uploadFile || uploading ? '#1e2535' : 'linear-gradient(135deg,#3b82f6,#6366f1)',
                    color: !uploadFile || uploading ? '#4b5568' : 'white',
                    cursor: !uploadFile || uploading ? 'not-allowed' : 'pointer',
                  }}>
                  {uploading ? 'Upload en cours...' : 'Uploader le PDF'}
                </button>
              </div>
            </div>

            {/* Liste PDFs */}
            <div style={cardStyle} className="overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #1e2535' }}>
                <h2 className="text-sm font-bold text-white">PDFs uploades ({uploads.length})</h2>
              </div>
              {uploads.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-xs" style={{ color: '#6b7280' }}>Aucun PDF uploade pour ce plan</p>
                </div>
              ) : (
                <div>
                  {uploads.map((item) => (
                    <div key={item.id} className="px-5 py-3 flex items-center gap-3"
                      style={{ borderBottom: '1px solid #1e2535' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(239,68,68,0.1)' }}>
                        <svg className="w-4 h-4" style={{ color: '#f87171' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                        <p className="text-xs" style={{ color: '#6b7280' }}>
                          Uploade le {formatDate(item.fetched_at)}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-bold"
                        style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                        UPLOAD
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeletePdf(item.id, item.title)}
                        disabled={deletingPdfId === item.id}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold shrink-0 transition"
                        style={{
                          color: '#f87171',
                          border: '1px solid rgba(239,68,68,0.3)',
                          opacity: deletingPdfId === item.id ? 0.5 : 1,
                        }}>
                        {deletingPdfId === item.id ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
