import { useAuth } from '../context/AuthContext';

export function useOrgRole() {
  const { user, isOrganisation } = useAuth();
  const membership = user?.memberships?.[0];
  const role = membership?.role;

  const isOwner = role === 'PROPRIETAIRE';
  const isReader = role === 'LECTEUR';
  const canWrite =
    !isOrganisation ||
    role === 'PROPRIETAIRE' ||
    role === 'MANAGER' ||
    role === 'EQUIPE_VEILLE';

  return { role, isOwner, isReader, canWrite, membership };
}
