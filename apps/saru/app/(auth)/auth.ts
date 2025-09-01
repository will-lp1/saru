import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import type { Session, User } from '@/lib/auth'; 

import { db } from '@saru/db'; 
import * as schema from '@saru/db'; 
import { eq } from 'drizzle-orm';

export async function getSession(): Promise<Session | null> {
  try {
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders }); 
    return session;
  } catch (error) {
    console.error('[Auth Helper] Error getting session:', error);
    return null;
  }
}

export async function getUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  return await getUser();
}

export async function getUserDetails(): Promise<typeof schema.user.$inferSelect | null> {
  const user = await getUser();
  if (!user?.id) return null;

  try {
    const userDetails = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, user.id))
      .limit(1);

    if (!userDetails || userDetails.length === 0) {
      console.warn(`[Auth Helper] No details found in DB for user ID: ${user.id}`);
      return null;
    }

    return userDetails[0];
  } catch (error) {
    console.error('[Auth Helper] Error getting user details:', error);
    return null;
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getUser();
  if (!user) {
    throw new Error('Authentication required. User not found in session.');
  }
  return user;
}

/**
 * Utility function to ensure a user is *not* authenticated.
 * Throws an error if a user *is* found in the session.
 */
export async function requireUnauth(): Promise<void> {
  const user = await getUser();
  if (user) {
    throw new Error('User is already authenticated.');
  }
}