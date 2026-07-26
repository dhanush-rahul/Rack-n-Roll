import { useQuery } from '@tanstack/react-query';
import { fetchPublicProfile } from '../../services/userService';
import { queryKeys } from './queryKeys';

export function usePublicProfile(username, { enabled = true } = {}) {
  const normalized = String(username || '').trim().toLowerCase();

  return useQuery({
    queryKey: queryKeys.publicProfile(normalized),
    queryFn: () => fetchPublicProfile(normalized),
    enabled: enabled && Boolean(normalized),
  });
}
