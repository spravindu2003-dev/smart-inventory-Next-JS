import { NextResponse } from 'next/server';
import { register } from '@/actions/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await register(body);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}