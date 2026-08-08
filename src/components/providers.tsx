'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastContainer } from '@/lib/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <ToastContainer />
    </SessionProvider>
  );
}