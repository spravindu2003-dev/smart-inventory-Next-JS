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
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/dashboard/products', icon: Package },
  { name: 'Sales', href: '/dashboard/sales', icon: ShoppingCart },
  { name: 'Insights', href: '/dashboard/insights', icon: BarChart3, roles: ['owner', 'manager'] },
  { name: 'Reports', href: '/dashboard/reports', icon: BarChart3, roles: ['owner', 'manager'] },
  { name: 'Activity', href: '/dashboard/activities', icon: Activity, roles: ['owner', 'manager'] },
  { name: 'Users', href: '/dashboard/users', icon: Users, roles: ['owner'] },
  { name: 'Requests', href: '/dashboard/requests', icon: ClipboardList, roles: ['owner', 'manager'] },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

interface BottomNavProps {
  userRole?: string;
}

export function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();

  const filteredNavigation = navigation.filter(
    (item) => !item.roles || item.roles.includes(userRole || '')
  );

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <nav className="flex justify-around items-center h-16">
        {filteredNavigation.slice(0, 5).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'text-indigo-600'
                  : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <item.icon
                className={cn(
                  'h-5 w-5',
                  isActive ? 'text-indigo-600' : 'text-gray-400'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}