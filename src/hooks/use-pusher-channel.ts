'use client';

import * as React from 'react';
import { getPusherClient } from '@/lib/pusher-client';
import { useTabSession } from '@/components/tab-session-provider';

export function usePusherChannel(
  channelName: string,
  eventName: string,
  callback: (data: unknown) => void
) {
  const { isAuthenticated } = useTabSession();

  React.useEffect(() => {
    if (!isAuthenticated || !channelName) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(channelName);
    channel.bind(eventName, callback);

    return () => {
      channel.unbind(eventName, callback);
      pusher.unsubscribe(channelName);
    };
  }, [channelName, eventName, callback, isAuthenticated]);
}
