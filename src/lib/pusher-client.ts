import PusherClient from 'pusher-js';
import { getStoredTabSession } from '@/lib/tab-session';

let client: PusherClient | null = null;

export function getPusherClient(): PusherClient | null {
  if (client) return client;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) return null;

  client = new PusherClient(key, {
    cluster,
    authEndpoint: '/api/pusher/auth',
    auth: {
      headers: {
        'Authorization': `Bearer ${getStoredTabSession() || ''}`,
      },
    },
  });

  return client;
}
