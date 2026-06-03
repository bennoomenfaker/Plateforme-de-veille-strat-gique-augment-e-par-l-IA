import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { alertsService } from '../../services/api';

export default function AlertesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-alerts'],
    queryFn: () => alertsService.getMyAlerts().then(r => r.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => alertsService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-unread'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => alertsService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-unread'] });
    },
  });

  const alerts = data?.data ?? [];
  const unread = alerts.filter((a: any) => !a.isRead).length;

  const alertType = (msg: string) => {
    if (msg.includes('Score élevé') || msg.includes('high_score')) return { color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', label: 'Score élevé' };
    if (msg.includes('contredit') || msg.includes('contradicted')) return { color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', label: 'Hypothèse contredite' };
    if (msg.includes('pertinent') || msg.includes('relevant')) return { color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)', label: 'Contenu pertinent' };
    return { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', label: 'Alerte' };
  };

  const cleanMsg = (msg: string) => msg.replace(/\s*\[.*?\]/g, '').trim();

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3b82f6' }}>Notifications</p>
            <h1 className="text-2xl font-bold text-white">Alertes</h1>
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
              {unread > 0 ? `${unread} alerte(s) non lue(s)` : 'Toutes les alertes sont lues'}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
              Tout marquer comme lu
            </button>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: '#161b27', border: '1px solid #1e2535' }}>
          {isLoading ? (
            <div className="py-16 text-center text-sm" style={{ color: '#6b7280' }}>Chargement...</div>
          ) : alerts.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(59,130,246,0.1)' }}>
                <svg className="w-6 h-6" style={{ color: '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="font-semibold text-white mb-1">Aucune alerte</p>
              <p className="text-sm" style={{ color: '#6b7280' }}>Les alertes apparaissent automatiquement lors de la collecte</p>
            </div>
          ) : (
            alerts.map((alert: any, i: number) => {
              const type = alertType(alert.message);
              return (
                <div key={alert.id}
                  className="flex items-start gap-4 px-6 py-4 transition"
                  style={{
                    borderBottom: i < alerts.length - 1 ? '1px solid #1e2535' : 'none',
                    background: alert.isRead ? 'transparent' : 'rgba(59,130,246,0.03)',
                  }}>
                  <div className="w-2 h-2 rounded-full mt-2 shrink-0"
                    style={{ background: alert.isRead ? '#374151' : type.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: type.bg, color: type.color, border: `1px solid ${type.border}` }}>
                        {type.label}
                      </span>
                      {alert.project?.nom && (
                        <Link to={`/projects/${alert.projectId}`}
                          className="text-[10px] font-medium hover:underline"
                          style={{ color: '#6b7280' }}>
                          {alert.project.nom}
                        </Link>
                      )}
                    </div>
                    <p className="text-sm text-white">{cleanMsg(alert.message)}</p>
                    <p className="text-xs mt-1" style={{ color: '#4b5568' }}>
                      {new Date(alert.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!alert.isRead && (
                    <button
                      onClick={() => markReadMutation.mutate(alert.id)}
                      className="text-xs px-3 py-1.5 rounded-lg shrink-0 transition"
                      style={{ background: '#1e2535', color: '#6b7280', border: '1px solid #2d3748' }}>
                      Lu
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
