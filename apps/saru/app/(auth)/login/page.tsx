'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { toast } from '@/components/toast';
import { AuthForm } from '@/components/auth-form';
import { SubmitButton } from '@/components/submit-button';

// Client-side check for enabled providers
const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';
const githubEnabled = process.env.NEXT_PUBLIC_GITHUB_ENABLED === 'true';

export default function LoginPage() {
  const router = useRouter();
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState<string | null>(null);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [email, setEmail] = useState('');

  const handleEmailLogin = async (formData: FormData) => {
    const currentEmail = formData.get('email') as string;
    const password = formData.get('password') as string;
    setEmail(currentEmail);

    await authClient.signIn.email({
      email: currentEmail,
      password,
      callbackURL: "/documents"
    }, {
      onRequest: () => {
        setIsEmailLoading(true);
        setIsSuccessful(false);
        setIsSocialLoading(null);
      },
      onSuccess: (ctx) => {
        setIsEmailLoading(false);
        setIsSuccessful(true);
        toast({
          type: 'success',
          description: 'Signed in successfully! Redirecting...'
        });
        router.refresh();
      },
      onError: (ctx) => {
        setIsEmailLoading(false);
        setIsSuccessful(false);
        console.error("Email Login Error:", ctx.error);
        toast({
          type: 'error',
          description: ctx.error.message || 'Failed to sign in.',
        });
      },
    });
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    await authClient.signIn.social({
      provider,
      callbackURL: "/documents",
      errorCallbackURL: "/login?error=social_signin_failed",
    }, {
      onRequest: () => {
        setIsSocialLoading(provider);
        setIsSuccessful(false);
        setIsEmailLoading(false);
      },
      onError: (ctx) => {
        setIsSocialLoading(null);
        setIsSuccessful(false);
        console.error(`Social Login Error (${provider}):`, ctx.error);
        toast({
          type: 'error',
          description: ctx.error.message || `Failed to sign in with ${provider}.`,
        });
      },
    });
  };

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
        <div className="flex flex-col items-center justify-center gap-2 px-8 text-center">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Sign In</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Sign in with your email and password
          </p>
        </div>
        
        <div className="px-8">
          <AuthForm 
            action={handleEmailLogin} 
            defaultEmail={email}
            showSocialLogins={true}
            googleEnabled={googleEnabled}
            githubEnabled={githubEnabled}
            onSocialLogin={handleSocialLogin}
            isSocialLoading={isSocialLoading}
            isEmailLoading={isEmailLoading}
          > 
            <SubmitButton 
              isSuccessful={isSuccessful}
            >
              Sign In
            </SubmitButton>
          </AuthForm>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-zinc-400">
          {"Don't have an account? "}
          <Link
            href="/register"
            className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
