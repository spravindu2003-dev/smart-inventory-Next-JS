'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getActivities } from '@/actions/activities';
import { useAuthToken } from '@/hooks/use-auth-token';
import { formatDateTime } from '@/lib/utils';
import { Search, Filter } from 'lucide-react';

const actionColors: Record<string, string> = {
  LOGIN_SUCCESS: 'bg-green-100 text-green-800',
  CREATE_PRODUCT: 'bg-blue-100 text-blue-800',
  UPDATE_PRODUCT: 'bg-yellow-100 text-yellow-800',
  DELETE_PRODUCT: 'bg-red-100 text-red-800',
  REMOVE_PRODUCT: 'bg-orange-100 text-orange-800',
  CREATE_SALE: 'bg-green-100 text-green-800',
  UPDATE_SALE: 'bg-yellow-100 text-yellow-800',
  UNDO_SALE: 'bg-red-100 text-red-800',
  CREATE_USER: 'bg-purple-100 text-purple-800',
  UPDATE_USER: 'bg-indigo-100 text-indigo-800',
  DELETE_USER: 'bg-red-100 text-red-800',
  APPROVE_REQUEST: 'bg-green-100 text-green-800',
  REJECT_REQUEST: 'bg-red-100 text-red-800',
};

export default function ActivitiesPage() {
  const token = useAuthToken();
  const [activities, setActivities] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);

  async function fetchActivities() {
    try {
      const data = await getActivities(token, {
        page,
        limit: 20,
        search: search || undefined,
        action: actionFilter || undefined,
      });

      if ('error' in data) {
        console.error(data.error);
      } else {
        setActivities(data.activities);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    setLoading(true);
    fetchActivities();
  }, [page, actionFilter]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setLoading(true);
    fetchActivities();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-gray-500">Track all system activities</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <div className="flex gap-2">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Actions</option>
            <option value="LOGIN_SUCCESS">Login</option>
            <option value="CREATE_PRODUCT">Create Product</option>
            <option value="UPDATE_PRODUCT">Update Product</option>
            <option value="DELETE_PRODUCT">Delete Product</option>
            <option value="CREATE_SALE">Create Sale</option>
            <option value="UPDATE_SALE">Update Sale</option>
            <option value="CREATE_USER">Create User</option>
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {activities.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No activities found</p>
          ) : (
            <div className="divide-y">
              {activities.map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {activity.user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500">
                          by {activity.user.name} • {formatDateTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={actionColors[activity.action] || 'bg-gray-100 text-gray-800'}
                    >
                      {activity.action.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}