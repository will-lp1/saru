import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { toast } from "sonner";
import {
  ClockRewind,
  UndoIcon,
  RedoIcon,
  CopyIcon,
} from "../icons";
import { useState } from "react";
import { Document } from "@snow-leopard/db";

interface DocumentActionsProps {
  content: string;
  latestContent: string;
  documentId: string;
  isSaving: boolean;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  documents?: Document[];
}

export function DocumentActions({
  content,
  latestContent,
  documentId,
  isSaving,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  documents,
}: DocumentActionsProps) {
  const [previewActive, setPreviewActive] = useState(false);

  const buttons = [
    {
      icon: <ClockRewind size={16} />,
      label: previewActive ? "Hide changes" : "View changes",
      disabled: isCurrentVersion,
      onClick: () => {
        if (previewActive) {
          window.dispatchEvent(
            new CustomEvent("cancel-document-update", {
              detail: { documentId },
            })
          );
          setPreviewActive(false);
        } else {
          window.dispatchEvent(
            new CustomEvent("preview-document-update", {
              detail: { documentId, newContent: latestContent },
            })
          );
          setPreviewActive(true);
        }
      },
    },
    {
      icon: <UndoIcon size={16} />,
      label: "Previous version",
      disabled: !documents || currentVersionIndex <= 0,
      onClick: () => handleVersionChange("prev"),
    },
    {
      icon: <RedoIcon size={16} />,
      label: "Next version",
      disabled: !documents || currentVersionIndex >= (documents.length - 1),
      onClick: () => handleVersionChange("next"),
    },
  ];

  return (
    <div className="flex items-center gap-1">
      {isSaving && (
        <span className="text-xs text-muted-foreground mr-2">Saving…</span>
      )}

      {buttons.map(({ icon, label, disabled, onClick }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="size-8 p-0"
              disabled={disabled}
              onClick={onClick}
            >
              {icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => {
              navigator.clipboard.writeText(content);
              toast.success("Copied to clipboard!");
            }}
          >
            <CopyIcon size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy to clipboard</TooltipContent>
      </Tooltip>
    </div>
  );
}