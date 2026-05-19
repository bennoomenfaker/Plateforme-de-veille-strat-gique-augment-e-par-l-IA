import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import { rawItemsService } from '../../services/api';
import type { RawItem } from '../../types';

const SOURCE_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  RSS:    { bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', border: 'rgba(59,130,246,0.2)' },
  WEB:    { bg: 'rgba(16,185,129,0.1)', color: '#34d399', border: 'rgba(16,185,129,0.2)' },
  PDF:    { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', border: 'rgba(239,68,68,0.2)'  },
  UPLOAD: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
};

export default function ProjectRawItemsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const limit = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['raw-items-project', projectId, page],
    queryFn: () => rawItemsService.getByProject(projectId!, page, limit).then(r => r.data),
    enabled: !!projectId,
  });

  const items: RawItem[] = data?.data || [];
  const filtered = items.filter(item => {
    const matchType = filter === 'ALL' || item.source_type?.toUpperCase() === filter;
    const matchSearch = !search ||
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.source_name?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const inputStyle: React.CSSProperties = {
    background: '#0f1117',
    border: '1px solid #1e2535',
    color: 'white',
    borderRadius: '0.75rem',
    padding: '0.5rem 1rem',
    fontSize: '0.8125rem',
    outline: 'none',
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
          <span style={{ color: '#e5e7eb' }}>Donnees brutes</span>
        </div>

        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Donnees brutes collectees</h1>
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
              {data?.total || 0} item(s) au total
            </p>
          </div>
          <button onClick={() => refetch()}
            className="text-sm font-semibold px-4 py-2 rounded-xl transition"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
            Actualiser
          </button>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            style={{ ...inputStyle, minWidth: '220px' }}
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-2">
            {['ALL', 'RSS', 'WEB', 'PDF', 'UPLOAD'].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl transition"
                style={filter === type
                  ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
                  : { background: '#161b27', color: '#6b7280', border: '1px solid #1e2535' }
                }>
                {type === 'ALL' ? 'Tous' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: '1rem' }}
          className="overflow-hidden">

          {isLoading ? (
            <div className="py-16 text-center text-sm" style={{ color: '#6b7280' }}>
              Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>
                {search || filter !== 'ALL' ? 'Aucun resultat pour ce filtre' : 'Aucune donnee collectee'}
              </p>
              <p className="text-xs mt-1" style={{ color: '#4b5568' }}>
                {!search && filter === 'ALL' && 'Lancez une collecte depuis un plan pour voir les donnees ici'}
              </p>
            </div>
          ) : (
            <>
              {/* Header tableau */}
              <div className="grid px-5 py-3 text-[10px] font-bold uppercase tracking-widest"
                style={{
                  gridTemplateColumns: '80px 1fr 140px 140px 100px',
                  color: '#4b5568',
                  borderBottom: '1px solid #1e2535',
                  background: '#0f1117'
                }}>
                <span>Type</span>
                <span>Titre / URL</span>
                <span>Source</span>
                <span>Collecte le</span>
                <span>Publie le</span>
              </div>

              {filtered.map((item) => {
                const style = SOURCE_TYPE_COLORS[item.source_type?.toUpperCase()] || SOURCE_TYPE_COLORS.RSS;
                return (
                  <div key={item.id}
                    className="grid px-5 py-4 items-start hover:bg-white/5 transition"
                    style={{
                      gridTemplateColumns: '80px 1fr 140px 140px 100px',
                      borderBottom: '1px solid #1e2535'
                    }}>
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                        style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                        {item.source_type}
                      </span>
                    </div>
                    <div className="min-w-0 pr-4">
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
                    </div>
                    <div className="text-xs" style={{ color: '#6b7280' }}>
                      {item.source_name || '—'}
                    </div>
                    <div className="text-xs" style={{ color: '#6b7280' }}>
                      {formatDate(item.fetched_at)}
                    </div>
                    <div className="text-xs" style={{ color: '#6b7280' }}>
                      {formatDate(item.published_at)}
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {data && data.totalPages > 1 && (
                <div className="px-5 py-4 flex items-center justify-between"
                  style={{ borderTop: '1px solid #1e2535' }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-xs px-3 py-1.5 rounded-lg transition"
                    style={{
                      background: page === 1 ? '#1e2535' : 'rgba(59,130,246,0.1)',
                      color: page === 1 ? '#4b5568' : '#60a5fa',
                      border: '1px solid #1e2535',
                    }}>
                    Precedent
                  </button>
                  <span className="text-xs" style={{ color: '#6b7280' }}>
                    Page {data.page} / {data.totalPages} · {data.total} items
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="text-xs px-3 py-1.5 rounded-lg transition"
                    style={{
                      background: page === data.totalPages ? '#1e2535' : 'rgba(59,130,246,0.1)',
                      color: page === data.totalPages ? '#4b5568' : '#60a5fa',
                      border: '1px solid #1e2535',
                    }}>
                    Suivant
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
