import equal from "fast-deep-equal";
import { memo } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import type { UIMessage } from "ai";
import type { UseChatHelpers } from "@ai-sdk/react";
import { CopyIcon, PencilEditIcon, RegenerateIcon } from '../icons';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { toast } from 'sonner';
import { getTrailingMessageId } from '@/lib/utils';

export function PureMessageActions({
  chatId,
  message,
  messages,
  isLoading,
  setMode,
  regenerate,
}: {
  chatId: string;
  message: UIMessage;
  messages: UIMessage[];
  isLoading: boolean;
  setMode?: (mode: 'view' | 'edit') => void;
  regenerate?: UseChatHelpers<UIMessage>['regenerate'];
}) {
  const [_, copyToClipboard] = useCopyToClipboard();

  if (isLoading) return null;

  const hasToolParts = message.parts?.some(part =>
    part.type?.startsWith('tool-')
  ) ?? false;

  if (hasToolParts) return null;

  if (message.role === "user") {
    return (
      <TooltipProvider delayDuration={0}>
        <div
          data-auto-scroll-ignore
          className="flex flex-row justify-end -mr-0.5"
        >
          <div className="relative">
            {setMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="-left-10 absolute top-0 py-1 px-2 h-fit text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100"
                    variant="outline"
                    onClick={() => setMode('edit')}
                  >
                    <PencilEditIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="py-1 px-2 h-fit text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 touch-hitbox"
                  variant="outline"
                  onClick={async () => {
                    const textParts = message.parts?.filter(part => part.type === 'text') ?? [];
                    const content = textParts.map(part => part.text).join('');

                    await copyToClipboard(content || '');
                    toast.success('Copied to clipboard!');
                  }}
                >
                  <CopyIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        data-auto-scroll-ignore
        className="flex flex-row gap-1 -ml-0.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground touch-hitbox"
              variant="outline"
              onClick={async () => {
                const textParts = message.parts?.filter(part => part.type === 'text') ?? [];
                const content = textParts.map(part => part.text).join('');

                await copyToClipboard(content || '');
                toast.success('Copied to clipboard!');
              }}
            >
              <CopyIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>

        {regenerate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="py-1 px-2 h-fit text-muted-foreground touch-hitbox"
                variant="outline"
                onClick={() => {
                  const trailingMessageId = getTrailingMessageId({ messages });
                  regenerate({
                    messageId: message.id,
                    body: {
                      regenerateFromMessageId: message.id,
                      trailingMessageId,
                    },
                  });
                }}
              >
                <RegenerateIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Regenerate</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }

    return true;
  }
);
