'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getUsers, createUser, updateUser, toggleUserStatus, deleteUser } from '@/actions/users';
import { formatDate } from '@/lib/utils';
import { Plus, Pencil, UserCheck, UserX, Trash2, Search } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuthToken } from '@/hooks/use-auth-token';

export default function UsersPage() {
  const token = useAuthToken();
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<any>(null);
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier' as 'manager' | 'cashier',
  });
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState('');

  async function fetchUsers() {
    try {
      const data = await getUsers(token, { search: search || undefined });
      if ('error' in data) {
        toast.error(data.error || 'An error occurred');
      } else {
        setUsers(data.users);
      }
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'cashier' });
    setModalOpen(true);
  }

  function openEdit(user: any) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      let result;
      if (editing) {
        const { password, ...updateData } = form;
        result = await updateUser(token, editing.id, updateData);
      } else {
        result = await createUser(token, form);
      }

      if ('error' in result) {
        toast.error(result.error || 'An error occurred');
      } else {
        toast.success(editing ? 'User updated' : 'User created');
        setModalOpen(false);
        setEditing(null);
        fetchUsers();
      }
    } catch (error) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user: any) {
    try {
      const result = await toggleUserStatus(token, user.id);
      if ('error' in result) {
        toast.error(result.error || 'An error occurred');
      } else {
        toast.success(result.success);
        fetchUsers();
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  }

  async function handleDelete(user: any) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const result = await deleteUser(token, user.id);
      if ('error' in result) {
        toast.error(result.error || 'An error occurred');
      } else {
        toast.success('User deleted');
        fetchUsers();
      }
    } catch (error) {
      toast.error('Failed to delete user');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500">Manage your team members</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Add your first team member"
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{user.name}</h3>
                        <Badge variant={user.role === 'manager' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                        {!user.isActive && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <p className="text-xs text-gray-400">
                        Joined {formatDate(user.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(user)}
                    >
                      {user.isActive ? (
                        <>
                          <UserX className="h-4 w-4 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(user)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit User' : 'Add User'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          {!editing && (
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as 'manager' | 'cashier' })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setEditing(null);
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
    </div>
  );
}