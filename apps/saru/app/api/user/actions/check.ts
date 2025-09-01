import { NextRequest, NextResponse } from 'next/server';
import { checkUsernameAvailability } from '@/lib/db/queries';

export async function checkUsernameAction(request: NextRequest) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username');
  if (!username) {
    return NextResponse.json({ available: false }, { status: 400 });
  }
  try {
    const available = await checkUsernameAvailability({ username });
    return NextResponse.json({ available });
  } catch (error: any) {
    console.error('[API /user] Check username error:', error);
    return NextResponse.json({ available: false }, { status: 500 });
  }
} 