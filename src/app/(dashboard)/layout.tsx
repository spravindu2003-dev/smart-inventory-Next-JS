'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { useMediaQuery } from '@/hooks/use-media-query';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isDesktop = useMediaQuery('(min-width: 769px)');
  const [cmdOpen, setCmdOpen] = React.useState(false);

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((p) => !p);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {isDesktop && <Sidebar userRole={session.user.role} />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onCmdOpen={() => setCmdOpen(true)} />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

        {!isDesktop && <BottomNav userRole={session.user.role} />}
      </div>
    </div>
  );
}