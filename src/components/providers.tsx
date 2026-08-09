'use client';

import { TabSessionProvider } from '@/components/tab-session-provider';
import { ToastContainer } from '@/lib/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TabSessionProvider>
      {children}
      <ToastContainer />
    </TabSessionProvider>
  );
}
