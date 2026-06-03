import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useOrgRole } from '../../hooks/useOrgRole';

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canWrite, role } = useOrgRole();

  const canCreateOrModify = (user?.type_utilisateur === 'INDIVIDUEL' && !role) || canWrite;

  const [tab, setTab] = useState<'active' | 'closed'>('active');

  const { data: activeData, isLoading: loadingActive } = useQuery({
    queryKey: ['projects', 'active'],
    queryFn: () => api.get('/projects').then(r => r.data),
    enabled: tab === 'active',
  });

  const { data: closedData, isLoading: loadingClosed } = useQuery({
    queryKey: ['projects', 'closed'],
    queryFn: () => api.get('/projects/archived').then(r => r.data),
    enabled: tab === 'closed',
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/projects/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'closed'] });
    },
  });

  const data = tab === 'active' ? activeData : closedData;
  const isLoading = tab === 'active' ? loadingActive : loadingClosed;
  const allProjects = tab === 'active'
    ? [...(data?.individual || []), ...(data?.organisation || [])]
    : (Array.isArray(data) ? data : []);

  return (
    <Layout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:'#3b82f6'}}>Gestion</p>
            <h1 className="text-2xl font-bold text-white">Projets de veille</h1>
            <p className="text-sm mt-1" style={{color:'#6b7280'}}>{allProjects.length} projet(s)</p>
          </div>
          {canCreateOrModify && tab === 'active' && (
            <button
              onClick={() => navigate('/projects/new')}
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition"
              style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white'}}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nouveau projet
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('active')}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={tab === 'active'
              ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white' }
              : { background: '#161b27', color: '#6b7280', border: '1px solid #1e2535' }
            }>
            Actifs
          </button>
          <button onClick={() => setTab('closed')}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={tab === 'closed'
              ? { background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white' }
              : { background: '#161b27', color: '#6b7280', border: '1px solid #1e2535' }
            }>
            Clôturés / Archivés
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-sm" style={{color:'#6b7280'}}>Chargement...</div>
        ) : allProjects.length === 0 ? (
          <div className="rounded-2xl py-20 text-center" style={{background:'#161b27', border:'1px solid #1e2535'}}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{background:'rgba(59,130,246,0.1)'}}>
              <svg className="w-6 h-6" style={{color:'#3b82f6'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p className="font-semibold mb-1 text-white">
              {tab === 'active' ? "Aucun projet actif" : "Aucun projet clôturé ou archivé"}
            </p>
            <p className="text-sm mb-6" style={{color:'#6b7280'}}>
              {tab === 'active'
                ? (canCreateOrModify ? 'Créez votre premier projet de veille' : 'Aucun projet disponible pour le moment')
                : 'Les projets clôturés et archivés apparaîtront ici'}
            </p>
            {tab === 'active' && canCreateOrModify && (
              <button onClick={() => navigate('/projects/new')}
                className="inline-flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl"
                style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white'}}>
                Créer mon premier projet
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allProjects.map(project => (
              <div key={project.id} className="rounded-2xl overflow-hidden transition group hover:scale-[1.01]"
                style={{background:'#161b27', border:'1px solid #1e2535'}}>
                <div className="h-1" style={{background: project.isActive ? 'linear-gradient(90deg,#3b82f6,#6366f1)' : project.end_date ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#6b7280,#4b5563)'}}></div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{background:'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(99,102,241,0.2))'}}>
                      <svg className="w-5 h-5" style={{color:'#60a5fa'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={project.isActive
                        ? {background:'rgba(16,185,129,0.1)', color:'#34d399', border:'1px solid rgba(16,185,129,0.2)'}
                        : project.end_date
                          ? {background:'rgba(251,191,36,0.1)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.2)'}
                          : {background:'rgba(107,114,128,0.1)', color:'#9ca3af', border:'1px solid rgba(107,114,128,0.2)'}
                      }>
                      {project.isActive ? 'Actif' : project.end_date ? 'Clôturé' : 'Archivé'}
                    </span>
                  </div>
                  <h3 className="font-bold text-white mb-1 group-hover:text-blue-400 transition text-sm">{project.nom}</h3>
                  <p className="text-xs mb-3 line-clamp-2" style={{color:'#6b7280', lineHeight:'1.6'}}>
                    {project.description || 'Aucune description'}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4 min-h-5">
                    {project.keywords?.slice(0, 3).map((kw: string) => (
                      <span key={kw} className="text-xs px-2 py-0.5 rounded-md font-medium"
                        style={{background:'rgba(59,130,246,0.1)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.15)'}}>
                        {kw}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-3" style={{borderTop:'1px solid #1e2535'}}>
                    <button onClick={() => navigate(`/projects/${project.id}`)}
                      className="flex-1 text-center py-2 rounded-xl text-sm font-bold transition"
                      style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white'}}>
                      Ouvrir
                    </button>
                    {canCreateOrModify && project.isActive && (
                      <button onClick={() => archiveMutation.mutate(project.id)}
                        className="px-3 py-2 rounded-xl transition"
                        style={{border:'1px solid #1e2535', color:'#6b7280'}}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
