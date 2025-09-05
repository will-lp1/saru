import type { UIMessage } from 'ai';
import { useCopyToClipboard } from 'usehooks-ts';
import { memo } from 'react';
import { CopyIcon } from '../icons';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { toast } from 'sonner';

export function PureMessageActions({
  chatId,
  message,
  isLoading,
}: {
  chatId: string;
  message: UIMessage;
  isLoading: boolean;
}) {
  const [_, copyToClipboard] = useCopyToClipboard();

  if (isLoading) return null;
  if (message.role === 'user') return null;
  
  // Check for tool parts instead of deprecated toolInvocations
  const hasToolParts = message.parts?.some(part => 
    part.type?.startsWith('tool-')
  ) ?? false;
  
  if (hasToolParts) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              onClick={async () => {
                // Extract text content from parts
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
    </TooltipProvider>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    return true;
  },
);