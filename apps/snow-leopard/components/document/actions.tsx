import { Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { toast } from "sonner";
import { CopyIcon } from "../icons";
import type { SaveStatus } from "@/lib/editor/save-plugin";

interface DocumentActionsProps {
  content: string;
  saveStatus: SaveStatus;
}

export function DocumentActions({ content, saveStatus }: DocumentActionsProps) {
  const statusNode = (() => {
    if (saveStatus === "saving" || saveStatus === "debouncing") {
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-xs">Saving…</span>
        </div>
      );
    }
    if (saveStatus === "error") {
      return (
        <div className="flex items-center gap-1 text-destructive">
          <AlertTriangle className="size-4" />
          <span className="text-xs">Error</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-green-600">
        <Check className="size-4" />
        <span className="text-xs">Saved</span>
      </div>
    );
  })();

  return (
    <div className="flex items-center gap-2">
      {statusNode}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => {
              navigator.clipboard.writeText(content);
              toast.success("Copied to clipboard!");
            }}
            aria-label="Copy document to clipboard"
          >
            <CopyIcon size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy to clipboard</TooltipContent>
      </Tooltip>
    </div>
  );
}