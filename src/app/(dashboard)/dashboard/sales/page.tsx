'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getSales, createSale, updateSale, undoSale } from '@/actions/sales';
import { getProducts } from '@/actions/products';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Pencil, Undo2, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';

export default function SalesPage() {
  const { user } = useAuth();
  const currency = user?.currency;
  const isManager = user?.role === 'owner' || user?.role === 'manager';

  const [sales, setSales] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [products, setProducts] = React.useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = React.useState('');
  const [selectedQty, setSelectedQty] = React.useState(1);
  const [cart, setCart] = React.useState<any[]>([]);
  const [saving, setSaving] = React.useState(false);

  const [editTarget, setEditTarget] = React.useState<any>(null);
  const [editCart, setEditCart] = React.useState<any[]>([]);
  const [editSaving, setEditSaving] = React.useState(false);
  const [editProductId, setEditProductId] = React.useState('');
  const [editQty, setEditQty] = React.useState(1);

  const [undoTarget, setUndoTarget] = React.useState<any>(null);
  const [undoing, setUndoing] = React.useState(false);

  async function fetchSales() {
    try {
      const data = await getSales();
      if ('error' in data) {
        toast.error(data.error || 'An error occurred');
      } else {
        setSales(data.sales);
      }
    } catch (error) {
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchSales();
  }, []);

  async function openCreate() {
    setSelectedProductId('');
    setSelectedQty(1);
    setCart([]);
    setCreateOpen(true);
    try {
      const data = await getProducts();
      if ('error' in data) {
        toast.error(data.error || 'An error occurred');
      } else {
        setProducts(data.products.filter((p: any) => !p.removedAt && p.stock > 0));
      }
    } catch (error) {
      toast.error('Failed to load products');
    }
  }

  function handleAddToCart() {
    if (!selectedProductId) {
      toast.error('Please select a product');
      return;
    }
    const product = products.find((p) => p.id === parseInt(selectedProductId, 10));
    if (!product) {
      toast.error('Selected product not found');
      return;
    }
    const qty = parseInt(String(selectedQty), 10);
    if (!qty || qty < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      toast.error('Product already in cart');
      return;
    }
    if (qty > product.stock) {
      toast.error(`Insufficient stock. Available: ${product.stock}`);
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: qty,
        availableStock: product.stock,
        price: Number(product.price),
      },
    ]);
    setSelectedProductId('');
    setSelectedQty(1);
  }

  function handleRemoveFromCart(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateSale() {
    if (cart.length === 0) {
      toast.error('Cart is empty. Add at least one product.');
      return;
    }
    setSaving(true);
    try {
      const items = cart.map((c) => ({ productId: c.productId, quantity: c.quantity }));
      const result = await createSale({ items });
      if ('error' in result) {
        toast.error(result.error || 'An error occurred');
      } else {
        toast.success('Sale created successfully!');
        setCreateOpen(false);
        fetchSales();
      }
    } catch (error) {
      toast.error('Failed to create sale');
    } finally {
      setSaving(false);
    }
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  async function openEdit(sale: any) {
    setEditTarget(sale);
    setEditCart(
      sale.items.map((item: any) => ({
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        price: Number(item.product.price),
        saleItemId: item.id,
      }))
    );
    setEditProductId('');
    setEditQty(1);
    try {
      const data = await getProducts();
      if ('error' in data) {
        toast.error(data.error || 'An error occurred');
      } else {
        setProducts(data.products.filter((p: any) => !p.removedAt));
      }
    } catch (error) {
      toast.error('Failed to load products');
    }
  }

  function handleEditCartQty(index: number, qty: number) {
    setEditCart((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: qty || 1 } : item
      )
    );
  }

  function handleRemoveEditItem(index: number) {
    setEditCart((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddEditItem() {
    if (!editProductId) {
      toast.error('Please select a product');
      return;
    }
    const product = products.find((p) => p.id === parseInt(editProductId, 10));
    if (!product) {
      toast.error('Selected product not found');
      return;
    }
    const qty = parseInt(String(editQty), 10);
    if (!qty || qty < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    const existing = editCart.find((c) => c.productId === product.id);
    if (existing) {
      toast.error('Product already in cart');
      return;
    }
    setEditCart((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: qty,
        price: Number(product.price),
      },
    ]);
    setEditProductId('');
    setEditQty(1);
  }

  async function handleUpdateSale() {
    if (editCart.length === 0) {
      toast.error('Cart is empty. Add at least one product.');
      return;
    }
    setEditSaving(true);
    try {
      const items = editCart.map((c) => ({ productId: c.productId, quantity: c.quantity }));
      const result = await updateSale(editTarget.id, { items });
      if ('error' in result) {
        toast.error(result.error || 'An error occurred');
      } else {
        toast.success('Sale updated successfully!');
        setEditTarget(null);
        fetchSales();
      }
    } catch (error) {
      toast.error('Failed to update sale');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleUndo() {
    if (!undoTarget) return;
    setUndoing(true);
    try {
      const result = await undoSale(undoTarget.id);
      if ('error' in result) {
        toast.error(result.error || 'An error occurred');
      } else {
        toast.success('Sale undone successfully!');
        setUndoTarget(null);
        fetchSales();
      }
    } catch (error) {
      toast.error('Failed to undo sale');
    } finally {
      setUndoing(false);
    }
  }

  const editCartTotal = editCart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-500">Manage your sales transactions</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Sale
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <EmptyState
          title="No sales yet"
          description="Create your first sale to get started"
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Sale
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {sales.map((sale) => (
            <Card key={sale.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">Sale #{sale.id}</h3>
                      <Badge variant="secondary">{sale.items.length} items</Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      By {sale.user.name} • {formatDate(sale.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(Number(sale.total), currency)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(sale)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {isManager && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUndoTarget(sale)}
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          Undo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Sale Modal */}
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCart([]);
        }}
        title="Create Sale"
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} (Stock: {product.stock})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qty
              </label>
              <Input
                type="number"
                min="1"
                value={selectedQty}
                onChange={(e) => setSelectedQty(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddToCart}>Add</Button>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Product</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Price</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Qty</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Subtotal</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => (
                    <tr key={index} className="border-b last:border-b-0">
                      <td className="p-3">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.sku}</p>
                      </td>
                      <td className="p-3 text-right text-sm">{formatCurrency(item.price, currency)}</td>
                      <td className="p-3 text-right text-sm">{item.quantity}</td>
                      <td className="p-3 text-right text-sm font-medium">
                        {formatCurrency(item.price * item.quantity, currency)}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFromCart(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-gray-50 flex justify-end">
                <span className="font-bold text-gray-900">
                  Total: {formatCurrency(cartTotal, currency)}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setCart([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSale} loading={saving} disabled={cart.length === 0}>
              Create Sale
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Sale Modal */}
      <Modal
        open={!!editTarget}
        onClose={() => {
          setEditTarget(null);
          setEditCart([]);
        }}
        title={`Edit Sale #${editTarget?.id}`}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product
              </label>
              <select
                value={editProductId}
                onChange={(e) => setEditProductId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} (Stock: {product.stock})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qty
              </label>
              <Input
                type="number"
                min="1"
                value={editQty}
                onChange={(e) => setEditQty(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddEditItem}>Add</Button>
            </div>
          </div>

          {editCart.length > 0 && (
            <div className="border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Product</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Price</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Qty</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Subtotal</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {editCart.map((item, index) => (
                    <tr key={index} className="border-b last:border-b-0">
                      <td className="p-3">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.sku}</p>
                      </td>
                      <td className="p-3 text-right text-sm">{formatCurrency(item.price, currency)}</td>
                      <td className="p-3 text-right">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleEditCartQty(index, parseInt(e.target.value) || 1)
                          }
                          className="w-20 text-right"
                        />
                      </td>
                      <td className="p-3 text-right text-sm font-medium">
                        {formatCurrency(item.price * item.quantity, currency)}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveEditItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-gray-50 flex justify-end">
                <span className="font-bold text-gray-900">
                  Total: {formatCurrency(editCartTotal, currency)}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setEditTarget(null);
                setEditCart([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateSale} loading={editSaving} disabled={editCart.length === 0}>
              Update Sale
            </Button>
          </div>
        </div>
      </Modal>

      {/* Undo Sale Modal */}
      <Modal
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        title="Undo Sale"
        description="Are you sure you want to undo this sale? Stock will be restored."
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setUndoTarget(null)}>
            Cancel
          </Button>
          <Button variant="destructive" loading={undoing} onClick={handleUndo}>
            Undo Sale
          </Button>
        </div>
      </Modal>
    </div>
  );
}