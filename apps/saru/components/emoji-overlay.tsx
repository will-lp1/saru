"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface EmojiSuggestion {
  emoji: string;
  code: string;
  score: number;
}

interface EmojiOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emojiCode: string) => void;
  position?: { x: number; y: number };
  suggestions: EmojiSuggestion[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  query: string;
}

export default function EmojiOverlay({
  isOpen,
  onClose,
  onSelectEmoji,
  position = { x: 100, y: 100 },
  suggestions,
  selectedIndex,
  onSelectedIndexChange,
  query,
}: EmojiOverlayProps) {
  const [currentPosition, setCurrentPosition] = useState(position);
  // Removed drag functionality for a cleaner, compact overlay
  const overlayRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Update current position when initial position prop changes
  useEffect(() => {
    setCurrentPosition(position);
  }, [position]);

  // Removed drag functionality for a cleaner, compact overlay

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
        case "ArrowDown":
        case "Tab":
          e.preventDefault();
          onSelectedIndexChange(Math.min(selectedIndex + 1, suggestions.length - 1));
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          onSelectedIndexChange(Math.max(selectedIndex - 1, 0));
          break;
        case "Home":
          e.preventDefault();
          onSelectedIndexChange(0);
          break;
        case "End":
          e.preventDefault();
          onSelectedIndexChange(suggestions.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (selectedIndex < suggestions.length) {
            onSelectEmoji(suggestions[selectedIndex].code);
          }
          break;
      }
    },
    [isOpen, suggestions, selectedIndex, onSelectedIndexChange, onSelectEmoji, onClose]
  );

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, handleKeyDown, handleClickOutside]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedItem = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }
    }
  }, [selectedIndex, isOpen]);

  // Adjust position to ensure overlay is visible within viewport
  useEffect(() => {
    if (isOpen && overlayRef.current) {
      const overlay = overlayRef.current;
      const rect = overlay.getBoundingClientRect();

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = currentPosition.x;
      let adjustedY = currentPosition.y;

      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      if (rect.bottom > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      if (adjustedX !== currentPosition.x || adjustedY !== currentPosition.y) {
        overlay.style.left = `${adjustedX}px`;
        overlay.style.top = `${adjustedY}px`;
      }
    }
  }, [isOpen, currentPosition]);

  if (!isOpen || suggestions.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          className="fixed z-50 bg-background rounded-md shadow-lg border border-border overflow-hidden select-none max-w-[172px]"
          style={{
            top: `${currentPosition.y}px`,
            left: `${currentPosition.x}px`,
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <div
            ref={listRef}
            className="flex gap-1 overflow-x-auto p-1 bg-background scrollbar-thin"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.code}-${index}`}
                data-index={index}
                onClick={() => onSelectEmoji(suggestion.code)}
                className={cn(
                  "p-1 rounded-md text-xl transition-colors",
                  index === selectedIndex ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                {suggestion.emoji}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}