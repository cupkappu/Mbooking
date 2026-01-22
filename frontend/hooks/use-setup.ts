import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export interface InitializeSystemDto {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}

export interface InitializeSystemResponseDto {
  success: boolean;
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface InitializationStatusDto {
  initialized: boolean;
  userCount: number;
  currencyCount?: number;
}

// API functions using apiClient
const checkStatusApi = async (): Promise<InitializationStatusDto> => {
  return apiClient.get<InitializationStatusDto>('/setup/status');
};

const initializeApi = async (
  data: InitializeSystemDto,
  initSecret: string
): Promise<InitializeSystemResponseDto> => {
  return apiClient.request<InitializeSystemResponseDto>('/setup/initialize', {
    method: 'POST',
    headers: {
      'X-Init-Secret': initSecret,
    },
    body: JSON.stringify(data),
  });
};

export function useSetup() {
  const router = useRouter();

  // Query for checking initialization status
  const {
    data: status,
    isLoading: isStatusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['setup-status'],
    queryFn: checkStatusApi,
    retry: false,
    staleTime: 0, // Always fresh on mount
  });

  // Mutation for system initialization
  const initializeMutation = useMutation({
    mutationFn: ({ data, initSecret }: { data: InitializeSystemDto; initSecret: string }) =>
      initializeApi(data, initSecret),
    onSuccess: (data) => {
      // Redirect to dashboard on successful initialization
      router.push('/dashboard');
    },
  });

  const redirectToDashboard = () => {
    router.push('/dashboard');
  };

  const redirectToLogin = () => {
    router.push('/login');
  };

  return {
    // Status data
    status,
    isLoading: isStatusLoading,
    error: statusError,
    refetchStatus,

    // Initialization state
    isInitializing: initializeMutation.isPending,
    initializeError: initializeMutation.error?.message,
    initialize: initializeMutation.mutateAsync,

    // Actions
    redirectToDashboard,
    redirectToLogin,
  };
}
