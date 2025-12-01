import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addToWaitlist, getWaitlistCount, checkEmailInWaitlist } from '@/lib/db/queries';

const joinWaitlistSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = joinWaitlistSchema.parse(body);

    // Check if email already exists
    const alreadyExists = await checkEmailInWaitlist({ email });
    if (alreadyExists) {
      return NextResponse.json(
        { error: 'Email already on waitlist' },
        { status: 400 }
      );
    }

    await addToWaitlist({ email });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }
    console.error('[Waitlist API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const count = await getWaitlistCount();
    return NextResponse.json({ count });
  } catch (error) {
    console.error('[Waitlist API] Error getting count:', error);
    return NextResponse.json(
      { error: 'Failed to get waitlist count', count: 0 },
      { status: 500 }
    );
  }
}

