'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { GripVertical, X, Check, Globe, FileText, Check as CheckIcon, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="size-full flex items-center justify-center p-6"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-medium">Welcome to Saru</h2>
        </div>

        <div className="flex items-center gap-3">
          <ToolboxDialog />

          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="https://discord.gg/X49bQmnYbd" target="_blank" rel="noopener noreferrer">
              <Image src="/images/discord-logo.png" alt="Discord" width={14} height={14} className="mr-1.5" />
              Discord
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

function ToolboxDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          Open Toolbox
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-8 overflow-hidden">
        {/* Background leopard print - edge to edge */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <Image
            src="/images/leopardprintbw.svg"
            alt=""
            fill
            className="object-cover dark:invert opacity-[0.03] dark:opacity-[0.05]"
            style={{ transform: 'scale(1.5)' }}
          />
        </div>
        <DialogHeader className="relative z-10">
          <DialogTitle className="text-lg font-medium">Toolbox</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2 relative z-10">
          {/* Card 1: Inline Suggestions */}
          <Card className="h-full flex flex-col min-h-[280px] rounded-xl overflow-visible">
            <CardHeader className="p-6 text-base font-medium">
              Real-time Inline Suggestions
            </CardHeader>
            <CardContent className="p-6 text-sm text-muted-foreground flex-grow">
              <p className="demo-prose-mirror-style">
                <span className="demo-text-base">You start typing, and the AI offers</span>
                <span className="inline-suggestion-wrapper">
                  <span
                    className="demo-inline-suggestion-animated"
                    data-suggestion=" a helpful completion."
                  ></span>
                  <kbd className="inline-tab-icon">Tab</kbd>
                </span>
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Selection Edits */}
          <Card className="h-full flex flex-col min-h-[280px] rounded-xl overflow-visible">
            <CardHeader className="p-6 text-base font-medium">
              Powerful Selection Edits
            </CardHeader>
            <CardContent className="p-6 text-sm text-muted-foreground flex-grow relative overflow-visible">
              <p className="demo-prose-mirror-style">
                <span className="demo-text-base">
                  This phrasing <span className="demo-selected-text-animated">is a bit weak and verbose.</span> Let&apos;s ask the AI to improve it.
                </span>
              </p>
              <div className="demo-suggestion-overlay-animated border border-border">
                <div className="demo-overlay-header">
                  <GripVertical size={14} className="text-muted-foreground/70 demo-overlay-drag-handle" />
                  <h3 className="text-xs font-medium">Suggestion</h3>
                </div>
                <div className="demo-overlay-input-placeholder" />
                <div className="demo-overlay-diff-view">
                  <span className="text-red-500 line-through dark:text-red-400/70">
                    is a bit weak and verbose.
                  </span>
                  <span className="text-green-600 dark:text-green-400/70 ml-1 demo-diff-new-text-animated">
                    lacks punch and impact.
                  </span>
                </div>
                <div className="demo-overlay-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 py-1 text-xs hover:text-destructive rounded-full"
                  >
                    <X size={13} strokeWidth={2.5} className="mr-1" /> Reject
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 py-1 text-xs hover:text-primary rounded-full"
                  >
                    <Check size={13} strokeWidth={2.5} className="mr-1" /> Accept
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Synonym Finder */}
          <Card className="h-full flex flex-col min-h-[280px] rounded-xl overflow-visible">
            <CardHeader className="p-6 text-base font-medium">
              Instant Synonym Finder
            </CardHeader>
            <CardContent className="p-6 text-sm text-muted-foreground flex-grow">
              <p className="demo-prose-mirror-style relative">
                <span className="demo-text-base">Find better words with ease. The AI presents contextually</span>
                <span className="demo-synonym-word-animated" data-word="relevant">
                  relevant
                  <span className="demo-synonym-menu-animated">
                    <span>apt</span>
                    <span>pertinent</span>
                    <span>fitting</span>
                  </span>
                </span>
                <span className="demo-text-base"> synonyms.</span>
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Chat */}
          <Card className="h-full flex flex-col min-h-[280px] rounded-xl overflow-visible">
            <CardHeader className="p-6 text-base font-medium">
              Chat
            </CardHeader>
            <CardContent className="p-6 text-sm flex-grow">
              <div className="demo-chat-container">
                {/* User message */}
                <div className="demo-chat-row demo-chat-row-user demo-anim-1">
                  <div className="demo-chat-bubble-user">
                    Add stats about AI adoption
                  </div>
                </div>

                {/* Tool card 1 - Web search */}
                <div className="demo-chat-row demo-anim-2">
                  <div className="demo-tool-card">
                    <div className="demo-tool-card-inner">
                      <Globe size={14} className="text-muted-foreground shrink-0" />
                      <span className="flex-grow">Searching the web...</span>
                      <span className="demo-tool-status demo-tool-status-1">
                        <Loader2 size={14} className="demo-spinner" />
                        <CheckIcon size={14} className="demo-check text-green-600" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tool card 2 - Document update */}
                <div className="demo-chat-row demo-anim-3">
                  <div className="demo-tool-card">
                    <div className="demo-tool-card-inner">
                      <FileText size={14} className="text-muted-foreground shrink-0" />
                      <span className="flex-grow">Updating document...</span>
                      <span className="demo-tool-status demo-tool-status-2">
                        <Loader2 size={14} className="demo-spinner" />
                        <CheckIcon size={14} className="demo-check text-green-600" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI response */}
                <div className="demo-chat-row demo-anim-4">
                  <span className="text-foreground text-xs">Done! Added the latest AI adoption statistics.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <style jsx global>{`
          :root {
            --ease-out-quad: cubic-bezier(0.25, 0.46, 0.45, 0.94);
            --ease-out-cubic: cubic-bezier(0.215, 0.610, 0.355, 1.000);
            --ease-out-quart: cubic-bezier(0.165, 0.840, 0.440, 1.000);
          }
          .demo-prose-mirror-style {
            line-height: 1.6;
            min-height: 100px;
          }
          .demo-text-base {
            color: hsl(var(--foreground));
          }

          /* Inline Suggestion Animation - Streaming Effect */
          .demo-inline-suggestion-animated::after {
            content: attr(data-suggestion);
            color: var(--muted-foreground);
            opacity: 1;
            display: inline-block;
            overflow: hidden;
            white-space: nowrap;
            width: 0;
            vertical-align: bottom;
            animation: streamInSuggestion 1s steps(22, end) 1.2s forwards;
          }
          @keyframes streamInSuggestion {
            to { width: 100%; }
          }

          /* Selection Overlay Animation & Enhanced Styling */
          .demo-selected-text-animated {
            animation: highlightText 0.6s 0.7s forwards var(--ease-out-quad);
            background-color: transparent;
            padding: 0.1em 0.2em;
            border-radius: 3px;
            display: inline;
          }
          @keyframes highlightText {
            0% { background-color: transparent; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
            30% { background-color: rgba(59, 130, 246, 0.2); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);}
            100% { background-color: rgba(59, 130, 246, 0.2); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);}
          }
          .demo-suggestion-overlay-animated {
            position: absolute;
            bottom: -0.75rem;
            left: 5%;
            right: 5%;
            background-color: hsl(var(--card));
            border-radius: 0.75rem;
            padding: 0.625rem;
            box-shadow: 0 6px 16px -2px rgba(0,0,0,0.1), 0 3px 8px -2px rgba(0,0,0,0.06);
            opacity: 0;
            transform: translateY(calc(100% + 1rem)) scale(0.98);
            animation: slideInOverlayEnhanced 0.6s 1.5s forwards var(--ease-out-quart);
            font-size: 0.875rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          .demo-overlay-header {
            display: flex;
            align-items: center;
            padding: 0 0.125rem;
            gap: 0.375rem;
          }
          .demo-overlay-input-placeholder {
            width: 100%;
            padding: 0.375rem 0.625rem;
            border-radius: 0.5rem;
            border: 1px solid hsl(var(--border));
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            background-color: transparent;
            min-height: calc(0.75rem * 1.5 + 0.375rem * 2);
            position: relative;
          }
          .demo-overlay-input-placeholder::before {
            content: "";
            display: inline-block;
            animation: demoInputTyping 2s steps(22, end) 2.2s forwards;
            opacity: 0;
          }
          .demo-overlay-input-placeholder::after {
            content: '|';
            display: inline-block;
            color: var(--foreground);
            animation: demoCaretAnimation 2s linear 2.2s forwards;
            opacity: 0;
            margin-left: 1px;
          }
          @keyframes demoInputTyping {
            0% { content: ""; opacity: 0;}
            1% { opacity: 1;}
            4.5% { content: "M"; }  9% { content: "Ma"; } 13.5% { content: "Mak"; } 18% { content: "Make"; }
            22.5% { content: "Make "; } 27% { content: "Make i"; } 31.5% { content: "Make it"; } 36% { content: "Make it "; }
            40.5% { content: "Make it m"; } 45% { content: "Make it mo"; } 49.5% { content: "Make it mor"; } 54% { content: "Make it more"; }
            58.5% { content: "Make it more "; } 63% { content: "Make it more p"; } 67.5% { content: "Make it more pu"; } 72% { content: "Make it more pun"; }
            76.5% { content: "Make it more punc"; } 81% { content: "Make it more punch"; } 85.5% { content: "Make it more punchy"; }
            90% { content: "Make it more punchy."; }
            100% { content: "Make it more punchy."; opacity: 1; }
          }
          @keyframes demoCaretAnimation {
            0%, 100% { opacity: 0; }
            1% { opacity: 1; }
            5%, 15%, 25%, 35%, 45%, 55%, 65%, 75%, 85%, 95% { opacity: 1; }
            10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90% { opacity: 0; }
          }
          .demo-overlay-diff-view {
            border: 1px solid hsl(var(--border));
            border-radius: 0.5rem;
            padding: 0.5rem;
            font-size: 0.75rem;
            background-color: var(--muted-background-subtle, rgba(0,0,0,0.015));
            min-height: 32px;
            opacity: 0;
            animation: fadeInDiffView 0.3s ease-out 4.3s forwards;
          }
          @keyframes fadeInDiffView {
            to { opacity: 1; }
          }
          .demo-diff-new-text-animated {
            display: inline-block;
            overflow: hidden;
            white-space: nowrap;
            width: 0;
            vertical-align: bottom;
            animation: streamInDiffNewText 1s steps(22, end) 4.7s forwards;
          }
          @keyframes streamInDiffNewText {
            to { width: max-content; }
          }
          html.dark .demo-overlay-diff-view {
            background-color: var(--muted-background-subtle, rgba(255,255,255,0.02));
          }
          .demo-overlay-actions {
            display: flex;
            justify-content: flex-end;
            gap: 0.25rem;
            padding-top: 0.5rem;
            border-top: 1px solid hsl(var(--border));
          }
          @keyframes slideInOverlayEnhanced {
            from { opacity: 0; transform: translateY(calc(100% + 1rem)) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }

          /* Synonym Plugin Animation */
          .demo-synonym-word-animated {
            display: inline-block;
            position: relative;
            cursor: default;
            margin-left: 0.25em;
            margin-right: 0.25em;
          }
          .demo-synonym-word-animated::before {
            content: '';
            position: absolute;
            top: -2px; left: -2px; right: -2px; bottom: -2px;
            background-color: transparent;
            border-radius: 3px;
            pointer-events: none;
            animation: synonymLoadingState 0.7s 0.7s forwards var(--ease-out-quad);
          }
          @keyframes synonymLoadingState {
            0% { text-decoration: none; background-color: transparent; }
            40%, 60%, 100% { text-decoration: underline dotted var(--muted-foreground); background-color: rgba(100, 100, 100, 0.07); }
          }
          .demo-synonym-menu-animated {
            position: absolute;
            left: 65%;
            bottom: 135%;
            background-color: hsl(var(--popover));
            color: hsl(var(--popover-foreground));
            border: 1px solid hsl(var(--border));
            border-radius: 0.5rem;
            padding: 7px 9px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06);
            display: flex;
            gap: 7px;
            font-size: 0.75rem;
            z-index: 20;
            opacity: 0;
            white-space: nowrap;
            transform: translateX(-50%) translateY(8px) scale(0.95);
            animation: fadeInSynonymMenu 0.5s 1.6s forwards var(--ease-out-cubic);
          }
          .demo-synonym-menu-animated span {
            padding: 4px 6px;
            border-radius: 0.375rem;
            transition: background-color 0.2s, color 0.2s;
          }
          .demo-synonym-menu-animated span:hover {
            background-color: hsl(var(--accent));
            color: hsl(var(--accent-foreground));
          }
          @keyframes fadeInSynonymMenu {
            from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.95); }
            to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          }

          /* Inline Suggestion Wrapper & Tab Key */
          .inline-suggestion-wrapper {
            display: inline-flex;
            align-items: baseline;
          }
          .inline-tab-icon {
            margin-left: 0.5em;
            background: linear-gradient(145deg, #f3f3f3, #e0e0e0);
            border: 1px solid #c0c0c0;
            border-radius: 4px;
            padding: 0.15em 0.5em;
            font-size: 0.75em;
            font-weight: 500;
            color: hsl(var(--muted-foreground));
            box-shadow: 0 2px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8);
            opacity: 0;
            animation: fadeInInlineTab 0.3s ease-out 1.3s forwards;
          }
          @keyframes fadeInInlineTab {
            to { opacity: 1; }
          }
          html.dark .inline-tab-icon {
            background: linear-gradient(145deg, #2c2c2c, #1f1f1f);
            border-color: #444444;
            box-shadow: 0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
            color: hsl(var(--muted-foreground));
          }

          .kbd-shortcut {
            background: linear-gradient(145deg, #f5f5f5, #e8e8e8);
            border: 1px solid #d0d0d0;
            border-radius: 6px;
            padding: 0.25em 0.6em;
            font-size: 0.7rem;
            font-weight: 500;
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
            color: hsl(var(--muted-foreground));
            box-shadow: 0 2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
            white-space: nowrap;
          }
          html.dark .kbd-shortcut {
            background: linear-gradient(145deg, #2a2a2a, #1e1e1e);
            border-color: #3a3a3a;
            box-shadow: 0 2px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04);
          }

          /* Chat Demo Styles */
          .demo-chat-container {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          .demo-chat-row {
            display: flex;
            align-items: flex-start;
            opacity: 0;
          }
          .demo-chat-row-user {
            justify-content: flex-end;
          }
          .demo-chat-bubble-user {
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            padding: 0.375rem 0.625rem;
            border-radius: 0.625rem;
            font-size: 0.75rem;
          }
          .demo-tool-card {
            background: hsl(var(--background));
            border: 1px solid hsl(var(--border));
            border-radius: 0.75rem;
            font-size: 0.75rem;
            overflow: hidden;
          }
          .demo-tool-card-inner {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            width: 100%;
          }
          .demo-anim-1 { animation: fadeSlideIn 0.25s 0.2s forwards var(--ease-out-cubic); }
          .demo-anim-2 { animation: fadeSlideIn 0.25s 0.5s forwards var(--ease-out-cubic); }
          .demo-anim-3 { animation: fadeSlideIn 0.25s 1.2s forwards var(--ease-out-cubic); }
          .demo-anim-4 { animation: fadeSlideIn 0.25s 2.0s forwards var(--ease-out-cubic); }
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* Tool status: spinner then checkmark */
          .demo-tool-status {
            position: relative;
            width: 14px;
            height: 14px;
            flex-shrink: 0;
          }
          .demo-tool-status .demo-spinner,
          .demo-tool-status .demo-check {
            position: absolute;
            inset: 0;
          }
          .demo-tool-status .demo-spinner {
            color: hsl(var(--muted-foreground));
            animation: spin 1s linear infinite;
          }
          .demo-tool-status .demo-check {
            opacity: 0;
          }
          /* Card 1: complete at 1.1s */
          .demo-tool-status-1 .demo-spinner {
            animation: spin 1s linear infinite, fadeOut 0.15s 1.1s forwards;
          }
          .demo-tool-status-1 .demo-check {
            animation: fadeIn 0.15s 1.1s forwards;
          }
          /* Card 2: appears at 1.2s, complete at 1.9s */
          .demo-tool-status-2 .demo-spinner {
            animation: spin 1s linear infinite, fadeOut 0.15s 1.9s forwards;
          }
          .demo-tool-status-2 .demo-check {
            animation: fadeIn 0.15s 1.9s forwards;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes fadeOut {
            to { opacity: 0; }
          }
          @keyframes fadeIn {
            to { opacity: 1; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
