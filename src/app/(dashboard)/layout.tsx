'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTabSession } from '@/components/tab-session-provider';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { useMediaQuery } from '@/hooks/use-media-query';

const SIDEBAR_STATE_KEY = 'sidebar-collapsed';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useTabSession();
  const isDesktop = useMediaQuery('(min-width: 769px)');
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SIDEBAR_STATE_KEY);
      return stored === 'true';
    }
    return false;
  });

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STATE_KEY, String(next));
      return next;
    });
  }, []);

  const openMobile = React.useCallback(() => setMobileOpen(true), []);
  const closeMobile = React.useCallback(() => setMobileOpen(false), []);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563EB]"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        userRole={user.role}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
        isDesktop={isDesktop}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar onCmdOpen={() => setCmdOpen(true)} onMobileMenuOpen={openMobile} />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

        {!isDesktop && <BottomNav userRole={user.role} />}
      </div>
    </div>
  );
}
