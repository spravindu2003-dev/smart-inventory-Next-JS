'use client';

import { useTabSession } from '@/components/tab-session-provider';

export function useAuth() {
  const { user, isLoading, isAuthenticated } = useTabSession();
  return {
    user,
    isLoading,
    isAuthenticated,
  };
}
