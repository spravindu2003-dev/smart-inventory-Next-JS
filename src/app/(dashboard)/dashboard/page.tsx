'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardSummary } from '@/actions/insights';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Package, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const { user } = useAuth();
  const currency = user?.currency;
  const [summary, setSummary] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadSummary() {
      try {
        const data = await getDashboardSummary();
        if ('error' in data) {
          console.error(data.error);
        } else {
          setSummary(data);
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here&apos;s an overview of your inventory.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Products"
          value={summary?.totalProducts || 0}
          icon={<Package className="h-6 w-6" />}
        />
        <StatCard
          title="Total Stock"
          value={summary?.totalStock || 0}
          icon={<TrendingUp className="h-6 w-6" />}
        />
        <StatCard
          title="Total Sales"
          value={summary?.totalSales || 0}
          icon={<ShoppingCart className="h-6 w-6" />}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(summary?.totalRevenue || 0, currency)}
          icon={<DollarSign className="h-6 w-6" />}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.recentSales?.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No sales yet</p>
            ) : (
              <div className="space-y-4">
                {summary?.recentSales?.slice(0, 5).map((sale: any) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">Sale #{sale.id}</p>
                      <p className="text-sm text-gray-500">{sale.user.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatCurrency(Number(sale.total), currency)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(sale.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low Stock Alert</CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.lowStockCount === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                All products are well stocked
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                {summary?.lowStockCount} products are running low on stock
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}