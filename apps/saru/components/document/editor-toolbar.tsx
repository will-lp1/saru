'use client';

import React from 'react';
import { toggleMark, setBlockType } from 'prosemirror-commands';
import { wrapInList, liftListItem } from 'prosemirror-schema-list';
import {
  List,
  ListOrdered,
  Bold,
  Italic,
  Quote,
  Code,
  ChevronDown,
} from 'lucide-react';

import { documentSchema } from '@/lib/editor/config';
import { getActiveEditorView } from '@/lib/editor/editor-state';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

import { undo, redo } from 'prosemirror-history';
import { UndoIcon, RedoIcon } from '@/components/icons';

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

const { nodes, marks } = documentSchema;

function runCommand(command: (state: any, dispatch?: any) => boolean) {
  const view = getActiveEditorView();
  if (!view) return;
  command(view.state, view.dispatch);
  view.focus();
}

interface EditorToolbarProps {
  activeFormats: Record<string, boolean>;
}

export function EditorToolbar({ activeFormats }: EditorToolbarProps) {
  const view = getActiveEditorView();
  const textContent = view?.state.doc.textContent || '';
  const wordCount = textContent.trim().split(/\s+/).filter(Boolean).length;
  const buttonClass = (format: string) =>
    cn(
      'h-8 w-8 p-0 flex items-center justify-center rounded-md border border-border bg-background text-foreground',
      activeFormats[format]
        ? 'border-accent bg-accent text-accent-foreground'
        : '',
      'transition-none',
    );

  const currentTextStyle = activeFormats.h1
    ? 'Heading 1'
    : activeFormats.h2
    ? 'Heading 2'
    : 'Paragraph';

  const textOptions: {
    label: string;
    formatKey: keyof typeof activeFormats;
    command: () => void;
  }[] = [
    {
      label: 'Heading 1',
      formatKey: 'h1',
      command: () => runCommand(setBlockType(nodes.heading, { level: 1 })),
    },
    {
      label: 'Heading 2',
      formatKey: 'h2',
      command: () => runCommand(setBlockType(nodes.heading, { level: 2 })),
    },
    {
      label: 'Paragraph',
      formatKey: 'p',
      command: () => runCommand(setBlockType(nodes.paragraph)),
    },
  ];

  const ButtonWithTooltip = ({
    label,
    children,
    onClick,
    formatKey,
  }: {
    label: string;
    children: React.ReactNode;
    onClick: () => void;
    formatKey: string;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          className={buttonClass(formatKey)}
          onClick={onClick}
          type="button"
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="toolbar sticky top-4 z-20 w-full h-[45px] flex items-center gap-2 px-3 py-0 overflow-x-auto whitespace-nowrap rounded-lg bg-background border border-border">
      {/* Toolbar left side */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-8 px-3 min-w-[7rem] flex items-center justify-between gap-2 text-sm rounded-md border border-border bg-background text-foreground" tabIndex={0}>
            <span className="truncate text-sm font-medium">{currentTextStyle}</span>
            <ChevronDown className="size-4 ml-1 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44 p-1 shadow-lg rounded-lg border bg-popover" align="start">
          {textOptions.map((opt) => (
            <DropdownMenuItem
              key={opt.label}
              onSelect={(e) => {
                e.preventDefault();
                opt.command();
              }}
              className={cn('text-sm rounded-md', opt.formatKey && activeFormats[opt.formatKey] && 'bg-accent text-accent-foreground')}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-2 h-6" />

      <ButtonWithTooltip
        label="Bullet List"
        formatKey="bulletList"
        onClick={() =>
          activeFormats.bulletList
            ? runCommand(liftListItem(nodes.list_item))
            : runCommand(wrapInList(nodes.bullet_list))
        }
      >
        <List className="size-5 text-foreground" />
      </ButtonWithTooltip>
      <ButtonWithTooltip
        label="Numbered List"
        formatKey="orderedList"
        onClick={() =>
          activeFormats.orderedList
            ? runCommand(liftListItem(nodes.list_item))
            : runCommand(wrapInList(nodes.ordered_list))
        }
      >
        <ListOrdered className="size-5 text-foreground" />
      </ButtonWithTooltip>

      <Separator orientation="vertical" className="mx-2 h-6" />

      <ButtonWithTooltip
        label="Bold"
        formatKey="bold"
        onClick={() => runCommand(toggleMark(marks.strong))}
      >
        <Bold className="size-5 text-foreground" />
      </ButtonWithTooltip>
      <ButtonWithTooltip
        label="Italic"
        formatKey="italic"
        onClick={() => runCommand(toggleMark(marks.em))}
      >
        <Italic className="size-5 text-foreground" />
      </ButtonWithTooltip>

      <Separator orientation="vertical" className="mx-2 h-6" />

      <ButtonWithTooltip
        label="Undo"
        formatKey=""
        onClick={() => runCommand(undo)}
      >
        <UndoIcon size={16} />
      </ButtonWithTooltip>
      <ButtonWithTooltip
        label="Redo"
        formatKey=""
        onClick={() => runCommand(redo)}
      >
        <RedoIcon size={16} />
      </ButtonWithTooltip>

      <Separator orientation="vertical" className="mx-2 h-6" />

      <div className="flex-1" />
      <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap pr-2">{wordCount} word{wordCount === 1 ? '' : 's'}</span>
    </div>
  );
}