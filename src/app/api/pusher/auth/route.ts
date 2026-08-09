import { NextRequest, NextResponse } from 'next/server';
import { getPusher } from '@/lib/pusher';
import { verifyTabSession } from '@/lib/tab-session';

export async function POST(request: NextRequest) {
  try {
    const p = getPusher();
    if (!p) {
      return NextResponse.json({ error: 'Pusher not configured' }, { status: 503 });
    }

    const body = await request.text();
    const params = new URLSearchParams(body);
    const socketId = params.get('socket_id');
    const channel = params.get('channel_name');

    if (!socketId || !channel) {
      return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await verifyTabSession(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expectedChannelPrefix = `business-${session.businessId}`;
    if (!channel.startsWith(expectedChannelPrefix)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const authResponse = p.authorizeChannel(socketId, channel);
    return NextResponse.json(authResponse);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
