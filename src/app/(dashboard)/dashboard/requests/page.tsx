'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { getRequests, approveRequest, rejectRequest } from '@/actions/requests';
import { useAuth } from '@/hooks/use-auth';
import { useAuthToken } from '@/hooks/use-auth-token';
import { usePusherChannel } from '@/hooks/use-pusher-channel';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Check, X, Clock, User, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from '@/lib/toast';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  PENDING: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock className="h-3.5 w-3.5" />, label: 'Pending' },
  APPROVED: { color: 'bg-green-100 text-green-800 border-green-200', icon: <Check className="h-3.5 w-3.5" />, label: 'Approved' },
  REJECTED: { color: 'bg-red-100 text-red-800 border-red-200', icon: <X className="h-3.5 w-3.5" />, label: 'Rejected' },
};

const fieldLabels: Record<string, string> = {
  name: 'Product Name', sku: 'SKU', price: 'Selling Price', stock: 'Stock',
  category: 'Category', description: 'Description', expiryDate: 'Expiry Date',
};

interface RequestItem {
  id: number;
  status: string;
  actionType: string;
  targetType: string;
  targetId: number;
  payload: Record<string, unknown>;
  message: string | null;
  rejectionReason: string | null;
  productSnapshot: Record<string, unknown> | null;
  reviewedAt: string | null;
  createdAt: string;
  requestedBy: { id: number; name: string; email: string; role?: string };
  reviewedBy: { id: number; name: string; email: string } | null;
  product: { id: number; name: string; price: number; stock: number; sku: string; category?: string } | null;
}

