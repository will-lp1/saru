"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { X, Check, ChevronDown, GripVertical, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAiOptionsValue } from "@/hooks/ai-options";
import { useSuggestionOverlay } from "./suggestion-overlay-provider";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { DiffView } from "@/components/document/diffview";

export interface HighlightedTextProps {
  text: string;
  startIndex: number;
  endIndex: number;
}

interface SuggestionMetadata {
  originalContent?: string;
  pendingSuggestion?: string;
  suggestions?: Array<{
    originalText: string;
    suggestedText: string;
    isResolved: boolean;
    [key: string]: any;
  }>;
  [key: string]: any;
}

interface SuggestionOverlayProps {
  documentId: string;
  selectedText?: string;
  isOpen: boolean;
  onClose: () => void;
  onAcceptSuggestion: (suggestion: string) => void;
  position?: { x: number; y: number };
}

export default function SuggestionOverlay({
  documentId,
  selectedText = "",
  isOpen,
  onClose,
  onAcceptSuggestion,
  position = { x: 100, y: 100 },
}: SuggestionOverlayProps) {
  const [currentPosition, setCurrentPosition] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string>("");
  const [isSelectionExpanded, setIsSelectionExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { customInstructions, writingStyleSummary, applyStyle } = useAiOptionsValue();
  const { setSuggestionIsLoading } = useSuggestionOverlay();

  // Effect to inform provider about loading state changes
  useEffect(() => {
    setSuggestionIsLoading(isGenerating);
  }, [isGenerating, setSuggestionIsLoading]);

  // Function to truncate text to first 5 words
  const truncateText = (text: string, wordCount = 5) => {
    const words = text.split(/\s+/);
    if (words.length <= wordCount) return text;
    return words.slice(0, wordCount).join(" ") + "...";
  };

  // Update current position when initial position prop changes
  useEffect(() => {
    setCurrentPosition(position);
  }, [position]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only allow dragging from the header
    if (!(e.target as HTMLElement).closest(".drag-handle")) return;

    e.preventDefault();
    setIsDragging(true);

    const rect = overlayRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const overlayWidth = overlayRef.current?.offsetWidth || 0;
      const overlayHeight = overlayRef.current?.offsetHeight || 0;

      // Calculate new position
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      // Constrain to viewport bounds with padding
      const padding = 10;
      newX = Math.max(
        padding,
        Math.min(viewportWidth - overlayWidth - padding, newX)
      );
      newY = Math.max(
        padding,
        Math.min(viewportHeight - overlayHeight - padding, newY)
      );

      setCurrentPosition({ x: newX, y: newY });
    },
    [isDragging, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add and remove mouse move and up listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Reset state when the overlay opens
  useEffect(() => {
    if (isOpen) {
      setIsGenerating(false);
      setError(null);
      setSuggestion("");
      setOriginalContent(null);

      if (selectedText) {
        setOriginalContent(selectedText);
      }
    }
  }, [isOpen, selectedText]);

  // Close and cleanup when the component unmounts
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Adjust position to ensure overlay is visible within viewport
  useEffect(() => {
    if (isOpen && overlayRef.current) {
      const overlay = overlayRef.current;
      const rect = overlay.getBoundingClientRect();

      // Check if overlay is outside viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = currentPosition.x;
      let adjustedY = currentPosition.y;

      // Adjust horizontal position if needed
      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      // Adjust vertical position if needed
      if (rect.bottom > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      // Update position if adjustments were made
      if (adjustedX !== currentPosition.x || adjustedY !== currentPosition.y) {
        overlay.style.left = `${adjustedX}px`;
        overlay.style.top = `${adjustedY}px`;
      }
    }
  }, [isOpen, currentPosition]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "Enter" &&
        !isGenerating &&
        suggestion
      ) {
        // Cmd+Enter to accept suggestion
        setSuggestionIsLoading(true);
        setTimeout(() => onAcceptSuggestion(suggestion), 300);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
        // Cmd+Backspace to reject suggestion
        onClose();
      }
    },
    [
      onClose,
      isGenerating,
      suggestion,
      setSuggestionIsLoading,
      onAcceptSuggestion,
    ]
  );

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(event.target as Node)
      ) {
        // Only close if the click is truly outside and not on some other interactive element
        // that might be part of a larger system (e.g., a global command palette that opened it).
        // For now, a simple check is fine.
        onClose();
      }
    },
    [onClose, overlayRef]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, handleKeyDown, handleClickOutside]);

  const handleSubmitPrompt = useCallback(
    async (prompt: string) => {
      if (!documentId) {
        toast.error("No document is currently open");
        return;
      }

      // Don't proceed if no text was selected for suggestion context
      if (!selectedText || selectedText.trim() === "") {
        toast.warning("Please select text to generate a suggestion for");
        return;
      }

      setIsGenerating(true);
      setError(null);
      setSuggestion("");
      setOriginalContent(selectedText); // Keep track of original content

      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      try {
        // Create URL with parameters for EventSource
        const params = new URLSearchParams({
          documentId,
          description: prompt.trim(),
        });

        if (selectedText) {
          params.append("selectedText", selectedText);
        }

        // Only add custom instructions if they exist
        if (customInstructions) {
          params.append("customInstructions", customInstructions);
        }
        if (applyStyle && writingStyleSummary) {
          params.append("writingStyleSummary", writingStyleSummary);
        }
        if (applyStyle) {
          params.append("applyStyle", "true");
        }

        const url = `/api/suggestion?${params.toString()}`;
        console.log("[SuggestionOverlay] Requesting suggestion with options:", {
          customInstructions: customInstructions ? "(custom)" : "(none)",
        });

        // Create new EventSource connection
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onerror = (event) => {
          console.error("EventSource error:", event);
          setError("Error connecting to suggestion service. Please try again.");
          setIsGenerating(false);
          eventSource.close();
          eventSourceRef.current = null;
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case "id":
                // Document ID confirmation, nothing to do
                break;

              case "original":
                setOriginalContent(data.content);
                break;

              case "clear":
                // Clear current content if needed
                break;

              case "suggestion-delta":
                setSuggestion((prev) => prev + data.content);
                break;

              case "error":
                setError(data.content);
                setIsGenerating(false);
                eventSource.close();
                eventSourceRef.current = null;
                break;

              case "finish":
                setIsGenerating(false);
                setInputValue("");
                eventSource.close();
                eventSourceRef.current = null;
                break;

              default:
                console.warn("Unknown event type:", data.type);
            }
          } catch (err) {
            console.error("Error parsing event data:", event.data, err);
            setError("Error processing suggestion. Please try again.");
            setIsGenerating(false);
            eventSource.close();
            eventSourceRef.current = null;
          }
        };
      } catch (err) {
        console.error("Error setting up EventSource:", err);
        setError("Failed to connect to suggestion service. Please try again.");
        setIsGenerating(false);
      }
    },
    [documentId, selectedText, customInstructions, writingStyleSummary, applyStyle]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      await handleSubmitPrompt(inputValue);
    },
    [handleSubmitPrompt, inputValue]
  );

  // Handle accept with a quick pulse animation before applying suggestion
  const handleAcceptSuggestion = useCallback(
    (suggestedText: string) => {
      setSuggestionIsLoading(true);
      setTimeout(() => {
        onAcceptSuggestion(suggestedText);
      }, 300);
    },
    [onAcceptSuggestion, setSuggestionIsLoading]
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          className={cn(
            "fixed z-50 bg-background rounded-lg shadow-lg border border-border w-[400px] overflow-hidden select-none",
            isDragging && "pointer-events-none"
          )}
          style={{
            top: `${currentPosition.y}px`,
            left: `${currentPosition.x}px`,
          }}
          onMouseDown={handleMouseDown}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <div className="px-3 py-2 space-y-2">
            {/* Header with close button */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 drag-handle cursor-move">
                <GripVertical size={14} className="text-muted-foreground" />
                <h3 className="text-sm font-medium">Suggestion</h3>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onClose}
                      className="text-muted-foreground hover:text-foreground transition-colors p-2"
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <span className="text-xs">⌘+Backspace</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Selected text collapsible section */}
            {selectedText && (
              <div className="border rounded-md overflow-hidden bg-muted/30">
                <button
                  onClick={() => setIsSelectionExpanded(!isSelectionExpanded)}
                  className="w-full px-3 py-2 flex items-center justify-between text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <span className="truncate">
                    {isSelectionExpanded
                      ? "Selected Text"
                      : truncateText(selectedText)}
                  </span>
                  <ChevronDown
                    size={16}
                    className={cn("transition-transform", {
                      "transform rotate-180": isSelectionExpanded,
                    })}
                  />
                </button>
                {isSelectionExpanded && (
                  <div className="px-3 py-2 text-sm border-t max-h-[150px] overflow-y-auto">
                    {selectedText}
                  </div>
                )}
              </div>
            )}

            {/* Input field */}
            <div>
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  selectedText
                    ? "Describe what changes you'd like to make..."
                    : "Select text first..."
                }
                className="w-full p-2 rounded-md border border-input text-sm bg-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isGenerating) {
                    handleSubmitPrompt(inputValue);
                  }
                }}
                disabled={isGenerating || !selectedText}
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Diff view for original vs suggestion */}
            {(isGenerating || suggestion) && originalContent && (
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <div className="p-2 max-h-[300px] overflow-y-auto">
                  <DiffView
                    oldContent={originalContent}
                    newContent={suggestion || originalContent}
                  />
                </div>

                {/* Action buttons - only show on completion */}
                {!isGenerating && suggestion && (
                  <div className="flex justify-end gap-2 p-2 border-t bg-background/50">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={onClose}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-destructive"
                          >
                            <X size={13} strokeWidth={2.5} />
                            <span className="text-xs">Reject</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span className="text-xs">⌘+Backspace</span>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleAcceptSuggestion(suggestion)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-primary"
                          >
                            <Check size={13} strokeWidth={2.5} />
                            <span className="text-xs">Accept</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span className="text-xs">⌘+Enter</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                {/* Show loading state with spinner */}
                {isGenerating && (
                  <div className="flex justify-center items-center p-2 border-t bg-background/50">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Generating suggestion...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
