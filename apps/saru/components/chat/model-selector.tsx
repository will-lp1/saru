'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { CheckIcon } from '../icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { chatModels } from '@/lib/ai/models';
import { cn } from '@/lib/utils';

import { CheckCircleFillIcon, ChevronDownIcon } from '../icons';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Paywall } from '@/components/paywall';

export function ModelSelector({
  selectedModelId,
  className,
  minimal = false,
  onModelChange,
}: {
  selectedModelId: string;
  className?: string;
  minimal?: boolean;
  onModelChange: (newModelId: string) => void;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [isPaywallOpen, setPaywallOpen] = useState(false);

  const { data: subscriptionData, isLoading: isSubscriptionLoading } = useSWR<{ hasActiveSubscription: boolean }>(
    '/api/user/subscription-status',
    fetcher,
    { revalidateOnFocus: false }
  );
  const hasActiveSubscription = subscriptionData?.hasActiveSubscription ?? false;

  const selectedChatModel = useMemo(
    () => chatModels.find((chatModel) => chatModel.id === selectedModelId),
    [selectedModelId],
  );

  if (isSubscriptionLoading) {
    return (
      <Button
        data-testid="model-selector"
        variant="outline"
        className={cn('md:px-2 md:h-[34px]', className)}
        disabled
      >
        Loading...
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          asChild
          className={cn(
            'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
            className,
          )}
        >
          <Button
            data-testid="model-selector"
            variant="outline"
            className="flex items-center gap-1 md:px-2 md:h-[34px]"
          >
            {minimal ? selectedModelId.split('-')[0] : selectedChatModel?.name}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {chatModels.map((chatModel) => {
            const { id, proOnly } = chatModel;
            const isLocked = proOnly === true && !hasActiveSubscription;

            return (
              <DropdownMenuItem
                data-testid={`model-selector-item-${id}`}
                key={id}
                onSelect={() => {
                  if (isLocked) {
                    setPaywallOpen(true);
                    return;
                  }
                  setOpen(false);
                  onModelChange(id);
                }}
                data-active={id === selectedModelId}
                className="group relative flex w-full items-center gap-2 px-3 py-2 cursor-pointer"
              >
                <div className="flex flex-col gap-1 items-start flex-1">
                  <div>{chatModel.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {chatModel.description}
                  </div>
                </div>
                {!isLocked && id === selectedModelId && (
                  <div className="text-foreground dark:text-foreground">
                    <CheckCircleFillIcon />
                  </div>
                )}
                {isLocked && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); setPaywallOpen(true); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Upgrade
                  </Button>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <Paywall isOpen={isPaywallOpen} onOpenChange={setPaywallOpen} required={false} />
    </>
  );
}
