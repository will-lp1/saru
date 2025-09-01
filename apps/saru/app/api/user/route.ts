import { NextRequest, NextResponse } from 'next/server';
import { getUserAction } from './actions/get';
import { checkUsernameAction } from './actions/check';
import { updateUsernameAction } from './actions/update';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  if (url.searchParams.has('username')) {
    return checkUsernameAction(request);
  }
  return getUserAction(request);
}

export async function POST(request: NextRequest) {
  return updateUsernameAction(request);
} 