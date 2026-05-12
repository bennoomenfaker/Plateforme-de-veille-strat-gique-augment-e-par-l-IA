import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: () => api.get('/alertes/unread').then(r => r.data),
  });

  const allProjects = [
    ...(projectsData?.individual || []),
    ...(projectsData?.organisation || []),
  ];

  const cards = [
    {
      label: 'Projets actifs',
      value: allProjects.filter(p => p.isActive).length,
      gradient: 'linear-gradient(135deg,#1d4ed8,#4f46e5)',
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    },
    {
      label: 'Alertes non lues',
      value: alertsData?.unread || 0,
      gradient: 'linear-gradient(135deg,#be123c,#e11d48)',
      icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    },
    {
      label: 'Compte',
      value: user?.type_utilisateur === 'INDIVIDUEL' ? 'Individuel' : 'Organisation',
      gradient: 'linear-gradient(135deg,#065f46,#047857)',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
  ];

  return (
    <Layout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:'#3b82f6'}}>Tableau de bord</p>
          <h1 className="text-2xl font-bold text-white">Bonjour, {user?.nom}</h1>
          <p className="text-sm mt-1" style={{color:'#6b7280'}}>Voici l'état de votre activité de veille</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {cards.map((card, i) => (
            <div key={i} className="rounded-2xl p-5 relative overflow-hidden" style={{background: card.gradient}}>
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10" style={{background:'white', transform:'translate(30%,-30%)'}}></div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{background:'rgba(255,255,255,0.15)'}}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                </svg>
              </div>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{color:'rgba(255,255,255,0.7)'}}>{card.label}</p>
              <p className="text-3xl font-bold text-white">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Projets récents */}
        <div className="rounded-2xl overflow-hidden" style={{background:'#161b27', border:'1px solid #1e2535'}}>
          <div className="px-6 py-4 flex items-center justify-between" style={{borderBottom:'1px solid #1e2535'}}>
            <div>
              <h2 className="font-semibold text-white text-sm">Projets récents</h2>
              <p className="text-xs mt-0.5" style={{color:'#6b7280'}}>{allProjects.length} projet(s) au total</p>
            </div>
            <Link to="/projects" className="text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              style={{background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.2)'}}>
              Voir tout →
            </Link>
          </div>

          {allProjects.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{background:'#1e2535'}}>
                <svg className="w-6 h-6" style={{color:'#4b5568'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium mb-1" style={{color:'#9ca3af'}}>Aucun projet pour l'instant</p>
              <p className="text-xs mb-5" style={{color:'#4b5568'}}>Créez votre premier projet de veille</p>
              <Link to="/projects" className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition"
                style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white'}}>
                Créer un projet
              </Link>
            </div>
          ) : (
            <div>
              {allProjects.slice(0, 5).map((project, i) => (
                <Link key={project.id} to={`/projects/${project.id}`}
                  className="flex items-center justify-between px-6 py-4 transition group"
                  style={{borderBottom: i < allProjects.slice(0,5).length-1 ? '1px solid #1e2535' : 'none'}}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{background:'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(99,102,241,0.2))'}}>
                      <svg className="w-4 h-4" style={{color:'#60a5fa'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition">{project.nom}</p>
                      <p className="text-xs mt-0.5" style={{color:'#6b7280'}}>{project.sources?.length || 0} source(s) · {project.frequency}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={project.isActive
                      ? {background:'rgba(16,185,129,0.1)', color:'#34d399', border:'1px solid rgba(16,185,129,0.2)'}
                      : {background:'rgba(107,114,128,0.1)', color:'#9ca3af', border:'1px solid rgba(107,114,128,0.2)'}
                    }>
                    {project.isActive ? 'Actif' : 'Archivé'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