export default function RequestsPage() {
  const { user } = useAuth();
  const token = useAuthToken();
  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const [requests, setRequests] = React.useState<RequestItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processingId, setProcessingId] = React.useState<number | null>(null);
  const [confirmApprove, setConfirmApprove] = React.useState<RequestItem | null>(null);
  const [rejectModal, setRejectModal] = React.useState<RequestItem | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set());

  const fetchRequests = React.useCallback(async () => {
    try {
      const data = await getRequests(token, filter !== 'all' ? { status: filter } : undefined);
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
  }, [token, filter]);

  React.useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleRealtime = React.useCallback(() => { fetchRequests(); }, [fetchRequests]);
  const channelName = user?.businessId ? `business-${user.businessId}` : '';
  usePusherChannel(channelName, 'request-created', handleRealtime);
  usePusherChannel(channelName, 'request-approved', handleRealtime);
  usePusherChannel(channelName, 'request-rejected', handleRealtime);

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApprove(id: number) {
    setProcessingId(id);
    setConfirmApprove(null);
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

  async function handleReject() {
    if (!rejectModal || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setProcessingId(rejectModal.id);
    try {
      const result = await rejectRequest(token, rejectModal.id, rejectReason.trim());
      if ('error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'An error occurred');
      } else {
        toast.success('Request rejected');
        setRejectModal(null);
        setRejectReason('');
        fetchRequests();
      }
    } catch {
      toast.error('Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  }

  function getChangedFields(req: RequestItem): { key: string; label: string; current: unknown; proposed: unknown }[] {
    if (!req.payload || Object.keys(req.payload).length === 0) return [];
    const snapshot = req.productSnapshot;
    return Object.entries(req.payload)
      .filter(([key]) => key !== 'remove')
      .map(([key, proposedVal]) => ({
        key,
        label: fieldLabels[key] || key,
        current: snapshot?.[key] ?? null,
        proposed: proposedVal,
      }));
  }

  function formatValue(key: string, value: unknown, currency?: string): string {
    if (value === null || value === undefined) return '-';
    if (key === 'price') return formatCurrency(Number(value), currency);
    if (key === 'expiryDate') return new Date(value as string).toLocaleDateString();
    return String(value);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {canManage ? 'Product Change Requests' : 'My Requests'}
        </h1>
        <p className="text-gray-500 text-sm">
          {canManage
            ? 'Review and approve change requests from cashiers'
            : 'Track your submitted change requests'}
        </p>
      </div>

      <div className="flex gap-2">
        {['all', 'PENDING', 'APPROVED', 'REJECTED'].map((f) => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No requests"
          description={canManage ? 'No change requests from cashiers' : "You haven't submitted any change requests"}
        />
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const st = statusConfig[req.status] || statusConfig.PENDING;
            const isExpanded = expandedIds.has(req.id);
            const changedFields = getChangedFields(req);

            return (
              <div key={req.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                {/* Compact Collapsed Row */}
                <button
                  onClick={() => toggleExpand(req.id)}
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="shrink-0 text-gray-400">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>

                  <Badge className={`${st.color} border shrink-0 text-xs`}>
                    {st.icon}
                    <span className="ml-1 hidden sm:inline">{st.label}</span>
                  </Badge>

                  <span className="text-xs sm:text-sm font-medium text-gray-500 shrink-0">
                    {req.actionType.replace(/_/g, ' ')}
                  </span>

                  <span className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">
                    {req.product?.name || `Product #${req.targetId}`}
                  </span>

                  <span className="hidden md:flex items-center gap-1 text-xs text-gray-400 shrink-0">
                    <User className="h-3 w-3" />
                    {req.requestedBy.name}
                  </span>

                  <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400 shrink-0">
                    <Calendar className="h-3 w-3" />
                    {formatDateTime(req.createdAt)}
                  </span>

                  {canManage && req.status === 'PENDING' && !isExpanded && (
                    <div className="flex gap-1 shrink-0 ml-1">
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                        <X className="h-3 w-3" />
                      </span>
                    </div>
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-3 sm:px-4 py-3 sm:py-4 space-y-3 bg-gray-50/50">
                    {/* Request Info Row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {req.requestedBy.name}
                        {req.requestedBy.role && <span className="text-gray-400 capitalize">({req.requestedBy.role})</span>}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(req.createdAt)}
                      </span>
                    </div>

                    {/* Reason (cashier's message) */}
                    {req.message && (
                      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                        <p className="text-xs font-medium text-blue-700 mb-0.5">Reason:</p>
                        <p className="text-sm text-blue-800 italic">&quot;{req.message}&quot;</p>
                      </div>
                    )}

                    {/* Changed Fields - Only show changed fields */}
                    {req.actionType === 'UPDATE_PRODUCT' && changedFields.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Requested Changes</p>
                        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Field</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Current Value</th>
                                <th className="text-center px-2 py-2 text-gray-400 text-xs"></th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Requested Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {changedFields.map((field) => (
                                <tr key={field.key} className="border-t border-gray-100">
                                  <td className="px-3 py-2 font-medium text-gray-700">{field.label}</td>
                                  <td className="px-3 py-2 text-gray-500">{formatValue(field.key, field.current, user?.currency)}</td>
                                  <td className="px-2 py-2 text-center text-gray-400">&rarr;</td>
                                  <td className="px-3 py-2 font-semibold text-green-700">{formatValue(field.key, field.proposed, user?.currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Remove Product Request */}
                    {req.actionType === 'REMOVE_PRODUCT' && (
                      <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-100">
                        <p className="text-sm text-orange-800">
                          Requesting removal of <strong>{req.product?.name}</strong>
                          {typeof req.payload.reason === 'string' && req.payload.reason && ` — Reason: ${req.payload.reason}`}
                        </p>
                      </div>
                    )}

                    {/* Rejection Reason */}
                    {req.status === 'REJECTED' && req.rejectionReason && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-100">
                        <p className="text-xs font-medium text-red-700 mb-0.5">Rejection Reason:</p>
                        <p className="text-sm text-red-800">{req.rejectionReason}</p>
                      </div>
                    )}

                    {/* Approval Info */}
                    {req.status === 'APPROVED' && req.reviewedBy && (
                      <p className="text-xs text-green-700">
                        Approved by {req.reviewedBy.name}
                        {req.reviewedAt && ` on ${formatDateTime(req.reviewedAt)}`}
                      </p>
                    )}

                    {/* Approve / Reject Buttons (Admin/Manager only) */}
                    {canManage && req.status === 'PENDING' && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => setConfirmApprove(req)}
                          disabled={processingId === req.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRejectModal(req); setRejectReason(''); }}
                          disabled={processingId === req.id}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Approve Confirmation Modal */}
      <Modal open={!!confirmApprove} onClose={() => setConfirmApprove(null)} title="Approve Request">
        {confirmApprove && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Are you sure you want to approve this request?</p>
            {confirmApprove.product && (
              <p className="text-sm">Product: <strong>{confirmApprove.product.name}</strong></p>
            )}
            {confirmApprove.actionType === 'UPDATE_PRODUCT' && (
              <div className="text-sm text-gray-600">
                Changes: {getChangedFields(confirmApprove).map((f) => `${f.label}: ${formatValue(f.key, f.current, user?.currency)} → ${formatValue(f.key, f.proposed, user?.currency)}`).join(', ')}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmApprove(null)}>Cancel</Button>
              <Button onClick={() => handleApprove(confirmApprove.id)} loading={processingId === confirmApprove.id} className="bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4 mr-1" /> Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Request">
        {rejectModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Please provide a reason for rejecting this request.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[100px]"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} loading={processingId === rejectModal.id} disabled={!rejectReason.trim()}>
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
