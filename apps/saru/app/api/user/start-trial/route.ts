import { NextResponse } from 'next/server';
import { getSession } from '@/app/(auth)/auth';
import { db } from '@saru/db';
import * as schema from '@saru/db';
import { randomUUID } from 'crypto';
import { eq, inArray, desc, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  const existing = await db
    .select()
    .from(schema.subscription)
    .where(
      and(
        eq(schema.subscription.referenceId, userId),
        inArray(schema.subscription.status, ['active', 'trialing'])
      )
    )
    .orderBy(desc(schema.subscription.createdAt))
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    // If already active subscription
    if (current.status === 'active') {
      return NextResponse.json({ alreadyActive: true });
    }
    // If already in trial and not expired
    if (
      current.status === 'trialing' &&
      current.trialEnd &&
      new Date(current.trialEnd) > now
    ) {
      return NextResponse.json({ alreadyInTrial: true });
    }
  }

  // Create new trial record
  const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  await db.insert(schema.subscription).values({
    id: randomUUID(),
    plan: 'saru',
    referenceId: userId,
    status: 'trialing',
    trialStart: now,
    trialEnd,
  });

  return NextResponse.json({ trialEnd });
} 