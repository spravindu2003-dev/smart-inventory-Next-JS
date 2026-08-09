'use client';

import { useTabSession } from '@/components/tab-session-provider';

export function useAuthToken() {
  const { token } = useTabSession();
  return token ?? '';
}
