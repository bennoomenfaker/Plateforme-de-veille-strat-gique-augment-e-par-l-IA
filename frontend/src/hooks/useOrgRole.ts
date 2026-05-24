import { useQuery } from '@tanstack/react-query';
import { orgService } from '../services/api';

export function useOrgRole() {
  const { data: org } = useQuery({
    queryKey: ['organisation'],
    queryFn: () => orgService.getMyOrg().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const role = org?.my_role ?? null;

  const canWrite = role === 'PROPRIETAIRE' || role === 'MANAGER' || role === 'EQUIPE_VEILLE';
  const canRead = !!role;

  return { role, canWrite, canRead };
}
