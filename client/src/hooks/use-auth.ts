import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  role: string;
  phone?: string | null;
  bio?: string | null;
  organization?: string | null;
  qrCodeHash?: string | null;
  isCheckedIn?: boolean;
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isFetched,
    refetch,
  } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes (good for mobile networks)
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Instantly update UI without full page reload
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    // data
    user,

    // loading & readiness
    isLoading,
    isAuthReady: isFetched, // 🔑 prevents mobile UI flicker

    // auth state
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === "admin",

    // actions
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetch,
  };
}
