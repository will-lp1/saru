'use client';

import { motion } from 'framer-motion';
import { ChatRequestOptions, UIMessage } from 'ai';
import { memo } from 'react';
import { UseChatHelpers } from '@ai-sdk/react';

interface SuggestedActionsProps {
  chatId: string;
  sendMessage: UseChatHelpers<UIMessage>['sendMessage'];
}

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
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
