'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getMostSold, getLeastSold, getLowStock, getDeadStock } from '@/actions/insights';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { TrendingUp, TrendingDown, AlertTriangle, Package } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function InsightsPage() {
  const { user } = useAuth();
  const currency = user?.currency;
  const [mostSold, setMostSold] = React.useState<any[]>([]);
  const [leastSold, setLeastSold] = React.useState<any[]>([]);
  const [lowStock, setLowStock] = React.useState<any[]>([]);
  const [deadStock, setDeadStock] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadInsights() {
      try {
        const [mostSoldData, leastSoldData, lowStockData, deadStockData] = await Promise.all([
          getMostSold(),
          getLeastSold(),
          getLowStock(),
          getDeadStock(),
        ]);

        if ('products' in mostSoldData && mostSoldData.products) setMostSold(mostSoldData.products);
        if ('products' in leastSoldData && leastSoldData.products) setLeastSold(leastSoldData.products);
        if ('products' in lowStockData && lowStockData.products) setLowStock(lowStockData.products);
        if ('products' in deadStockData && deadStockData.products) setDeadStock(deadStockData.products);
      } catch (error) {
        console.error('Failed to load insights:', error);
      } finally {
        setLoading(false);
      }
    }

    loadInsights();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  const chartData = mostSold.slice(0, 10).map((p) => ({
    name: p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
    sold: p.totalSold,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
        <p className="text-gray-500">Analyze your inventory and sales performance</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Most Sold Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mostSold.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No sales data</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sold" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Least Sold Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leastSold.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No sales data</p>
            ) : (
              <div className="space-y-3">
                {leastSold.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {product.totalSold} sold
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(product.totalRevenue, currency)}
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
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                All products are well stocked
              </p>
            ) : (
              <div className="space-y-3">
                {lowStock.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-yellow-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.sku}</p>
                    </div>
                    <span className="text-sm font-medium text-yellow-700">
                      {product.stock} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-500" />
              Dead Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deadStock.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No dead stock products
              </p>
            ) : (
              <div className="space-y-3">
                {deadStock.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.sku}</p>
                    </div>
                    <span className="text-sm font-medium text-gray-500">
                      Stock: {product.stock}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}