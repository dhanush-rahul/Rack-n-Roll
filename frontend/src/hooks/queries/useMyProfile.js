import { useQuery } from '@tanstack/react-query';
import { fetchMyProfile } from '../../services/userService';
import { PROFILE_STALE_TIME_MS } from '../../config/queryClient';
import { queryKeys } from './queryKeys';

export function useMyProfile({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.profile(),
    queryFn: fetchMyProfile,
    staleTime: PROFILE_STALE_TIME_MS,
    enabled,
  });
}
