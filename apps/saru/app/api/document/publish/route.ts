import { NextRequest, NextResponse } from 'next/server';
import { publishDocument } from '../actions/publish';

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch (error: any) {
    console.error('[API /document/publish] Invalid JSON:', error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    return await publishDocument(request, body);
  } catch (error: any) {
    console.error('[API /document/publish] Error handling publish:', error);
    return NextResponse.json({ error: error.message || 'Error publishing document' }, { status: 500 });
  }
} 