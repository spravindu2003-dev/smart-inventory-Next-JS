'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getProducts, createProduct, updateProduct, deleteProduct, removeProduct } from '@/actions/products';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency } from '@/lib/utils';
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react';
import { toast } from '@/lib/toast';

const emptyForm = {
  name: '',
  sku: '',
  price: '',
  stock: '',
  category: '',
  description: '',
  expiryDate: '',
};

const removalOptions = [
  { value: '', label: 'No reason' },
  { value: 'expired', label: 'Expired' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'low_demand', label: 'Low Demand' },
];

export default function ProductsPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'owner' || user?.role === 'manager';

  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<any>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<any>(null);
  const [removalReason, setRemovalReason] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  async function fetchProducts() {
    try {
      const data = await getProducts({ filter });
      if ('error' in data) {
        toast.error(data.error || 'An error occurred');
      } else {
        setProducts(data.products);
      }
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchProducts();
  }, [filter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(product: any) {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      price: String(product.price),
      stock: String(product.stock),
      category: product.category || '',
      description: product.description || '',
      expiryDate: product.expiryDate ? product.expiryDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10) || 0,
        expiryDate: form.expiryDate || null,
      };

      let result;
      if (editing) {
        result = await updateProduct(editing.id, payload);
      } else {
        result = await createProduct(payload);
      }

      if ('error' in result) {
        toast.error(result.error || 'An error occurred');
      } else {
        toast.success(editing ? 'Product updated' : 'Product created');
        setModalOpen(false);
        setEditing(null);
        setForm(emptyForm);
        fetchProducts();
      }
    } catch (error) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      let result;
      if (removalReason) {
        result = await removeProduct(deleteTarget.id, removalReason);
      } else {
        result = await deleteProduct(deleteTarget.id);
      }

      if ('error' in result) {
        toast.error(result.error || 'An error occurred');
      } else {
        toast.success('Product removed');
        setDeleteTarget(null);
        fetchProducts();
      }
    } catch (error) {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const filteredProducts = products.filter((product) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500">Manage your inventory products</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('active')}
          >
            Active
          </Button>
          <Button
            variant={filter === 'removed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('removed')}
          >
            Removed
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Get started by adding your first product"
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{product.name}</h3>
                      {product.removedAt && (
                        <Badge variant="destructive">Removed</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-1">SKU: {product.sku}</p>
                    {product.category && (
                      <Badge variant="secondary" className="mb-2">
                        {product.category}
                      </Badge>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium text-gray-900">
                        {formatCurrency(Number(product.price))}
                      </span>
                      <span className="text-gray-500">
                        Stock: {product.stock}
                      </span>
                    </div>
                    {product.expiryDate && (
                      <p className="text-xs text-gray-400 mt-2">
                        Expires: {new Date(product.expiryDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!product.removedAt && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isManager && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(product)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setForm(emptyForm);
        }}
        title={editing ? 'Edit Product' : 'Add Product'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Price"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
            <Input
              label="Stock"
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              required
            />
          </div>
          <Input
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            label="Expiry Date"
            type="date"
            value={form.expiryDate}
            onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setEditing(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setRemovalReason('');
        }}
        title="Remove Product"
        description="Are you sure you want to remove this product?"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Removal Reason (optional)
            </label>
            <select
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {removalOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setRemovalReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleting}
              onClick={handleDelete}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}