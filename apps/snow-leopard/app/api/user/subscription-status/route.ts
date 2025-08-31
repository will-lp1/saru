import { NextResponse } from 'next/server';
import { getSession } from '@/app/(auth)/auth';
import { getActiveSubscriptionByUserId, unpublishAllDocumentsByUserId } from '@/lib/db/queries';

export const dynamic = 'force-dynamic'; // Ensure fresh data on each request

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ hasActiveSubscription: false }, { status: 200 });
  }

  const userId = session.user.id;

  if (process.env.STRIPE_ENABLED !== 'true') {
    return NextResponse.json({ hasActiveSubscription: true }, { status: 200 });
  }

  const subscription = await getActiveSubscriptionByUserId({ userId });
  const hasActiveSubscription = subscription?.status === 'active' || subscription?.status === 'trialing';

  // If no active subscription, un-publish any public documents
  if (!hasActiveSubscription) {
    try {
      await unpublishAllDocumentsByUserId({ userId });
    } catch (error) {
      console.error(`[API /user/subscription-status] Failed to unpublish documents for user ${userId}:`, error);
    }
  }

  return NextResponse.json({ hasActiveSubscription }, { status: 200 });
} 