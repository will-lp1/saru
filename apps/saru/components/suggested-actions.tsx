'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { memo } from 'react';

interface SuggestedActionsProps {
  chatId: string;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
}

function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  // Empty suggested actions - no hardcoded presets
  return (
    <div
      data-testid="suggested-actions"
      className="flex items-center justify-center w-full"
    >
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm text-muted-foreground py-4"
      >
        Type a message to start a conversation
      </motion.p>
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
