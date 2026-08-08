'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getSalesTrend,
  getRevenueTrend,
  getTopProducts,
  getStockDistribution,
  getCategoryDistribution,
  getQuickInsights,
} from '@/actions/insights';
import { formatCurrency } from '@/lib/utils';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = ['#4f46e5', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4'];

export default function ReportsPage() {
  const [salesTrend, setSalesTrend] = React.useState<any[]>([]);
  const [revenueTrend, setRevenueTrend] = React.useState<any[]>([]);
  const [topProducts, setTopProducts] = React.useState<any[]>([]);
  const [stockDist, setStockDist] = React.useState<any>(null);
  const [categoryDist, setCategoryDist] = React.useState<any[]>([]);
  const [quickInsights, setQuickInsights] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadReports() {
      try {
        const [salesTrendData, revenueTrendData, topProductsData, stockDistData, categoryDistData, quickInsightsData] =
          await Promise.all([
            getSalesTrend(30),
            getRevenueTrend(30),
            getTopProducts(10),
            getStockDistribution(),
            getCategoryDistribution(),
            getQuickInsights(),
          ]);

        if ('trend' in salesTrendData && salesTrendData.trend) setSalesTrend(salesTrendData.trend);
        if ('trend' in revenueTrendData && revenueTrendData.trend) setRevenueTrend(revenueTrendData.trend);
        if ('products' in topProductsData && topProductsData.products) setTopProducts(topProductsData.products);
        if ('inStock' in stockDistData) setStockDist(stockDistData);
        if ('categories' in categoryDistData && categoryDistData.categories) setCategoryDist(categoryDistData.categories);
        if ('bestSeller' in quickInsightsData) setQuickInsights(quickInsightsData);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  const stockPieData = stockDist
    ? [
        { name: 'In Stock', value: stockDist.inStock },
        { name: 'Low Stock', value: stockDist.lowStock },
        { name: 'Out of Stock', value: stockDist.outOfStock },
        { name: 'Expired', value: stockDist.expired },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500">Business intelligence and analytics</p>
      </div>

      {quickInsights && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Best Seller</p>
              <p className="text-lg font-bold text-gray-900">
                {quickInsights.bestSeller?.name || 'N/A'}
              </p>
              <p className="text-sm text-gray-500">
                {quickInsights.bestSeller?.totalSold || 0} sold
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Avg Sale Value</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(quickInsights.avgSaleValue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Low Stock Alerts</p>
              <p className="text-lg font-bold text-gray-900">
                {quickInsights.lowStockAlerts?.length || 0} products
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip formatter={(value: string | number | (string | number)[]) => formatCurrency(Number(value))} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="totalSold" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stockPieData.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stockPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stockPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryDist.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No categories</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryDist}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}