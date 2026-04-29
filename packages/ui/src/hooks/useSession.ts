import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';

interface User {
  id: number;
  email: string;
  displayName: string;
}

interface SessionResponse {
  authenticated: boolean;
  user?: User;
}

export function useSession() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['session'],
    queryFn: async (): Promise<SessionResponse> => {
      try {
        return await apiClient.get<SessionResponse>('/api/v1/auth/session');
      } catch (error) {
        // If auth/session fails, treat as unauthenticated
        if (error instanceof ApiError) {
          return { authenticated: false };
        }
        throw error;
      }
    },
    // Don't show error toast for session check
    retry: false,
    staleTime: 60 * 1000, // 1 minute
  });

  const invalidateSession = () => {
    queryClient.invalidateQueries({ queryKey: ['session'] });
  };

  return {
    user: query.data?.user,
    isAuthenticated: query.data?.authenticated ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    invalidateSession,
  };
}
