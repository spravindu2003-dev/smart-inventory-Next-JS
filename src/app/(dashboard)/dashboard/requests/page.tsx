'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getRequests, approveRequest, rejectRequest } from '@/actions/requests';
import { useAuth } from '@/hooks/use-auth';
import { useAuthToken } from '@/hooks/use-auth-token';
import { usePusherChannel } from '@/hooks/use-pusher-channel';
import { formatDateTime } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { toast } from '@/lib/toast';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

interface RequestItem {
  id: number;
  status: string;
  actionType: string;
  targetType: string;
  targetId: number;
  message: string | null;
  createdAt: string;
  requestedBy: { id: number; name: string; email: string };
}

export default function RequestsPage() {
  const { user } = useAuth();
  const token = useAuthToken();
  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const [requests, setRequests] = React.useState<RequestItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processingId, setProcessingId] = React.useState<number | null>(null);

  const fetchRequests = React.useCallback(async () => {
    try {
      const data = await getRequests(token);
      if ('error' in data) {
        toast.error(typeof data.error === 'string' ? data.error : 'An error occurred');
      } else {
        setRequests(data.requests as unknown as RequestItem[]);
      }
    } catch {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handlePusherEvent = React.useCallback(() => {
    fetchRequests();
  }, [fetchRequests]);

  const channelName = user?.businessId ? `business-${user.businessId}` : '';
  usePusherChannel(channelName, 'request-created', handlePusherEvent);
  usePusherChannel(channelName, 'request-approved', handlePusherEvent);
  usePusherChannel(channelName, 'request-rejected', handlePusherEvent);

  async function handleApprove(id: number) {
    setProcessingId(id);
    try {
      const result = await approveRequest(token, id);
      if ('error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'An error occurred');
      } else {
        toast.success('Request approved');
        fetchRequests();
      }
    } catch {
      toast.error('Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id: number) {
    setProcessingId(id);
    try {
      const result = await rejectRequest(token, id);
      if ('error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'An error occurred');
      } else {
        toast.success('Request rejected');
        fetchRequests();
      }
    } catch {
      toast.error('Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Requests</h1>
        <p className="text-gray-500">
          {canManage
            ? 'Review and approve edit requests from cashiers'
            : 'Your submitted edit requests'}
        </p>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No requests"
          description={
            canManage
              ? 'No pending edit requests from cashiers'
              : 'You haven\'t submitted any edit requests'
          }
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={statusColors[request.status] || ''}>
                        {request.status}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">
                        {request.actionType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-gray-500">
                        {request.targetType} #{request.targetId}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      Requested by {request.requestedBy.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(request.createdAt)}
                    </p>
                    {request.message && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        &quot;{request.message}&quot;
                      </p>
                    )}
                  </div>
                  {canManage && request.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                        disabled={processingId === request.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(request.id)}
                        disabled={processingId === request.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
