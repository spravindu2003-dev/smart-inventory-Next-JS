'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getProducts } from '@/actions/products';
import { createProductChangeRequest, getRequests } from '@/actions/requests';
import { useAuth } from '@/hooks/use-auth';
import { useAuthToken } from '@/hooks/use-auth-token';
import { usePusherChannel } from '@/hooks/use-pusher-channel';
import { formatCurrency } from '@/lib/utils';
import { Plus, Pencil, Trash2, Search, Send, Clock, ArrowRight } from 'lucide-react';
import { toast } from '@/lib/toast';

const removalOptions = [
  { value: '', label: 'No reason' },
  { value: 'expired', label: 'Expired' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'low_demand', label: 'Low Demand' },
];

const changeableFields = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'sku', label: 'SKU', type: 'text' },
  { key: 'price', label: 'Price', type: 'number' },
  { key: 'stock', label: 'Stock', type: 'number' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
];

interface PendingRequest {
  id: number;
  status: string;
  actionType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export default function ProductsPage() {
  const { user } = useAuth();
  const token = useAuthToken();
  const currency = user?.currency;
  const isCashier = user?.role === 'cashier';
  const isManager = user?.role === 'owner' || user?.role === 'manager';

  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const [requestModalProduct, setRequestModalProduct] = React.useState<any>(null);
  const [selectedFields, setSelectedFields] = React.useState<Record<string, string>>({});
  const [requestReason, setRequestReason] = React.useState('');
  const [submittingRequest, setSubmittingRequest] = React.useState(false);
  const [pendingRequests, setPendingRequests] = React.useState<Record<number, PendingRequest[]>>({});

  async function fetchProducts() {
    try {
      const data = await getProducts(token, { filter });
      if ('error' in data) {
        toast.error(typeof data.error === 'string' ? data.error : 'An error occurred');
      } else {
        setProducts(data.products);
      }
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingRequests() {
    if (!isCashier || !token) return;
    try {
      const data = await getRequests(token, { status: 'PENDING' });
      if ('requests' in data) {
        const byProduct: Record<number, PendingRequest[]> = {};
        for (const req of (data as any).requests) {
          if (req.targetType === 'product') {
            if (!byProduct[req.targetId]) byProduct[req.targetId] = [];
            byProduct[req.targetId].push(req);
          }
        }
        setPendingRequests(byProduct);
      }
    } catch { /* ignore */ }
  }

  React.useEffect(() => {
    fetchProducts();
  }, [filter]);

  React.useEffect(() => {
    if (isCashier && token) {
      fetchPendingRequests();
    }
  }, [isCashier, token]);

  const channelName = user?.businessId ? `business-${user.businessId}` : '';
  const handleRealtimeUpdate = React.useCallback(() => {
    fetchProducts();
    if (isCashier) fetchPendingRequests();
  }, [token, filter, isCashier]);
  usePusherChannel(channelName, 'request-approved', handleRealtimeUpdate);
  usePusherChannel(channelName, 'request-rejected', handleRealtimeUpdate);

  function openRequestModal(product: any) {
    setRequestModalProduct(product);
    setSelectedFields({});
    setRequestReason('');
  }

  function toggleField(key: string, value: string) {
    setSelectedFields((prev) => {
      const next = { ...prev };
      if (next[key] === value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  async function handleSubmitRequest() {
    if (!requestModalProduct || !requestReason.trim()) {
      toast.error('Please provide a reason for the change');
      return;
    }
    if (Object.keys(selectedFields).length === 0) {
      toast.error('Please select at least one field to change');
      return;
    }

    setSubmittingRequest(true);
    try {
      const changes: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(selectedFields)) {
        if (key === 'price') {
          changes[key] = parseFloat(val);
        } else if (key === 'stock') {
          changes[key] = parseInt(val, 10);
        } else if (key === 'expiryDate') {
          changes[key] = val || null;
        } else {
          changes[key] = val;
        }
      }

      const result = await createProductChangeRequest(token, {
        targetType: 'product',
        targetId: requestModalProduct.id,
        actionType: 'UPDATE_PRODUCT',
        changes,
        reason: requestReason.trim(),
      });

      if ('error' in result) {
        toast.error(result.error || 'Failed to submit request');
      } else {
        toast.success('Change request submitted for approval');
        setRequestModalProduct(null);
        fetchPendingRequests();
      }
    } catch {
      toast.error('Failed to submit request');
    } finally {
      setSubmittingRequest(false);
    }
  }

  const filteredProducts = products.filter((product) => {
    if (search) {
      const q = search.toLowerCase();
      return product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500">
            {isCashier ? 'Request changes to products' : 'Manage your inventory products'}
          </p>
        </div>
        {isManager && (
          <Button onClick={() => toast.info('Use the product cards to manage')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'removed'].map((f) => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState title="No products found" description="Get started by adding your first product" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const pending = pendingRequests[product.id];
            const hasPending = pending && pending.length > 0;
            return (
              <Card key={product.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                        {product.removedAt && <Badge variant="destructive">Removed</Badge>}
                        {hasPending && <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
                      </div>
                      <p className="text-sm text-gray-500 mb-1">SKU: {product.sku}</p>
                      {product.category && <Badge variant="secondary" className="mb-2">{product.category}</Badge>}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium text-gray-900">{formatCurrency(Number(product.price), currency)}</span>
                        <span className="text-gray-500">Stock: {product.stock}</span>
                      </div>
                      {product.expiryDate && (
                        <p className="text-xs text-gray-400 mt-2">Expires: {new Date(product.expiryDate).toLocaleDateString()}</p>
                      )}
                      {hasPending && isCashier && (
                        <div className="mt-3 p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                          <p className="text-xs font-medium text-yellow-800 mb-1">Pending Changes:</p>
                          {pending!.map((req) => (
                            <p key={req.id} className="text-xs text-yellow-700">
                              {Object.entries(req.payload).map(([k, v]) => `${k}: ${String(v)}`).join(', ')}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      {!product.removedAt && (
                        isCashier ? (
                          <Button variant="outline" size="sm" onClick={() => openRequestModal(product)} disabled={!!hasPending}>
                            <Send className="h-4 w-4 mr-1" />
                            Request
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => toast.info('Direct editing available for managers')}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isManager && (
                              <Button variant="ghost" size="icon" onClick={() => toast.info('Direct deletion available for managers')}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cashier Request Change Modal */}
      <Modal open={!!requestModalProduct} onClose={() => setRequestModalProduct(null)} title="Request Product Change" className="max-w-xl">
        {requestModalProduct && (
          <div className="space-y-5">
            <div className="p-3 rounded-lg bg-gray-50">
              <p className="text-sm font-medium text-gray-900">{requestModalProduct.name}</p>
              <p className="text-xs text-gray-500">SKU: {requestModalProduct.sku}</p>
            </div>

            {Object.keys(selectedFields).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Changes Preview</p>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Field</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Current</th>
                        <th className="px-3 py-2" />
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Proposed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedFields).map(([key, newVal]) => {
                        const field = changeableFields.find((f) => f.key === key);
                        if (!field) return null;
                        const currentVal = requestModalProduct[key] || '';
                        return (
                          <tr key={key} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium text-gray-700">{field.label}</td>
                            <td className="px-3 py-2 text-gray-500">
                              {key === 'price' ? formatCurrency(Number(currentVal), currency) : String(currentVal || '-')}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-400"><ArrowRight className="h-3 w-3 inline" /></td>
                            <td className="px-3 py-2 font-medium text-green-700">
                              {key === 'price' ? formatCurrency(Number(newVal), currency) : String(newVal || '-')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Select fields to change</p>
              <div className="space-y-2">
                {changeableFields.map((field) => {
                  const currentVal = requestModalProduct[field.key] || '';
                  return (
                    <div key={field.key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`field-${field.key}`}
                        checked={field.key in selectedFields}
                        onChange={() => {
                          if (field.key in selectedFields) {
                            toggleField(field.key, '');
                          } else {
                            const val = field.type === 'number' ? String(currentVal) : field.type === 'date' ? (currentVal ? String(currentVal).slice(0, 10) : '') : String(currentVal || '');
                            toggleField(field.key, val);
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label htmlFor={`field-${field.key}`} className="text-sm text-gray-700 w-24">{field.label}</label>
                      {field.key in selectedFields && (
                        <Input
                          type={field.type}
                          value={selectedFields[field.key]}
                          onChange={(e) => toggleField(field.key, e.target.value)}
                          className="flex-1 h-9"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Why is this change needed?"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setRequestModalProduct(null)}>Cancel</Button>
              <Button onClick={handleSubmitRequest} loading={submittingRequest} disabled={Object.keys(selectedFields).length === 0 || !requestReason.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Submit Request
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
