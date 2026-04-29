import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export interface UserProfile {
  display_name: string;
  email: string;
  auth_enabled: boolean;
  avatar_url: string | null;
}

export interface NotificationEvents {
  new_ticket?: boolean;
  urgent_ticket?: boolean;
  agent_failure?: boolean;
  budget_warning?: boolean;
  server_offline?: boolean;
  daily_briefing?: boolean;
}

export interface UserPreferences {
  timezone: string;
  default_ai_model: string | null;
  ai_monthly_budget_cents: number;
  focus_mode_active: boolean;
  briefing_schedule: string;
  evening_debrief_enabled: boolean;
  notification_email_enabled: boolean;
  notification_critical_only: boolean;
  notification_events: NotificationEvents | null;
  auto_memory_extraction: boolean;
  auto_pause_budget: boolean;
  theme: string;
}

export interface UserSettings {
  profile: UserProfile;
  preferences: UserPreferences;
}

export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<UserSettings> => {
      return await apiClient.get<UserSettings>('/api/v1/settings');
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { profile?: Partial<UserProfile>; preferences?: Partial<UserPreferences> }) => {
      return await apiClient.patch<UserSettings>('/api/v1/settings', updates);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      toast.success('Settings updated');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { current_password: string; new_password: string }) => {
      return await apiClient.patch('/api/v1/settings/password', data);
    },
    onSuccess: () => {
      toast.success('Password updated');
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    updateSettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    changePassword: changePasswordMutation.mutate,
    isChangingPassword: changePasswordMutation.isPending,
  };
}
