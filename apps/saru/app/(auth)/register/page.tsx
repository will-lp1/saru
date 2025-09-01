'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { toast } from '@/components/toast';
import { AuthForm } from '@/components/auth-form';
import { SubmitButton } from '@/components/submit-button';

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';
const githubEnabled = process.env.NEXT_PUBLIC_GITHUB_ENABLED === 'true';
const emailVerificationEnabled = process.env.NEXT_PUBLIC_EMAIL_VERIFY_ENABLED === 'true';

export default function RegisterPage() {
  const router = useRouter();
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState<string | null>(null);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [email, setEmail] = useState('');

  const handleEmailSignup = async (formData: FormData) => {
    const emailValue = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = emailValue.split('@')[0] || 'User';
    setEmail(emailValue);
    setIsEmailLoading(true);
    setIsSuccessful(false);
    setIsSocialLoading(null);

    await authClient.signUp.email({
      email: emailValue,
      password,
      name,
    }, {
      onRequest: () => {
      },
      onSuccess: (ctx) => {
        setIsEmailLoading(false);
        if (emailVerificationEnabled) {
          setIsSuccessful(false);
          toast({
            type: 'success',
            description: 'Account created! Check your email to verify.'
          });
          router.push('/login');
        } else {
          setIsSuccessful(true);
          toast({
            type: 'success',
            description: 'Account created! Redirecting...'
          });
          router.push('/documents'); 
        }
      },
      onError: (ctx) => {
        setIsEmailLoading(false);
        setIsSuccessful(false);
        console.error("Email Signup Error:", ctx.error);
        toast({
          type: 'error',
          description: ctx.error.message || 'Failed to create account.',
        });
      },
    });
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    await authClient.signIn.social({
      provider,
      callbackURL: "/documents", 
      errorCallbackURL: "/register?error=social_signin_failed",
    }, {
      onRequest: () => {
        setIsSocialLoading(provider);
        setIsSuccessful(false);
        setIsEmailLoading(false);
      },
      onError: (ctx) => {
        setIsSocialLoading(null);
        setIsSuccessful(false);
        console.error(`Social Sign Up/In Error (${provider}):`, ctx.error);
        toast({
          type: 'error',
          description: ctx.error.message || `Failed to sign up/in with ${provider}.`,
        });
      },
    });
  };

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
        <div className="flex flex-col items-center justify-center gap-2 px-8 text-center">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Sign Up</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Create your account with email and password
          </p>
        </div>

        <div className="px-8 flex flex-col gap-6">
          <AuthForm 
            action={handleEmailSignup} 
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
              Sign Up
            </SubmitButton>
          </AuthForm>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            {'Already have an account? '}
            <Link
              href="/login"
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
            >
              Sign in
            </Link>
            {' instead.'}
          </p>
        </div>
      </div>
    </div>
  );
}
