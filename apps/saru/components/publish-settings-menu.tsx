"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2, GlobeIcon, CopyIcon, Edit2, Check } from 'lucide-react';
import type { Document } from '@saru/db';
import type { User } from '@/lib/auth';
import useSWR from 'swr';
import debounce from 'lodash.debounce';
import { toast } from 'sonner';
import { fetcher } from '@/lib/utils';
import useSWRMutation from 'swr/mutation';
import { Paywall } from '@/components/paywall';
import { googleFonts, FontOption } from '@/lib/fonts';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { HuePicker } from 'react-color';

interface PublishSettingsMenuProps {
  document: Document;
  user: User;
  onUpdate: (updatedDoc: Document) => void;
}

// Utility to convert hex to HSL components
function hexToHSL(H: string) {
  // Remove '#'
  let r = 0, g = 0, b = 0;
  if (H.length === 7) {
    r = parseInt(H.slice(1, 3), 16) / 255;
    g = parseInt(H.slice(3, 5), 16) / 255;
    b = parseInt(H.slice(5, 7), 16) / 255;
  }
  const cMin = Math.min(r, g, b);
  const cMax = Math.max(r, g, b);
  const delta = cMax - cMin;
  let h = 0;
  if (delta !== 0) {
    if (cMax === r) {
      h = ((g - b) / delta) % 6;
    } else if (cMax === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const l = (cMax + cMin) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function PublishSettingsMenu({ document, user, onUpdate }: PublishSettingsMenuProps) {
  const { data: subscriptionData, isLoading: isSubscriptionLoading } = useSWR<{ hasActiveSubscription: boolean }>('/api/user/subscription-status', fetcher, { revalidateOnFocus: false });
  const hasSubscription = subscriptionData?.hasActiveSubscription ?? false;
  const [isPaywallOpen, setPaywallOpen] = useState(false);

  const [username, setUsername] = useState<string>(user.username || '');
  const [hasUsername, setHasUsername] = useState<boolean>(!!user.username);
  const [usernameLoading, setUsernameLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<{ checking: boolean; available: boolean | null }>({ checking: false, available: null });
  const [slug, setSlug] = useState('');
  const [font, setFont] = useState<FontOption>('montserrat');
  const [textColor, setTextColor] = useState<string | undefined>(undefined);
  const sanitizedUsername = username.trim().replace(/^@/, '');
  
  const isPublished = document.visibility === 'public';
  const url = typeof window !== 'undefined' ? `${window.location.origin}/${sanitizedUsername}/${slug}` : `/${sanitizedUsername}/${slug}`;

  useEffect(() => {
    setUsername(user.username || '');
    setHasUsername(!!user.username);
  }, [user.username]);
  
  useEffect(() => {
    setSlug(
      document.slug ||
        document.title
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
    );
    const styleObj = (document.style as any) || {};
    setFont(styleObj.font || 'montserrat');
    setTextColor(styleObj.textColor);
  }, [document.slug, document.title, document.style]);

  const loadUsername = useCallback(async () => {
    if (user.username) {
      setUsernameLoading(false);
      return;
    }
    setUsernameLoading(true);
    try {
      const res = await fetch('/api/user', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.username) {
        setUsername(data.username);
        setHasUsername(true);
        setUsernameCheck({ checking: false, available: true });
      }
    } catch (err) {
      console.error('[PublishSettingsMenu] Failed to load username:', err);
    } finally {
      setUsernameLoading(false);
    }
  }, [user.username]);

  useEffect(() => {
    loadUsername();
  }, [loadUsername]);

  const checkUsername = useCallback(async (name: string, signal: AbortSignal) => {
    if (!name.trim()) return;
    setUsernameCheck({ checking: true, available: null });
    try {
      const res = await fetch(`/api/user?username=${encodeURIComponent(name.trim().replace(/^@/, ''))}`, { signal });
      if (res.ok) {
        const { available } = await res.json();
        setUsernameCheck({ checking: false, available });
      } else {
        setUsernameCheck({ checking: false, available: false });
      }
    } catch (err) {
      if ((err as any).name !== 'AbortError') {
        setUsernameCheck({ checking: false, available: false });
      }
    }
  }, []);

  const debouncedCheck = useCallback(debounce((name: string, controller: AbortController) => {
    checkUsername(name, controller.signal);
  }, 300), [checkUsername]);

  useEffect(() => {
     if (!sanitizedUsername || sanitizedUsername === user.username) {
         setUsernameCheck({ checking: false, available: null });
         return;
     }

    const controller = new AbortController();
    debouncedCheck(username, controller);

    return () => {
      controller.abort();
      debouncedCheck.cancel();
    };
  }, [username, user.username, sanitizedUsername, debouncedCheck]);
  
  const claimUsername = useCallback(async () => {
    if (!usernameCheck.available) return;
    setClaiming(true);
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim().replace(/^@/, '') }),
    });
    if (res.ok) {
      setHasUsername(true);
      setUsernameCheck({ checking: false, available: true });
    } else {
    }
    setClaiming(false);
  }, [username, usernameCheck.available]);

  const disabled = !hasSubscription;

  type PublishPayload = {
    id: string;
    visibility: 'public' | 'private';
    author: string;
    style: any;
    slug: string;
  };
   
  const { trigger: publishTrigger, isMutating: isPublishing } = useSWRMutation(
    '/api/document/publish',
    async (url: string, { arg }: { arg: PublishPayload }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update publication');
      }
      return res.json();
    }
  );

  const handleToggle = useCallback(() => {
    toast.dismiss();
    const newVisibility = (document.visibility === 'public' ? 'private' : 'public') as 'public' | 'private';
    if (newVisibility === 'public' && !sanitizedUsername) return;
    const styleObj = document.style as any;
    const { h, s } = textColor !== undefined ? hexToHSL(textColor) : { h: 0, s: 0 };
    const snapshot = {
      id: document.id,
      visibility: newVisibility,
      author: sanitizedUsername,
      style: { ...styleObj, font, textColorLight: textColor !== undefined ? `hsl(${h}, ${s}%, 90%)` : undefined, textColorDark: textColor !== undefined ? `hsl(${h}, ${s}%, 20%)` : undefined },
      slug,
    };
    publishTrigger(snapshot as any)
      .then((updated: Document) => onUpdate(updated))
      .catch((e: Error) => {
        onUpdate(document);
        toast.error(e.message);
      });
  }, [document, sanitizedUsername, slug, onUpdate, font, textColor, publishTrigger]);
  
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    toast.dismiss();
    const formattedSlug = e.target.value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setSlug(formattedSlug);
  };

  const handleColorModeChange = (mode: string) => {
    if (mode === 'default' || !mode) {
      setTextColor(undefined);
    } else if (mode === 'custom') {
      if (textColor === undefined) {
        setTextColor('#0f172a');
      }
    }
  };

  if (isSubscriptionLoading) return null;
  return (
    <DropdownMenu onOpenChange={(open) => { if (open) { loadUsername(); } }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-8 w-8 p-0 flex items-center justify-center transition-colors',
            isPublished ? 'text-blue-500' : 'text-muted-foreground'
          )}
        >
          <GlobeIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="group w-64 p-3 shadow-lg rounded-lg border bg-popover space-y-3 relative"
        align="end"
        sideOffset={6}
      >
        {/* Hover overlay for unsubscribed users */}
        {disabled && (
          <div className="absolute inset-0 z-10 bg-background/70 backdrop-blur-sm rounded-lg flex items-center justify-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
            <Button
              size="sm"
              variant="outline"
              className="pointer-events-auto"
              onClick={() => setPaywallOpen(true)}
            >
              Upgrade
            </Button>
          </div>
        )}
        <div>
          <Label className="text-sm font-medium">Publish Settings</Label>
        </div>
        {!isPublished ? (
          <> {/* Publish state */}
            <div className="space-y-2">
              <Label htmlFor="pub-username" className="text-xs font-medium block">Username</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="pub-username"
                  value={hasUsername ? `@${username}` : username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (usernameCheck.available !== null) {
                      setUsernameCheck({ checking: false, available: null });
                    }
                    if (hasUsername) {
                      setHasUsername(false);
                    }
                  }}
                  disabled={usernameLoading || claiming || hasUsername || isPublishing || disabled}
                  className={cn(
                    "flex-1 h-8",
                    hasUsername
                      ? "opacity-50 bg-transparent border border-input text-muted-foreground"
                      : usernameCheck.available === false
                        ? "border-destructive text-destructive focus-visible:ring-destructive"
                        : usernameCheck.available === true
                          ? "border-green-500 text-green-500 focus-visible:ring-green-500"
                          : ""
                  )}
                  placeholder={usernameLoading ? 'Loading username...' : 'Choose a username'}
                />
                {usernameLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                {usernameCheck.checking && !hasUsername && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                {!hasUsername && !usernameCheck.checking && usernameCheck.available && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={claimUsername}
                    disabled={claiming}
                  >
                    {claiming ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  </Button>
                )}
                {hasUsername && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => {
                      setHasUsername(false);
                      setUsernameCheck({ checking: false, available: null });
                    }}
                    disabled={disabled}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="pub-title" className="text-xs font-medium block">
                Slug
              </Label>
              <Input
                id="pub-title"
                value={slug}
                onChange={handleSlugChange}
                className="h-8"
                disabled={isPublishing || disabled}
                placeholder="Page slug"
              />
            </div>
            
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium block">Text Color</Label>
                <ToggleGroup
                  type="single"
                  value={textColor === undefined ? 'default' : 'custom'}
                  onValueChange={handleColorModeChange}
                  className="grid grid-cols-2"
                  disabled={isPublishing || disabled}
                >
                  <ToggleGroupItem value="default" className="text-xs h-8">Default</ToggleGroupItem>
                  <ToggleGroupItem value="custom" className="text-xs h-8">Custom</ToggleGroupItem>
                </ToggleGroup>
                {textColor !== undefined && (
                  <>
                    <div className="pt-2">
                      <HuePicker
                        color={textColor}
                        onChange={(c) => setTextColor(c.hex)}
                        width="100%"
                      />
                    </div>
                    {(() => {
                      const { h, s } = hexToHSL(textColor);
                      const light = `hsl(${h}, ${s}%, 90%)`;
                      const dark = `hsl(${h}, ${s}%, 20%)`;
                      return (
                        <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                          <div className="flex flex-col items-center">
                            <div className="h-6 w-full rounded" style={{ backgroundColor: light }} />
                            <span className="mt-1">Light</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-6 w-full rounded" style={{ backgroundColor: dark }} />
                            <span className="mt-1">Dark</span>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium block">Font</Label>
                <Select
                  value={font}
                  onValueChange={(val) => setFont(val as FontOption)}
                  disabled={isPublishing || disabled}
                >
                  <SelectTrigger className={cn('h-8 w-full text-xs', googleFonts[font].className)}>
                    <SelectValue placeholder="Font" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {(Object.keys(googleFonts) as FontOption[]).map((key) => (
                      <SelectItem key={key} value={key} className={cn('capitalize', googleFonts[key].className)}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end px-3 pt-4 pb-2 border-t bg-background/50 -mx-3 -mb-3 mt-4">
              <Button
                size="sm"
                variant="default"
                className="w-full"
                onClick={() => {
                  if (disabled) {
                    setPaywallOpen(true);
                    return;
                  }
                  handleToggle();
                }}
                disabled={isPublishing || !hasUsername || disabled || !sanitizedUsername}
              >
                {isPublishing ? <Loader2 className="size-4 animate-spin mx-auto" /> : 'Publish'}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {/* Copy and View always visible */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => navigator.clipboard.writeText(url)}
              disabled={disabled}
            >
              <CopyIcon className="size-4" /> Copy Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.open(url, '_blank')}
              disabled={disabled}
            >
              <GlobeIcon className="size-4" /> View
            </Button>
            <Button
              size="sm"
              variant="default"
              className="w-full"
              onClick={() => handleToggle()}
              disabled={isPublishing || disabled}
            >
              {isPublishing ? <Loader2 className="size-4 animate-spin mx-auto" /> : 'Unpublish'}
            </Button>
          </div>
        )}
      </DropdownMenuContent>
      <Paywall isOpen={isPaywallOpen} onOpenChange={setPaywallOpen} required={false} />
    </DropdownMenu>
  );
} 