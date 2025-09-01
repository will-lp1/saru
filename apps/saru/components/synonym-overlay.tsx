"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EditorView } from "prosemirror-view";
import { synonymsPluginKey } from "@/lib/editor/synonym-plugin";

export interface SynonymOverlayProps {
  isOpen: boolean;
  synonyms: string[];
  position: { x: number; y: number };
  onClose: () => void;
  view: EditorView | null;
  from: number;
  to: number;
}

export default function SynonymOverlay({
  isOpen,
  synonyms,
  position,
  onClose,
  view,
  from,
  to,
}: SynonymOverlayProps) {
  if (!isOpen || synonyms.length === 0) return null;

  const handleSelect = (syn: string) => {
    if (view) {
      view.dispatch(
        view.state.tr.replaceWith(from, to, view.state.schema.text(syn))
      );
      view.focus();
    }
    // Clear loading state
    if (view) {
      view.dispatch(view.state.tr.setMeta(synonymsPluginKey, { loadingPos: null }));
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed z-50 bg-popover text-popover-foreground border border-border rounded-md shadow-lg p-1 flex gap-1"
          style={{ top: position.y, left: position.x }}
          initial={{ opacity: 0, scale: 0.95, x: '-50%' }}
          animate={{ opacity: 1, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, scale: 0.95, x: '-50%' }}
          transition={{ duration: 0.12 }}
        >
          {synonyms.map((syn, idx) => (
            <button
              key={`${syn}-${idx}`}
              onClick={() => handleSelect(syn)}
              className={cn(
                "synonym-option text-sm px-2 py-1 rounded-md hover:bg-accent"
              )}
            >
              {syn}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
