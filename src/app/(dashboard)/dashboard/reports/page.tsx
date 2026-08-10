'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useAuthToken } from '@/hooks/use-auth-token';
import {
  getReportKPIs,
  getRevenueSalesTrend,
  getProductCategoryDistribution,
  getInventoryStatus,
  getActivityAnalytics,
  getTopProductsReport,
  getLowStockReport,
  getSalesByCategoryReport,
  getSalesByUserReport,
  getRequestAnalytics,
  getCategoriesList,
  getUsersList,
  getBusinessInfo,
  type ReportFilters,
} from '@/actions/reports';
import { generatePDFReport } from '@/lib/pdf-report';
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
  type TooltipValueType,
} from 'recharts';
import {
  Download,
  Filter,
  RotateCcw,
  TrendingUp,
  Package,
  ShoppingCart,
  AlertTriangle,
  Clock,
  DollarSign,
  BarChart3,
  Activity,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from '@/lib/toast';

const COLORS = ['#4f46e5', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const SECTION_OPTIONS = [
  { key: 'kpis', label: 'Summary / KPIs' },
  { key: 'revenue', label: 'Revenue & Sales' },
  { key: 'products', label: 'Product Distribution' },
  { key: 'inventory', label: 'Inventory Health' },
  { key: 'topProducts', label: 'Top Products' },
  { key: 'salesByCategory', label: 'Sales by Category' },
  { key: 'salesByUser', label: 'Sales by User' },
  { key: 'activity', label: 'Activity Log' },
  { key: 'requests', label: 'Change Requests' },
];

const ACTIVITY_TYPES = [
  'all', 'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'DELETE_PRODUCT', 'REMOVE_PRODUCT',
  'CREATE_SALE', 'UPDATE_SALE', 'UNDO_SALE', 'REQUEST_CREATED', 'REQUEST_APPROVED',
  'REQUEST_REJECTED', 'LOGIN', 'LOGOUT', 'CREATE_USER', 'UPDATE_USER',
];

function getPresetDateRange(preset: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  switch (preset) {
    case 'today': return { start: end, end };
    case 'yesterday': {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      const s = d.toISOString().split('T')[0];
      return { start: s, end: s };
    }
    case '7d': {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      return { start: d.toISOString().split('T')[0], end };
    }
    case '30d': {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return { start: d.toISOString().split('T')[0], end };
    }
    case 'thisMonth': {
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { start, end };
    }
    case 'lastMonth': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: d.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
      };
    }
    default: {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return { start: d.toISOString().split('T')[0], end };
    }
  }
}

