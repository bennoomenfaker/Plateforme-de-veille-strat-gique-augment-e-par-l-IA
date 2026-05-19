import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import { processingService } from '../../services/api';

const LANG_FLAGS: Record<string, string> = {
  fr: '🇫🇷', en: '🇬🇧', ar: '🇹🇳',
  es: '🇪🇸', de: '🇩🇪', it: '🇮🇹',
  pt: '🇵🇹', ru: '🇷🇺',
};

const SOURCE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  RSS:    { bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', border: 'rgba(59,130,246,0.2)' },
  WEB:    { bg: 'rgba(16,185,129,0.1)', color: '#34d399', border: 'rgba(16,185,129,0.2)' },
  PDF:    { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', border: 'rgba(239,68,68,0.2)'  },
  UPLOAD: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
};

export default function ProjectProcessedItemsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [langFilter, setLangFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const limit = 20;

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['processing-stats', projectId],
    queryFn: () => processingService.getStats(projectId!).then(r => r.data),
    enabled: !!projectId,
  });

  // Liste processed items
  const { data, isLoading } = useQuery({
    queryKey: ['processed-items', projectId, page, langFilter, typeFilter],
    queryFn: () =>
      processingService
        .getByProject(projectId!, page, limit, langFilter || undefined, typeFilter || undefined)
        .then(r => r.data),
    enabled: !!projectId,
  });

  // Mutation : lancer le processing
  const processMutation = useMutation({
    mutationFn: () => processingService.processProject(projectId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['processed-items', projectId] });
      queryClient.invalidateQueries({ queryKey: ['processing-stats', projectId] });
      alert(`✅ Processing terminé !\n${res.data.processed} traités · ${res.data.skipped} ignorés · ${res.data.failed} erreurs`);
    },
    onError: (err: any) => {
      alert(`❌ Erreur: ${err?.response?.data?.message || err.message}`);
    },
  });

  const items = data?.data || [];

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const cardStyle: React.CSSProperties = {
    background: '#161b27',
    border: '1px solid #1e2535',
    borderRadius: '1rem',
    padding: '1.25rem',
  };

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-xs" style={{ color: '#6b7280' }}>
          <Link to="/projects" className="hover:text-white transition">Projets</Link>
          <span>/</span>
          <Link to={`/projects/${projectId}`} className="hover:text-white transition">Projet</Link>
          <span>/</span>
          <span style={{ color: '#e5e7eb' }}>Données nettoyées</span>
        </div>

        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Données nettoyées</h1>
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
              Résultat du processing — Sprint 4
            </p>
          </div>
          <button
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
            className="text-sm font-semibold px-5 py-2.5 rounded-xl transition"
            style={{
              background: processMutation.isPending
                ? '#1e2535'
                : 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: processMutation.isPending ? '#6b7280' : 'white',
              cursor: processMutation.isPending ? 'not-allowed' : 'pointer',
            }}>
            {processMutation.isPending ? '⏳ Processing...' : '▶ Lancer le processing'}
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Raw items', value: stats.total_raw, color: '#60a5fa' },
              { label: 'Traités', value: stats.total_processed, color: '#34d399' },
              { label: 'En attente', value: stats.pending, color: '#fbbf24' },
              { label: 'Complétion', value: `${stats.completion_rate}%`, color: '#a78bfa' },
            ].map((s) => (
              <div key={s.label} style={cardStyle}>
                <p className="text-xs mb-1" style={{ color: '#6b7280' }}>{s.label}</p>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Langues détectées */}
        {stats?.by_language && stats.by_language.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4b5568' }}>
              Langues détectées
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setLangFilter(''); setPage(1); }}
                className="text-xs px-3 py-1 rounded-lg transition"
                style={langFilter === ''
                  ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                  : { background: '#0f1117', color: '#6b7280', border: '1px solid #1e2535' }}>
                Toutes
              </button>
              {stats.by_language.map((l: any) => (
                <button
                  key={l.language}
                  onClick={() => { setLangFilter(l.language); setPage(1); }}
                  className="text-xs px-3 py-1 rounded-lg transition"
                  style={langFilter === l.language
                    ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                    : { background: '#0f1117', color: '#9ca3af', border: '1px solid #1e2535' }}>
                  {LANG_FLAGS[l.language] || '🌐'} {l.language?.toUpperCase()} ({l.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtres type source */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['', 'RSS', 'WEB', 'PDF', 'UPLOAD'].map((type) => (
            <button
              key={type || 'ALL'}
              onClick={() => { setTypeFilter(type); setPage(1); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl transition"
              style={typeFilter === type
                ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                : { background: '#161b27', color: '#6b7280', border: '1px solid #1e2535' }}>
              {type === '' ? 'Tous' : type}
            </button>
          ))}
        </div>

        {/* Liste items */}
        <div style={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: '1rem' }}
          className="overflow-hidden">

          {isLoading ? (
            <div className="py-16 text-center text-sm" style={{ color: '#6b7280' }}>Chargement...</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3">🧹</p>
              <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>
                Aucun item traité
              </p>
              <p className="text-xs mt-1" style={{ color: '#4b5568' }}>
                Lancez le processing pour nettoyer vos données brutes
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="grid px-5 py-3 text-[10px] font-bold uppercase tracking-widest"
                style={{
                  gridTemplateColumns: '80px 1fr 60px 80px 100px',
                  color: '#4b5568',
                  borderBottom: '1px solid #1e2535',
                  background: '#0f1117',
                }}>
                <span>Type</span>
                <span>Titre / Extrait</span>
                <span>Langue</span>
                <span>Mots</span>
                <span>Traité le</span>
              </div>

              {items.map((item: any) => {
                const style = SOURCE_COLORS[item.source_type?.toUpperCase()] || SOURCE_COLORS.WEB;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="grid px-5 py-4 items-start hover:bg-white/5 transition cursor-pointer"
                    style={{
                      gridTemplateColumns: '80px 1fr 60px 80px 100px',
                      borderBottom: '1px solid #1e2535',
                    }}>
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                        style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                        {item.source_type || '?'}
                      </span>
                    </div>
                    <div className="min-w-0 pr-4">
                      <p className="text-sm font-semibold text-white leading-snug mb-1 line-clamp-1">
                        {item.title || 'Sans titre'}
                      </p>
                      <p className="text-xs line-clamp-2" style={{ color: '#6b7280' }}>
                        {item.content_excerpt || 'Aucun extrait'}
                      </p>
                    </div>
                    <div className="text-lg text-center">
                      {LANG_FLAGS[item.language] || '🌐'}
                    </div>
                    <div className="text-xs" style={{ color: '#9ca3af' }}>
                      {item.word_count?.toLocaleString() || 0} mots
                    </div>
                    <div className="text-xs" style={{ color: '#6b7280' }}>
                      {formatDate(item.processed_at)}
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {data && data.totalPages > 1 && (
                <div className="px-5 py-4 flex items-center justify-between"
                  style={{ borderTop: '1px solid #1e2535' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: '#0f1117', color: page === 1 ? '#4b5568' : '#60a5fa', border: '1px solid #1e2535' }}>
                    Précédent
                  </button>
                  <span className="text-xs" style={{ color: '#6b7280' }}>
                    Page {data.page} / {data.totalPages} · {data.total} items
                  </span>
                  <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: '#0f1117', color: page === data.totalPages ? '#4b5568' : '#60a5fa', border: '1px solid #1e2535' }}>
                    Suivant
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal détail item */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setSelectedItem(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#161b27',
              border: '1px solid #1e2535',
              borderRadius: '1.25rem',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '2rem',
            }}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold text-white pr-4 leading-tight">
                {selectedItem.title || 'Sans titre'}
              </h2>
              <button onClick={() => setSelectedItem(null)}
                style={{ color: '#6b7280', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {selectedItem.source_type && (
                <span className="text-xs px-2 py-0.5 rounded-md font-bold"
                  style={SOURCE_COLORS[selectedItem.source_type] || { background: '#1e2535', color: '#9ca3af', border: '1px solid #2d3748' }}>
                  {selectedItem.source_type}
                </span>
              )}
              {selectedItem.language && (
                <span className="text-xs px-2 py-0.5 rounded-md"
                  style={{ background: '#1e2535', color: '#9ca3af', border: '1px solid #2d3748' }}>
                  {LANG_FLAGS[selectedItem.language] || '🌐'} {selectedItem.language?.toUpperCase()}
                </span>
              )}
              {selectedItem.word_count > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-md"
                  style={{ background: '#1e2535', color: '#9ca3af', border: '1px solid #2d3748' }}>
                  {selectedItem.word_count.toLocaleString()} mots
                </span>
              )}
            </div>

            {selectedItem.article_url && (
              <a href={selectedItem.article_url} target="_blank" rel="noopener noreferrer"
                className="text-xs block mb-4 hover:underline"
                style={{ color: '#60a5fa' }}>
                🔗 {selectedItem.article_url}
              </a>
            )}

            <div style={{ background: '#0f1117', borderRadius: '0.75rem', padding: '1rem', maxHeight: '40vh', overflow: 'auto' }}>
              <p className="text-sm leading-relaxed" style={{ color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
                {selectedItem.content_clean || selectedItem.content_excerpt || 'Aucun contenu'}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs" style={{ color: '#6b7280' }}>
              <div>Source : {selectedItem.source_name || '—'}</div>
              <div>Traité : {formatDate(selectedItem.processed_at)}</div>
              <div>Publié : {formatDate(selectedItem.published_at)}</div>
              <div>Chars : {selectedItem.char_count?.toLocaleString() || 0}</div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
