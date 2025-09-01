'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LogoGoogle, GitIcon, LoaderIcon } from '@/components/icons';
import type { ReactNode } from 'react';

interface AuthFormProps {
  action: (formData: FormData) => void;
  defaultEmail?: string;
  children: ReactNode;
  showSocialLogins?: boolean;
  googleEnabled?: boolean;
  githubEnabled?: boolean;
  onSocialLogin?: (provider: 'google' | 'github') => void;
  isSocialLoading?: string | null;
  isEmailLoading?: boolean;
}

export function AuthForm({
  action,
  defaultEmail = '',
  children,
  showSocialLogins = false,
  googleEnabled = false,
  githubEnabled = false,
  onSocialLogin = () => {},
  isSocialLoading = null,
  isEmailLoading = false,
}: AuthFormProps) {
  const anySocialEnabled = googleEnabled || githubEnabled;
  const isLoading = !!isSocialLoading || isEmailLoading;

  return (
    <form action={action} className="flex flex-col gap-6 px-4 sm:px-16">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          defaultValue={defaultEmail}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
        />
      </div>
      {children}

      {showSocialLogins && anySocialEnabled && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {googleEnabled && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => onSocialLogin('google')}
                disabled={isLoading}
              >
                {isSocialLoading === 'google' ? (<span className="mr-2 h-4 w-4"><LoaderIcon size={16} /></span>) : (<span className="mr-2 h-4 w-4"><LogoGoogle size={16} /></span>)} Google
              </Button>
            )}
            {githubEnabled && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => onSocialLogin('github')}
                disabled={isLoading}
              >
                {isSocialLoading === 'github' ? (<span className="mr-2 h-4 w-4"><LoaderIcon size={16} /></span>) : (<span className="mr-2 h-4 w-4"><GitIcon /></span>)} GitHub
              </Button>
            )}
          </div>
        </>
      )}
    </form>
  );
}
