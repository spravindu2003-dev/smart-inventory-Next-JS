'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search, Bell, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthToken } from '@/hooks/use-auth-token';
import { getPendingRequestCount } from '@/actions/requests';
import { usePusherChannel } from '@/hooks/use-pusher-channel';

interface TopbarProps {
  onCmdOpen?: () => void;
  onMobileMenuOpen?: () => void;
}

export function Topbar({ onCmdOpen, onMobileMenuOpen }: TopbarProps) {
  const { user } = useAuth();
  const token = useAuthToken();
  const [pendingCount, setPendingCount] = React.useState(0);
  const canManage = user?.role === 'owner' || user?.role === 'manager';
  const channelName = user?.businessId ? `business-${user.businessId}` : '';

  React.useEffect(() => {
    if (!token || !canManage) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await getPendingRequestCount(token!);
        if (!cancelled) setPendingCount(data.count);
      } catch { /* ignore */ }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token, canManage]);

  const handleRequestEvent = React.useCallback(() => {
    if (!token || !canManage) return;
    getPendingRequestCount(token).then((data) => setPendingCount(data.count)).catch(() => {});
  }, [token, canManage]);
  usePusherChannel(channelName, 'request-created', handleRequestEvent);
  usePusherChannel(channelName, 'request-approved', handleRequestEvent);
  usePusherChannel(channelName, 'request-rejected', handleRequestEvent);

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuOpen}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-10 w-64 rounded-lg border border-gray-300 bg-gray-50 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onClick={onCmdOpen}
            readOnly
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400">
            <kbd className="px-1.5 py-0.5 rounded border border-gray-300 bg-white">&#8984;</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-gray-300 bg-white">K</kbd>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/requests"
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell className="h-5 w-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white bg-red-500">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm font-medium text-blue-600">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
