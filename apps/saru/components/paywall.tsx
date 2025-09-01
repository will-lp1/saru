'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from '@/components/toast';
import { CheckCircle, X, Loader2, Check, MoreHorizontal } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PaywallProps {
  isOpen: boolean;
  onOpenChange?: (open: boolean) => void;
  required?: boolean;
}

export const displayPlans = [
  {
    displayName: 'Monthly',
    planName: 'saru',
    price: '$15',
    billing: '/ month',
    features: [
      'Publish your documents publicly',
      'AI trained on the way you write',
    ],
    stripePriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'monthly_placeholder',
    annual: false,
  },
  { 
    displayName: 'Annual',
    planName: 'saru',
    price: '$10.50',
    billing: '/ month*',
    subLabel: 'Billed annually at $126',
    features: [
      'Publish your documents publicly',
      'AI trained on the way you write',
    ],
    discount: 30,
    stripePriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'yearly_placeholder',
    annual: true,
  },
];

export function Paywall({ isOpen, onOpenChange, required = false }: PaywallProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const router = useRouter();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut({}, {
        onSuccess: () => {
          setIsSigningOut(false);
          router.push('/login');
          router.refresh();
          toast({ type: 'success', description: 'Signed out successfully.' });
        },
        onError: (ctx) => {
          setIsSigningOut(false);
          console.error('Error signing out:', ctx.error);
          toast({
            type: 'error',
            description: ctx.error.message || 'Failed to sign out.'
          });
        }
      });
    } catch (error) {
      setIsSigningOut(false);
      console.error('Sign out function error:', error);
      toast({ type: 'error', description: 'An unexpected error occurred during sign out.' });
    }
  };

  const handleUpgrade = async (planName: string, annual: boolean = false) => {
    const displayPlan = displayPlans.find(p => 
      p.planName.toLowerCase() === planName.toLowerCase() && 
      p.annual === annual
    );

    setIsLoading(true);
    setLoadingPlanId(displayPlan?.stripePriceId || null);
    console.log(`Initiating subscription upgrade to plan: ${planName}, annual: ${annual}`);

    try {
      const currentUrl = window.location.href;

      const { error } = await authClient.subscription.upgrade({
        plan: planName,
        annual: annual,
        successUrl: currentUrl,
        cancelUrl: currentUrl,
      });

      if (error) {
        console.error('Stripe Checkout Error (via Better Auth):', error);
        toast({ 
          type: 'error', 
          description: error.message || 'Failed to initiate checkout. Please try again.' 
        });
      }
    } catch (err) {
      console.error('Unexpected error during upgrade:', err);
      toast({ 
        type: 'error', 
        description: 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setIsLoading(false);
      setLoadingPlanId(null);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (required && !open) {
      return;
    }
    onOpenChange?.(open);
  };
  
  const handleInteractOutside = (event: Event) => {
    if (required) {
      event.preventDefault();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[425px] md:max-w-2xl lg:max-w-4xl p-0 overflow-hidden"
        onInteractOutside={handleInteractOutside}
        onEscapeKeyDown={(event) => {
          if (required) {
            event.preventDefault();
          }
        }}
        hideCloseButton={required}
      >
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative h-40 md:h-full overflow-hidden">
            <Image
              src="/images/sarus.png"
              alt="Saru"
              fill
              style={{ objectFit: 'cover' }}
              className="filter grayscale contrast-110 brightness-90"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent md:bg-gradient-to-r md:from-black/40 md:via-transparent"></div>
            <div className="absolute top-6 left-6 z-10">
               <h1 className="text-base font-normal text-white/80">
                  Saru
               </h1>
             </div>
          </div>

          <div className="p-6 md:p-8 flex flex-col relative">
            {required && (
              <div className="absolute top-4 right-4 z-20">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={handleSignOut}
                      disabled={isSigningOut}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                    >
                      {isSigningOut ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <div className="flex-grow">
              <DialogHeader className="mb-6 text-left">
                <DialogTitle className="text-xl md:text-2xl font-semibold">Upgrade to Pro</DialogTitle>
                <DialogDescription className="text-sm mb-6">
                  Subscribe to support Saru, unlock AI trained on the way you write, and {' '}
                  <Link href="#" className="text-blue-500 underline">
                    publish your documents
                  </Link>.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {displayPlans.map((plan) => (
                  <div 
                    key={plan.displayName} 
                    className={cn(
                      "border rounded-lg p-6 flex flex-col transition-colors",
                      { 'bg-muted/30': plan.annual }
                    )}
                  >
                    <div className="flex-grow">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-lg">{plan.displayName}</h4>
                        {plan.annual && <div className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Save {plan.discount}%</div>}
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {plan.price}
                        <span className="text-base font-normal text-muted-foreground">{plan.billing}</span>
                      </p>
                      
                      {plan.subLabel && (
                        <p className="text-xs text-muted-foreground mt-1">{plan.subLabel}</p>
                      )}
                      
                      <ul className="mt-6 space-y-2">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="mt-8">
                      <Button 
                        onClick={() => handleUpgrade(plan.planName, plan.annual)}
                        disabled={isLoading}
                        className="w-full"
                        size="lg"
                        variant={plan.annual ? "default" : "outline"}
                      >
                        {isLoading && loadingPlanId === plan.stripePriceId ? (
                          <><Loader2 className="mr-2 size-4 animate-spin" /> Processing...</>
                        ) : 'Subscribe'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="mt-6 pt-4 border-t flex flex-col sm:flex-row items-center gap-2 sm:gap-0">
              <p className="text-xs text-muted-foreground flex-shrink-0">
                  much love, will - founder of Saru
              </p>
              <div className="flex-grow" />
              <Button
                variant="ghost"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5" // Style from overview.tsx
                asChild
              >
                <Link href="https://discord.gg/X49bQmnYbd" target="_blank" rel="noopener noreferrer">
                  <Image src="/images/discord-logo.png" alt="Discord" width={16} height={16} />
                  Join the Discord
                </Link>
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}