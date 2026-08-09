import Pusher from 'pusher';

let pusher: Pusher | null = null;

export function getPusher(): Pusher | null {
  if (pusher) return pusher;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) return null;

  pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return pusher;
}

export function getChannelName(businessId: number): string {
  return `business-${businessId}`;
}

export async function triggerRequestEvent(
  businessId: number,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const p = getPusher();
  if (!p) return;
  const channel = getChannelName(businessId);
  await p.trigger(channel, event, data);
}
