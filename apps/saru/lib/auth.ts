
import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from 'better-auth/next-js';
import { db, user as schemaUser } from '@saru/db'; 
import * as schema from '@saru/db'; 
import Stripe from "stripe"; 
import { stripe } from "@better-auth/stripe"; 
import { Resend } from 'resend'; 

const googleEnabled = process.env.GOOGLE_ENABLED === 'true';
const githubEnabled = process.env.GITHUB_ENABLED === 'true';

const stripeEnabled = process.env.STRIPE_ENABLED === 'true' || process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true';

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('Missing BETTER_AUTH_SECRET environment variable');
}
if (!process.env.BETTER_AUTH_URL) {
    throw new Error('Missing BETTER_AUTH_URL environment variable');
}

if (stripeEnabled) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is missing but Stripe is enabled.");
  }
  if (!process.env.STRIPE_PRO_MONTHLY_PRICE_ID) {
    throw new Error("STRIPE_PRO_MONTHLY_PRICE_ID is missing but Stripe is enabled.");
  }
  if (!process.env.STRIPE_PRO_YEARLY_PRICE_ID) {
    throw new Error("STRIPE_PRO_YEARLY_PRICE_ID is missing but Stripe is enabled.");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is missing but Stripe is enabled.");
  }
}

const emailVerificationEnabled = process.env.EMAIL_VERIFY_ENABLED === 'true';
console.log(`Email Verification Enabled: ${emailVerificationEnabled}`);

if (emailVerificationEnabled) {
  if (!process.env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY because EMAIL_VERIFY_ENABLED is true');
  if (!process.env.EMAIL_FROM) throw new Error('Missing EMAIL_FROM because EMAIL_VERIFY_ENABLED is true');
}

if (googleEnabled) {
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error('Missing GOOGLE_CLIENT_ID because GOOGLE_ENABLED is true');
  if (!process.env.GOOGLE_CLIENT_SECRET) throw new Error('Missing GOOGLE_CLIENT_SECRET because GOOGLE_ENABLED is true');
  console.log('Google OAuth ENABLED');
}

if (githubEnabled) {
  if (!process.env.GITHUB_CLIENT_ID) throw new Error('Missing GITHUB_CLIENT_ID because GITHUB_ENABLED is true');
  if (!process.env.GITHUB_CLIENT_SECRET) throw new Error('Missing GITHUB_CLIENT_SECRET because GITHUB_ENABLED is true');
  console.log('GitHub OAuth ENABLED');
}

console.log('--- Checking env vars in lib/auth.ts ---');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'MISSING!');
console.log('BETTER_AUTH_SECRET:', process.env.BETTER_AUTH_SECRET ? 'Set' : 'MISSING!');
console.log('BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL ? 'Set' : 'MISSING!');
console.log('-----------------------------------------\n'); // Added newline for clarity

let stripeClient: Stripe | undefined;
if (stripeEnabled) {
  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-02-24.acacia" });
}

const resend = emailVerificationEnabled && process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

type HookUser = {
  id: string;
  email?: string | null;
};

const authPlugins: any[] = [];

if (stripeEnabled) {
  const plans = [
    {
      name: "saru",
      priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
      annualDiscountPriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
    },
  ];

  authPlugins.push(
    stripe({
      stripeClient: stripeClient!,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: stripeEnabled,
        plans,
        requireEmailVerification: emailVerificationEnabled,
      },
    })
  );
}

authPlugins.push(nextCookies());

const socialProviders: Record<string, any> = {}; 

if (googleEnabled) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  };
}

if (githubEnabled) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  };
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { 
    provider: 'pg',
  }),

  socialProviders,

  emailAndPassword: {    
      enabled: true,
      requireEmailVerification: emailVerificationEnabled, 
  },

  emailVerification: {
    sendOnSignUp: emailVerificationEnabled,
    sendVerificationEmail: emailVerificationEnabled && resend ? async ({ user, url, token }: { user: HookUser, url: string, token: string }, request?: Request) => {
       if (!user.email) {
            console.error('Missing user email in sendVerificationEmail hook');
            return;
        }
        console.log(`Attempting to send verification email to ${user.email} via Resend...`);
        console.log(`Verification URL: ${url}`);
        try {
          const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM!, 
            to: [user.email],
            subject: 'Verify your email for Saru',
            html: `<p>Welcome! Please click the link below to verify your email address:</p><p><a href="${url}">Verify Email</a></p><p>If the link doesn't work, copy and paste this URL into your browser: ${url}</p>`,
          });

          if (error) {
            console.error('Resend error:', error);
            throw new Error(`Failed to send verification email: ${error.message}`);
          }

          console.log(`Verification email sent successfully to ${user.email}. ID: ${data?.id}`);
        } catch (err) {
          console.error('Failed to send verification email:', err);
        }
    } : undefined,
  },

  plugins: authPlugins,
  
  trustedOrigins: [
    "https://www.cursorforwrit.ing",
    "https://www.trysaru.com",
    "https://trysaru.com",
    ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ],
  
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