export default function ReportsPage() {
  const { user } = useAuth();
  const token = useAuthToken();
  const currency = user?.currency;
  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const [loading, setLoading] = React.useState(true);
  const [loadingSections, setLoadingSections] = React.useState<Set<string>>(new Set());

  // Filter state
  const [datePreset, setDatePreset] = React.useState('30d');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [userId, setUserId] = React.useState<number | undefined>();
  const [activityType, setActivityType] = React.useState('all');
  const [requestStatus, setRequestStatus] = React.useState('all');
  const [showFilters, setShowFilters] = React.useState(true);

  // Section toggle
  const [selectedSections, setSelectedSections] = React.useState<string[]>(
    SECTION_OPTIONS.map((s) => s.key)
  );

  // Collapsible sections
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  // Data
  const [kpis, setKpis] = React.useState<Record<string, number> | null>(null);
  const [revenueData, setRevenueData] = React.useState<any[]>([]);
  const [productDist, setProductDist] = React.useState<any>(null);
  const [inventoryStatus, setInventoryStatus] = React.useState<any>(null);
  const [activityData, setActivityData] = React.useState<any>(null);
  const [topProducts, setTopProducts] = React.useState<any[]>([]);
  const [lowStockData, setLowStockData] = React.useState<any>(null);
  const [salesByCategory, setSalesByCategory] = React.useState<any[]>([]);
  const [salesByUser, setSalesByUser] = React.useState<any[]>([]);
  const [requestData, setRequestData] = React.useState<any>(null);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [businessInfo, setBusinessInfo] = React.useState<{ name: string; currency: string } | null>(null);

  const filters: ReportFilters = React.useMemo(() => {
    let s = startDate;
    let e = endDate;
    if (!startDate && !endDate) {
      const range = getPresetDateRange(datePreset);
      s = range.start;
      e = range.end;
    }
    const f: ReportFilters = {};
    if (s) f.startDate = s;
    if (e) f.endDate = e;
    if (category !== 'all') f.category = category;
    if (userId) f.userId = userId;
    if (activityType !== 'all') f.activityType = activityType;
    if (requestStatus !== 'all') f.requestStatus = requestStatus;
    return f;
  }, [datePreset, startDate, endDate, category, userId, activityType, requestStatus]);

  async function loadAllSections() {
    setLoading(true);
    try {
      const [kpiData, catList, userList, bizInfo] = await Promise.all([
        getReportKPIs(token, filters),
        getCategoriesList(token),
        getUsersList(token),
        getBusinessInfo(token),
      ]);
      if ('totalRevenue' in kpiData) setKpis(kpiData as Record<string, number>);
      if ('categories' in catList) setCategories(catList.categories);
      if ('users' in userList) setUsers(userList.users);
      if ('name' in bizInfo) setBusinessInfo(bizInfo as { name: string; currency: string });
    } catch {
      toast.error('Failed to load report data');
    }
    setLoading(false);
  }

  async function loadSection(section: string) {
    setLoadingSections((prev) => new Set(prev).add(section));
    try {
      switch (section) {
        case 'revenue': {
          const data = await getRevenueSalesTrend(token, filters);
          if ('trend' in data && data.trend) setRevenueData(data.trend);
          break;
        }
        case 'products': {
          const data = await getProductCategoryDistribution(token, filters);
          if ('productsByCategory' in data) setProductDist(data);
          break;
        }
        case 'inventory': {
          const [inv, low] = await Promise.all([getInventoryStatus(token), getLowStockReport(token)]);
          setInventoryStatus(inv);
          if ('lowStock' in low) setLowStockData(low);
          break;
        }
        case 'activity': {
          if (!canManage) break;
          const data = await getActivityAnalytics(token, filters);
          if ('error' in data) break;
          setActivityData(data);
          break;
        }
        case 'topProducts': {
          const data = await getTopProductsReport(token, filters);
          if ('products' in data) setTopProducts(data.products);
          break;
        }
        case 'salesByCategory': {
          const data = await getSalesByCategoryReport(token, filters);
          if ('categories' in data) setSalesByCategory(data.categories);
          break;
        }
        case 'salesByUser': {
          const data = await getSalesByUserReport(token, filters);
          if ('users' in data) setSalesByUser(data.users);
          break;
        }
        case 'requests': {
          const data = await getRequestAnalytics(token, filters);
          if ('total' in data) setRequestData(data);
          break;
        }
      }
    } catch {
      // silently fail for individual sections
    }
    setLoadingSections((prev) => {
      const next = new Set(prev);
      next.delete(section);
      return next;
    });
  }

  React.useEffect(() => {
    if (!token) return;
    loadAllSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters]);

  React.useEffect(() => {
    if (!token) return;
    selectedSections.forEach((s) => {
      if (s !== 'kpis') loadSection(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters]);

  function toggleSection(key: string) {
    setSelectedSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  }

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetFilters() {
    setDatePreset('30d');
    setStartDate('');
    setEndDate('');
    setCategory('all');
    setUserId(undefined);
    setActivityType('all');
    setRequestStatus('all');
  }

  function getCurrencySymbol(): string {
    if (!currency) return 'Rs.';
    if (currency === 'USD') return '$';
    if (currency === 'EUR') return '\u20AC';
    if (currency === 'GBP') return '\u00A3';
    if (currency === 'INR') return '\u20B9';
    return 'Rs.';
  }

  async function handleExportPDF() {
    toast.info('Generating PDF report...');
    try {
      const sym = getCurrencySymbol();
      const dateRange = !startDate && !endDate ? getPresetDateRange(datePreset) : { start: startDate, end: endDate };
      generatePDFReport({
        businessName: businessInfo?.name || 'Smart Inventory',
        reportTitle: 'Inventory Management Report',
        generatedAt: new Date().toLocaleString(),
        dateRange: dateRange.start ? { start: dateRange.start, end: dateRange.end } : null,
        currency: currency || 'LKR',
        currencySymbol: sym,
        sections: selectedSections,
        kpis: kpis || undefined,
        revenueTrend: revenueData,
        productByCategory: productDist?.productsByCategory,
        stockByCategory: productDist?.stockByCategory,
        inventoryStatus: inventoryStatus || undefined,
        topProducts: topProducts,
        lowStockProducts: lowStockData?.lowStock,
        outOfStockProducts: lowStockData?.outOfStock,
        salesByCategory: salesByCategory,
        salesByUser: salesByUser,
        activityByType: activityData?.byType,
        requestByStatus: requestData?.byStatus,
        requestByType: requestData?.byType,
      });
      toast.success('PDF report downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    }
  }

  function handleExportCSV() {
    const rows: string[] = [];
    rows.push('Section,Field,Value');
    if (kpis) {
      Object.entries(kpis).forEach(([k, v]) => rows.push(`KPI,${k},${v}`));
    }
    topProducts.forEach((p) => rows.push(`Top Product,${p.name},${p.totalSold} sold,${p.totalRevenue}`));
    salesByCategory.forEach((c) => rows.push(`Sales by Category,${c.category},${c.quantity} units,${c.revenue}`));
    salesByUser.forEach((u) => rows.push(`Sales by User,${u.user.name},${u.saleCount} sales,${u.totalRevenue}`));

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  }

  function SectionHeader({ title, sectionKey, icon }: { title: string; sectionKey: string; icon: React.ReactNode }) {
    const isCollapsed = collapsed.has(sectionKey);
    return (
      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleCollapse(sectionKey)}>
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          {icon}
          {title}
        </CardTitle>
        <button className="p-1 hover:bg-gray-100 rounded">
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm">Business intelligence and analytics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={handleExportPDF} className="bg-blue-600 hover:bg-blue-700">
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 text-sm font-medium text-gray-700">
              <Filter className="h-4 w-4" /> Filters
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <button onClick={resetFilters} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          {showFilters && (
            <div className="space-y-3">
              {/* Date Range */}
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'today', label: 'Today' },
                  { value: 'yesterday', label: 'Yesterday' },
                  { value: '7d', label: '7 Days' },
                  { value: '30d', label: '30 Days' },
                  { value: 'thisMonth', label: 'This Month' },
                  { value: 'lastMonth', label: 'Last Month' },
                ].map((p) => (
                  <Button
                    key={p.value}
                    variant={datePreset === p.value && !startDate && !endDate ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setDatePreset(p.value); setStartDate(''); setEndDate(''); }}
                    className="text-xs"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-500">From:</label>
                  <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }} className="h-8 w-36 text-xs" />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-500">To:</label>
                  <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }} className="h-8 w-36 text-xs" />
                </div>
              </div>

              {/* Category & User */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-8 rounded-lg border border-gray-300 px-2 text-xs"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>

                {canManage && (
                  <select
                    value={userId || ''}
                    onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : undefined)}
                    className="h-8 rounded-lg border border-gray-300 px-2 text-xs"
                  >
                    <option value="">All Users</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                )}

                {selectedSections.includes('activity') && canManage && (
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                    className="h-8 rounded-lg border border-gray-300 px-2 text-xs"
                  >
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t} value={t}>{t === 'all' ? 'All Activities' : t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                )}

                {selectedSections.includes('requests') && (
                  <select
                    value={requestStatus}
                    onChange={(e) => setRequestStatus(e.target.value)}
                    className="h-8 rounded-lg border border-gray-300 px-2 text-xs"
                  >
                    <option value="all">All Requests</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                )}
              </div>

              {/* Section Toggles */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Report Sections:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SECTION_OPTIONS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => toggleSection(s.key)}
                      className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                        selectedSections.includes(s.key)
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {selectedSections.includes('kpis') && kpis && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-xs text-gray-500">Revenue</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(kpis.totalRevenue || 0, currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-gray-500">Sales</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{kpis.totalSales || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-gray-500">Products</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{kpis.totalProducts || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-indigo-600" />
                <span className="text-xs text-gray-500">Stock Units</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{kpis.totalStockUnits || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-xs text-gray-500">Low Stock</span>
              </div>
              <p className="text-lg font-bold text-yellow-600">{kpis.lowStock || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-xs text-gray-500">Out of Stock</span>
              </div>
              <p className="text-lg font-bold text-red-600">{kpis.outOfStock || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-xs text-gray-500">Pending Requests</span>
              </div>
              <p className="text-lg font-bold text-orange-600">{kpis.pendingRequests || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-teal-600" />
                <span className="text-xs text-gray-500">Inventory Value</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(kpis.inventoryValue || 0, currency)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue & Sales Trend */}
      {selectedSections.includes('revenue') && (
        <Card>
          <CardHeader>
            <SectionHeader title="Revenue & Sales Trend" sectionKey="revenue" icon={<TrendingUp className="h-4 w-4" />} />
          </CardHeader>
          {!collapsed.has('revenue') && (
            <CardContent>
              {loadingSections.has('revenue') ? (
                <Skeleton className="h-64" />
              ) : revenueData.length === 0 ? (
                <EmptyState title="No sales data" description="No sales recorded for the selected period" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="revenue" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: TooltipValueType | undefined, name: string | undefined) =>
                        name === 'revenue' ? formatCurrency(Number(value ?? 0), currency) : String(value ?? '')
                      }
                    />
                    <Legend />
                    <Line yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} dot={false} name="Revenue" />
                    <Line yAxisId="count" type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={false} name="Sales Count" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Product Distribution & Inventory - 2 column */}
      <div className="grid gap-6 md:grid-cols-2">
        {selectedSections.includes('products') && (
          <Card>
            <CardHeader>
              <SectionHeader title="Products by Category" sectionKey="products" icon={<BarChart3 className="h-4 w-4" />} />
            </CardHeader>
            {!collapsed.has('products') && (
              <CardContent>
                {loadingSections.has('products') ? (
                  <Skeleton className="h-64" />
                ) : !productDist?.productsByCategory?.length ? (
                  <EmptyState title="No categories" description="No products with categories found" />
                ) : productDist.productsByCategory.length <= 8 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={productDist.productsByCategory}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        dataKey="count"
                        nameKey="category"
                      >
                        {productDist.productsByCategory.map((_: any, index: number) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={productDist.productsByCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {selectedSections.includes('inventory') && (
          <Card>
            <CardHeader>
              <SectionHeader title="Inventory Status" sectionKey="inventory" icon={<Package className="h-4 w-4" />} />
            </CardHeader>
            {!collapsed.has('inventory') && (
              <CardContent>
                {loadingSections.has('inventory') ? (
                  <Skeleton className="h-64" />
                ) : !inventoryStatus ? (
                  <EmptyState title="No data" description="No inventory data available" />
                ) : (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'In Stock', value: inventoryStatus.inStock },
                            { name: 'Low Stock', value: inventoryStatus.lowStock },
                            { name: 'Out of Stock', value: inventoryStatus.outOfStock },
                            { name: 'Expired', value: inventoryStatus.expired },
                          ].filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {[0, 1, 2, 3].map((index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    {lowStockData && (
                      <div className="space-y-2">
                        {lowStockData.lowStock?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-yellow-700 mb-1">Low Stock ({lowStockData.lowStock.length})</p>
                            <div className="max-h-24 overflow-y-auto space-y-1">
                              {lowStockData.lowStock.slice(0, 5).map((p: any) => (
                                <div key={p.id} className="flex justify-between text-xs">
                                  <span className="text-gray-700 truncate">{p.name}</span>
                                  <span className="text-yellow-600 font-medium shrink-0">{p.stock}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {lowStockData.outOfStock?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-700 mb-1">Out of Stock ({lowStockData.outOfStock.length})</p>
                            <div className="max-h-24 overflow-y-auto space-y-1">
                              {lowStockData.outOfStock.slice(0, 5).map((p: any) => (
                                <div key={p.id} className="flex justify-between text-xs">
                                  <span className="text-gray-700 truncate">{p.name}</span>
                                  <Badge variant="destructive" className="text-[10px]">0</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {/* Top Products */}
      {selectedSections.includes('topProducts') && (
        <Card>
          <CardHeader>
            <SectionHeader title="Top Products" sectionKey="topProducts" icon={<TrendingUp className="h-4 w-4" />} />
          </CardHeader>
          {!collapsed.has('topProducts') && (
            <CardContent>
              {loadingSections.has('topProducts') ? (
                <Skeleton className="h-64" />
              ) : topProducts.length === 0 ? (
                <EmptyState title="No sales data" description="No products with sales in the selected period" />
              ) : (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={Math.min(topProducts.length * 35, 400)}>
                    <BarChart data={topProducts.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: TooltipValueType | undefined, name: string | undefined) =>
                        name === 'totalRevenue' ? formatCurrency(Number(value ?? 0), currency) : String(value ?? '')
                      } />
                      <Legend />
                      <Bar dataKey="totalSold" fill="#4f46e5" radius={[0, 4, 4, 0]} name="Qty Sold" />
                      <Bar dataKey="totalRevenue" fill="#16a34a" radius={[0, 4, 4, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-gray-500">
                          <th className="pb-2 font-medium">#</th>
                          <th className="pb-2 font-medium">Product</th>
                          <th className="pb-2 font-medium">Category</th>
                          <th className="pb-2 font-medium text-right">Qty Sold</th>
                          <th className="pb-2 font-medium text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.slice(0, 10).map((p, i) => (
                          <tr key={p.id} className="border-b border-gray-50">
                            <td className="py-1.5 text-gray-400">{i + 1}</td>
                            <td className="py-1.5 font-medium text-gray-900">{p.name}</td>
                            <td className="py-1.5 text-gray-500">{p.category}</td>
                            <td className="py-1.5 text-right">{p.totalSold}</td>
                            <td className="py-1.5 text-right font-medium">{formatCurrency(p.totalRevenue, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Sales by Category & Sales by User - 2 column */}
      <div className="grid gap-6 md:grid-cols-2">
        {selectedSections.includes('salesByCategory') && (
          <Card>
            <CardHeader>
              <SectionHeader title="Sales by Category" sectionKey="salesByCategory" icon={<BarChart3 className="h-4 w-4" />} />
            </CardHeader>
            {!collapsed.has('salesByCategory') && (
              <CardContent>
                {loadingSections.has('salesByCategory') ? (
                  <Skeleton className="h-64" />
                ) : salesByCategory.length === 0 ? (
                  <EmptyState title="No sales" description="No sales data for the selected period" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesByCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="qty" />
                      <YAxis yAxisId="rev" orientation="right" />
                      <Tooltip formatter={(value: TooltipValueType | undefined, name: string | undefined) =>
                        name === 'revenue' ? formatCurrency(Number(value ?? 0), currency) : String(value ?? '')
                      } />
                      <Legend />
                      <Bar yAxisId="qty" dataKey="quantity" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Qty Sold" />
                      <Bar yAxisId="rev" dataKey="revenue" fill="#16a34a" radius={[4, 4, 0, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {selectedSections.includes('salesByUser') && (
          <Card>
            <CardHeader>
              <SectionHeader title="Sales by User" sectionKey="salesByUser" icon={<Activity className="h-4 w-4" />} />
            </CardHeader>
            {!collapsed.has('salesByUser') && (
              <CardContent>
                {loadingSections.has('salesByUser') ? (
                  <Skeleton className="h-64" />
                ) : salesByUser.length === 0 ? (
                  <EmptyState title="No sales" description="No sales data found" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-gray-500">
                          <th className="pb-2 font-medium">User</th>
                          <th className="pb-2 font-medium">Role</th>
                          <th className="pb-2 font-medium text-right">Sales</th>
                          <th className="pb-2 font-medium text-right">Items</th>
                          <th className="pb-2 font-medium text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesByUser.map((u: any) => (
                          <tr key={u.user.id} className="border-b border-gray-50">
                            <td className="py-1.5 font-medium text-gray-900">{u.user.name}</td>
                            <td className="py-1.5 text-gray-500 capitalize">{u.user.role}</td>
                            <td className="py-1.5 text-right">{u.saleCount}</td>
                            <td className="py-1.5 text-right">{u.totalItems}</td>
                            <td className="py-1.5 text-right font-medium">{formatCurrency(u.totalRevenue, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {/* Activity Log */}
      {selectedSections.includes('activity') && canManage && (
        <Card>
          <CardHeader>
            <SectionHeader title="Activity Log Analytics" sectionKey="activity" icon={<Activity className="h-4 w-4" />} />
          </CardHeader>
          {!collapsed.has('activity') && (
            <CardContent>
              {loadingSections.has('activity') ? (
                <Skeleton className="h-64" />
              ) : !activityData ? (
                <EmptyState title="No activity data" description="No activities recorded for the selected period" />
              ) : (
                <div className="space-y-4">
                  {activityData.timeline?.length > 0 && (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={activityData.timeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Activities" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {activityData.byType?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">By Type</p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {activityData.byType.map((a: any) => (
                          <div key={a.action} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                            <span className="text-xs text-gray-600">{a.action.replace(/_/g, ' ')}</span>
                            <Badge variant="secondary" className="text-xs">{a.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Requests */}
      {selectedSections.includes('requests') && (
        <Card>
          <CardHeader>
            <SectionHeader title="Change Request Analytics" sectionKey="requests" icon={<Clock className="h-4 w-4" />} />
          </CardHeader>
          {!collapsed.has('requests') && (
            <CardContent>
              {loadingSections.has('requests') ? (
                <Skeleton className="h-64" />
              ) : !requestData ? (
                <EmptyState title="No requests" description="No change requests found" />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {requestData.byStatus?.map((s: any) => (
                      <div key={s.status} className="p-3 rounded-lg border">
                        <p className="text-xs text-gray-500">{s.status}</p>
                        <p className="text-2xl font-bold text-gray-900">{s.count}</p>
                      </div>
                    ))}
                  </div>
                  {requestData.byType?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">By Type</p>
                      <div className="flex flex-wrap gap-2">
                        {requestData.byType.map((t: any) => (
                          <Badge key={t.type} variant="secondary">{t.type.replace(/_/g, ' ')}: {t.count}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {requestData.timeline?.length > 0 && (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={requestData.timeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="created" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Created" />
                        <Bar dataKey="approved" fill="#16a34a" radius={[4, 4, 0, 0]} name="Approved" />
                        <Bar dataKey="rejected" fill="#dc2626" radius={[4, 4, 0, 0]} name="Rejected" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
