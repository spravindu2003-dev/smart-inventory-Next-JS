'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Activity,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { signOut } from '@/lib/auth';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/dashboard/products', icon: Package },
  { name: 'Sales', href: '/dashboard/sales', icon: ShoppingCart },
  { name: 'Insights', href: '/dashboard/insights', icon: BarChart3, roles: ['owner', 'manager'] },
  { name: 'Reports', href: '/dashboard/reports', icon: BarChart3, roles: ['owner', 'manager'] },
  { name: 'Activity Log', href: '/dashboard/activities', icon: Activity, roles: ['owner', 'manager'] },
  { name: 'Users', href: '/dashboard/users', icon: Users, roles: ['owner'] },
  { name: 'Requests', href: '/dashboard/requests', icon: ClipboardList, roles: ['owner', 'manager'] },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

interface SidebarProps {
  userRole?: string;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  isDesktop: boolean;
}

export function Sidebar({ userRole, collapsed, onToggle, mobileOpen, onMobileClose, isDesktop }: SidebarProps) {
  const pathname = usePathname();
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  const filteredNavigation = navigation.filter(
    (item) => !item.roles || item.roles.includes(userRole || '')
  );

  // Close mobile drawer on route change
  React.useEffect(() => {
    if (!isDesktop && mobileOpen) {
      onMobileClose();
    }
  }, [pathname, isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key closes mobile drawer
  React.useEffect(() => {
    if (isDesktop || !mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isDesktop, mobileOpen, onMobileClose]);

  // Lock body scroll when mobile drawer is open
  React.useEffect(() => {
    if (isDesktop || !mobileOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isDesktop, mobileOpen]);

  // ── Mobile drawer ──
  if (!isDesktop) {
    if (!mobileOpen) return null;
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
        {/* Drawer */}
        <div
          ref={sidebarRef}
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col',
            'bg-[#E8F3FF] border-r border-[#D0E7FF] shadow-xl',
            'transition-transform duration-300 ease-in-out lg:hidden',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Mobile header */}
          <div className="flex items-center h-16 px-5 border-b border-[#D0E7FF]">
            <Link href="/dashboard" className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-[#2563EB] flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 truncate">Smart Inventory</span>
            </Link>
            <button
              onClick={onMobileClose}
              aria-label="Close sidebar"
              className="shrink-0 p-2 -mr-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-[#D0E7FF] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[#D0E7FF] text-[#2563EB]'
                      : 'text-gray-600 hover:bg-[#D0E7FF] hover:text-gray-900'
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      isActive ? 'text-[#2563EB]' : 'text-gray-400'
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sign out */}
          <div className="p-3 border-t border-[#D0E7FF]">
            <button
              onClick={() => signOut()}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-[#D0E7FF] hover:text-gray-900 transition-colors"
            >
              <LogOut className="h-5 w-5 shrink-0 text-gray-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Desktop persistent sidebar ──
  return (
    <div
      className={cn(
        'hidden lg:flex lg:flex-col lg:border-r lg:border-[#D0E7FF] lg:bg-[#E8F3FF]',
        'transition-[width] duration-300 ease-in-out shrink-0',
        collapsed ? 'w-[68px]' : 'w-[272px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center h-16 shrink-0 border-b border-[#D0E7FF]">
        {/* Hamburger button */}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className={cn(
            'flex items-center justify-center shrink-0 w-[68px] h-16',
            'text-gray-500 hover:text-gray-700 hover:bg-[#D0E7FF] transition-colors'
          )}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo + title */}
        <div
          className={cn(
            'flex items-center gap-2.5 overflow-hidden',
            'transition-[opacity,width] duration-300 ease-in-out',
            collapsed ? 'w-0 opacity-0 pointer-events-none' : 'flex-1 opacity-100'
          )}
        >
          <div className="h-8 w-8 shrink-0 rounded-lg bg-[#2563EB] flex items-center justify-center">
            <Package className="h-5 w-5 text-white" />
          </div>
          <span className="text-[17px] font-bold text-gray-900 whitespace-nowrap truncate">
            Smart Inventory
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                isActive
                  ? 'bg-[#D0E7FF] text-[#2563EB]'
                  : 'text-gray-600 hover:bg-[#D0E7FF] hover:text-gray-900'
              )}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  isActive ? 'text-[#2563EB]' : 'text-gray-400'
                )}
              />
              {!collapsed && (
                <span className="truncate">{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-[#D0E7FF] shrink-0">
        <button
          onClick={() => signOut()}
          title={collapsed ? 'Sign Out' : undefined}
          className={cn(
            'flex items-center gap-3 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-[#D0E7FF] hover:text-gray-900 transition-colors',
            collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
          )}
        >
          <LogOut className="h-5 w-5 shrink-0 text-gray-400" />
          {!collapsed && <span className="truncate">Sign Out</span>}
        </button>
      </div>
    </div>
  );
}
