import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/layout/Layout';
import api from '../../services/api';

export default function OrganisationPage() {
  const queryClient = useQueryClient();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'EQUIPE_VEILLE' });
  const [activeTab, setActiveTab] = useState<'members'|'invitations'>('members');

  const { data: org, isLoading } = useQuery({
    queryKey: ['organisation'],
    queryFn: () => api.get('/organisations/me').then(r => r.data),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: any) => api.post(`/organisations/${org?.id}/invite`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisation'] });
      setShowInviteForm(false);
      setInviteForm({ email: '', role: 'EQUIPE_VEILLE' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/organisations/${org?.id}/members/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organisation'] }),
  });

  const { data: invitations } = useQuery({
    queryKey: ['invitations', org?.id],
    queryFn: () => api.get(`/organisations/${org?.id}/invitations`).then(r => r.data),
    enabled: !!org?.id,
  });

  const inputStyle = {
    background:'#0f1117', border:'1px solid #1e2535', color:'white',
    borderRadius:'0.75rem', padding:'0.625rem 1rem', fontSize:'0.875rem',
    width:'100%', outline:'none'
  };

  const roleLabel = (role: string) => {
    if (role === 'PROPRIETAIRE') return 'Propriétaire';
    if (role === 'EQUIPE_VEILLE') return 'Équipe de veille';
    return 'Lecteur';
  };

  const roleStyle = (role: string) => {
    if (role === 'PROPRIETAIRE') return {background:'rgba(245,158,11,0.1)', color:'#fbbf24', border:'1px solid rgba(245,158,11,0.2)'};
    if (role === 'EQUIPE_VEILLE') return {background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.2)'};
    return {background:'rgba(107,114,128,0.1)', color:'#9ca3af', border:'1px solid rgba(107,114,128,0.2)'};
  };

  const statusStyle = (status: string) => {
    if (status === 'ACCEPTED') return {background:'rgba(16,185,129,0.1)', color:'#34d399', border:'1px solid rgba(16,185,129,0.2)'};
    if (status === 'EXPIRED') return {background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)'};
    return {background:'rgba(245,158,11,0.1)', color:'#fbbf24', border:'1px solid rgba(245,158,11,0.2)'};
  };

  if (isLoading) return <Layout><div className="p-8 text-sm" style={{color:'#6b7280'}}>Chargement...</div></Layout>;

  if (!org) return (
    <Layout>
      <div className="p-8 max-w-2xl mx-auto text-center mt-20">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{background:'rgba(59,130,246,0.1)'}}>
          <svg className="w-7 h-7" style={{color:'#3b82f6'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Aucune organisation</h2>
        <p className="text-sm" style={{color:'#6b7280'}}>Vous n'appartenez à aucune organisation pour l'instant.</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:'#3b82f6'}}>Gestion</p>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{org.nom}</h1>
              <p className="text-sm mt-1" style={{color:'#6b7280'}}>
                {org.members?.length || 0} membre(s) · {org.projects?.length || 0} projet(s)
              </p>
            </div>
            <button onClick={() => setShowInviteForm(true)}
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl"
              style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white'}}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Inviter un membre
            </button>
          </div>
        </div>

        {/* Modal invitation */}
        {showInviteForm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)'}}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{background:'#161b27', border:'1px solid #1e2535'}}>
              <div className="px-6 py-5 flex items-center justify-between"
                style={{background:'linear-gradient(135deg,#1d4ed8,#4f46e5)'}}>
                <div>
                  <h2 className="text-base font-bold text-white">Inviter un collaborateur</h2>
                  <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,0.6)'}}>Un email d'invitation sera généré</p>
                </div>
                <button onClick={() => setShowInviteForm(false)} style={{color:'rgba(255,255,255,0.7)'}}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{color:'#9ca3af'}}>
                    Email du collaborateur
                  </label>
                  <input type="email" value={inviteForm.email}
                    onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                    style={inputStyle} placeholder="collaborateur@exemple.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{color:'#9ca3af'}}>
                    Rôle
                  </label>
                  <select value={inviteForm.role}
                    onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
                    style={inputStyle}>
                    <option value="EQUIPE_VEILLE">Équipe de veille</option>
                    <option value="LECTEUR">Lecteur</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowInviteForm(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                    style={{border:'1px solid #1e2535', color:'#9ca3af'}}>
                    Annuler
                  </button>
                  <button onClick={() => inviteMutation.mutate(inviteForm)}
                    disabled={inviteMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                    style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white',
                    opacity: inviteMutation.isPending ? 0.5 : 1}}>
                    {inviteMutation.isPending ? 'Envoi...' : 'Envoyer l\'invitation'}
                  </button>
                </div>
                {inviteMutation.isSuccess && (
                  <div className="p-3 rounded-xl text-xs font-medium" style={{background:'rgba(16,185,129,0.1)', color:'#34d399', border:'1px solid rgba(16,185,129,0.2)'}}>
                    Invitation envoyée — token disponible dans l'historique
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{background:'#161b27', border:'1px solid #1e2535'}}>
          {[['members','Membres'],['invitations','Invitations']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition"
              style={activeTab === tab
                ? {background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white'}
                : {color:'#6b7280'}
              }>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'members' && (
          <div className="rounded-2xl overflow-hidden" style={{background:'#161b27', border:'1px solid #1e2535'}}>
            <div className="px-6 py-4" style={{borderBottom:'1px solid #1e2535'}}>
              <h2 className="text-sm font-bold text-white">Membres de l'organisation</h2>
            </div>
            <div>
              {org.members?.map((m: any, i: number) => (
                <div key={m.id} className="flex items-center justify-between px-6 py-4"
                  style={{borderBottom: i < org.members.length-1 ? '1px solid #1e2535' : 'none'}}>
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)'}}>
                      {m.user?.nom?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{m.user?.nom}</p>
                      <p className="text-xs" style={{color:'#6b7280'}}>{m.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={roleStyle(m.role)}>
                      {roleLabel(m.role)}
                    </span>
                    {m.role !== 'PROPRIETAIRE' && (
                      <button onClick={() => revokeMutation.mutate(m.user_id)}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium transition"
                        style={{background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)'}}>
                        Révoquer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'invitations' && (
          <div className="rounded-2xl overflow-hidden" style={{background:'#161b27', border:'1px solid #1e2535'}}>
            <div className="px-6 py-4" style={{borderBottom:'1px solid #1e2535'}}>
              <h2 className="text-sm font-bold text-white">Historique des invitations</h2>
            </div>
            <div>
              {!invitations || invitations.length === 0 ? (
                <p className="p-8 text-sm text-center" style={{color:'#6b7280'}}>Aucune invitation envoyée</p>
              ) : (
                invitations.map((inv: any, i: number) => (
                  <div key={inv.id} className="flex items-center justify-between px-6 py-4"
                    style={{borderBottom: i < invitations.length-1 ? '1px solid #1e2535' : 'none'}}>
                    <div>
                      <p className="text-sm font-semibold text-white">{inv.email}</p>
                      <p className="text-xs mt-0.5" style={{color:'#6b7280'}}>
                        {roleLabel(inv.role)} · Expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={statusStyle(inv.status)}>
                      {inv.status === 'PENDING' ? 'En attente' : inv.status === 'ACCEPTED' ? 'Accepté' : 'Expiré'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
