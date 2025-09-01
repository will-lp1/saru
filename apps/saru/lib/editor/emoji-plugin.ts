import { Plugin, EditorState, Transaction, TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Schema, Node as ProseMirrorNode, ResolvedPos } from 'prosemirror-model';
import * as emoji from 'node-emoji';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import EmojiOverlay from '@/components/emoji-overlay';

interface EmojiSuggestion {
  emoji: string;
  code: string;
  score: number;
}

interface Coordinates {
  left: number;
  top: number;
}

interface EmojiSearchResult {
  emoji: string;
  name: string;
}

interface EmojiPluginState {
  suggestionElement: HTMLElement | null; // container for React root
  overlayRoot: Root | null;             // React root instance
  coords: Coordinates | null;           // last known coords
  currentQuery: string;
  selectedIndex: number;
  suggestions: EmojiSuggestion[];
  editorView: EditorView | null;
}

export function emojiPlugin(): Plugin {
  const pluginState: EmojiPluginState = {
    suggestionElement: null,
    overlayRoot: null,
    coords: null,
    currentQuery: '',
    selectedIndex: 0,
    suggestions: [],
    editorView: null
  };

  function setEditorView(view: EditorView): void {
    pluginState.editorView = view;
    // console.log('Emoji plugin: Editor view set', view);
  }

  function insertEmojiAtCursor(emojiCode: string): boolean {
    if (!pluginState.editorView) return false;
    
    const { from } = pluginState.editorView.state.selection;
    const doc = pluginState.editorView.state.doc;
    
    if (from < 0 || from > doc.content.size) {
      console.warn('Emoji plugin: Invalid cursor position:', from, 'doc size:', doc.content.size);
      return false;
    }
    
    let start = from - 1;
    while (start >= 0) {
      const ch = doc.textBetween(start, start + 1);
      if (ch === ':') break;
      if (/\s|\n|\t/.test(ch)) return false; 
      start--;
    }

    if (start >= 0 && doc.textBetween(start, start + 1) === ':') {
      const end = from;
      
      if (start < 0 || start > doc.content.size || end < 0 || end > doc.content.size) {
        console.warn('Emoji plugin: Calculated positions out of bounds:', { start, end, docSize: doc.content.size });
        return false;
      }
      
      const textToInsert = emojiCode; 
      const tr = pluginState.editorView.state.tr.replaceWith(start, end, pluginState.editorView.state.schema.text(textToInsert));
      
      const newPos = start + textToInsert.length;
      
      if (newPos >= 0 && newPos <= tr.doc.content.size) {
        tr.setSelection(TextSelection.near(tr.doc.resolve(newPos)));
      }
      
      pluginState.editorView.dispatch(tr);
      
      setTimeout(() => {
        if (pluginState.editorView && pluginState.editorView.dom) {
          pluginState.editorView.focus();
        }
      }, 0);
      
      return true;
    }
    
    return false;
  }

  // Removed legacy createSuggestionElement; React-based overlay now handles navigation & display

  function renderOverlay(): void {
    if (!pluginState.overlayRoot || !pluginState.coords) return;

    pluginState.overlayRoot.render(
      React.createElement(EmojiOverlay, {
        isOpen: true,
        query: pluginState.currentQuery.replace(/^:/, ''),
        position: { x: pluginState.coords.left, y: pluginState.coords.top + 20 },
        suggestions: pluginState.suggestions,
        selectedIndex: pluginState.selectedIndex,
        onSelectedIndexChange: (index: number) => {
          pluginState.selectedIndex = index;
          renderOverlay();
        },
        onClose: () => hideSuggestions(),
        onSelectEmoji: (code: string) => {
          insertEmojiAtCursor(code);
          hideSuggestions();
        },
      })
    );
  }

  function showSuggestions(query: string, coords: Coordinates): void {
    const queryChanged = pluginState.currentQuery !== query;
    pluginState.currentQuery = query;
    pluginState.suggestions = getEmojiSuggestions(query);
    if (queryChanged) {
      pluginState.selectedIndex = 0;
    }
    pluginState.coords = coords;

    if (pluginState.suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    // initialise container & react root if needed
    if (!pluginState.suggestionElement) {
      pluginState.suggestionElement = document.createElement('div');
      document.body.appendChild(pluginState.suggestionElement);
      pluginState.overlayRoot = createRoot(pluginState.suggestionElement);
    }

    renderOverlay();
  }

  function hideSuggestions(): void {
    if (pluginState.overlayRoot) {
      pluginState.overlayRoot.unmount();
      pluginState.overlayRoot = null;
    }
    if (pluginState.suggestionElement) {
      pluginState.suggestionElement.remove();
      pluginState.suggestionElement = null;
    }
  }

  function getEmojiSuggestions(query: string): EmojiSuggestion[] {
    if (query.length < 1) return [];
    
    // console.log('Emoji plugin: Searching for query:', query);
    
    const searchTerm = query.replace(/^:/, '');
    if (searchTerm.length === 0) return [];
    
    const allEmojis: EmojiSearchResult[] = emoji.search(searchTerm);
    // console.log('Emoji plugin: Raw search results:', allEmojis);
    
    return allEmojis
      .map((item: EmojiSearchResult, index: number) => ({
        emoji: item.emoji,
        code: `:${item.name}:`,
        score: allEmojis.length - index
      }))
      .sort((a: EmojiSuggestion, b: EmojiSuggestion) => b.score - a.score)
      .slice(0, 20);
  }

  function renderSuggestions(): void {
    if (!pluginState.suggestionElement) return;

    pluginState.suggestionElement.innerHTML = `
      <div class="px-3 py-2 space-y-2">
        <!-- Header with close button -->
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-medium">Emoji matching "${pluginState.currentQuery}"</h3>
          </div>
        </div>

        <!-- Keyboard shortcuts hint -->
        <div class="text-xs text-muted-foreground text-center font-mono">
          ↑↓←→ Navigate • Enter/Space Select • Esc Close
        </div>

        <!-- Emoji suggestions list -->
        <div class="border rounded-lg overflow-hidden bg-muted/30">
          <div class="p-2 max-h-[200px] overflow-y-auto">
            <div class="flex gap-2 overflow-x-auto">
              ${pluginState.suggestions.map((suggestion: EmojiSuggestion, index: number) => `
                <button class="emoji-suggestion-item flex flex-col items-center gap-1 p-2 rounded-md transition-colors min-w-fit whitespace-nowrap hover:bg-muted border border-transparent ${index === pluginState.selectedIndex ? 'bg-muted border-border' : ''}" 
                       data-index="${index}"
                       data-emoji="${suggestion.emoji}"
                       data-code="${suggestion.code}"
                       onclick="window.insertEmojiSuggestion('${suggestion.code}')"
                       onmousedown="event.preventDefault(); window.insertEmojiSuggestion('${suggestion.code}')">
                  <span class="text-xl">${suggestion.emoji}</span>
                  <span class="text-xs font-mono text-muted-foreground">${suggestion.code}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
    
    setTimeout(() => {
      scrollToSelectedEmoji();
    }, 100);
  }

  function scrollToSelectedEmoji(): void {
    if (!pluginState.suggestionElement) return;
    
    const selectedItem = pluginState.suggestionElement.querySelector(`[data-index="${pluginState.selectedIndex}"]`) as HTMLElement;
    
    if (selectedItem) {
      selectedItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  (window as any).insertEmojiSuggestion = (emojiCode: string): void => {
    // console.log('Emoji plugin: Inserting emoji:', emojiCode);
    
    if (pluginState.suggestionElement) {
      hideSuggestions();
    }
    
    const success = insertEmojiAtCursor(emojiCode);
    
    if (!success) {
      console.warn('Emoji plugin: Failed to insert emoji, could not find colon');
    }
    
    setTimeout(() => {
      if (pluginState.editorView && pluginState.editorView.dom) {
        pluginState.editorView.focus();
      }
    }, 0);
  };

  return new Plugin({
    view: (editorView: EditorView) => {
      setEditorView(editorView);
      return {};
    },
    props: {
      decorations: (state: EditorState): DecorationSet => {
        const decorations: Decoration[] = [];
        const doc = state.doc;
        
        doc.descendants((node: ProseMirrorNode, pos: number) => {
          if (node.isText) {
            const text = node.text || '';
            const emojiMatches = text.match(/:[\w+-]+:/g);
            
            if (emojiMatches) {
              emojiMatches.forEach((match: string) => {
                const emojiChar = emoji.emojify(match);
                if (emojiChar !== match) {
                  const start = pos + text.indexOf(match);
                  const end = start + match.length;
                  
                  decorations.push(
                    Decoration.widget(start, () => {
                      const span = document.createElement('span');
                      span.textContent = emojiChar;
                      span.className = 'emoji-widget';
                      span.setAttribute('data-emoji-code', match);
                      span.title = `Emoji: ${match}`;
                      return span;
                    }, { side: -1 })
                  );
                  
                  decorations.push(
                    Decoration.inline(start, end, {
                      class: 'emoji-hidden'
                    })
                  );
                }
              });
            }
          }
        });
        
        return DecorationSet.create(doc, decorations);
      }
    },
    
    appendTransaction: (transactions: readonly Transaction[], oldState: EditorState, newState: EditorState): Transaction | null => {
      const tr = newState.tr;
      let modified = false;
      
      transactions.forEach((transaction: Transaction) => {
        if (transaction.docChanged) {
          newState.doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (node.isText) {
              const text = node.text || '';
              
              const emojiMatches = text.match(/:[\w+-]+:/g);
              if (emojiMatches) {
                emojiMatches.forEach((match: string) => {
                  const emojiChar = emoji.emojify(match);
                  if (emojiChar !== match) {
                    const start = pos + text.indexOf(match);
                    const end = start + match.length;
                    tr.replaceWith(start, end, newState.schema.text(emojiChar));
                    modified = true;
                  }
                });
              }
              
              const partialMatch = text.match(/:[\w]*$/);
              // console.log('Emoji plugin: Text:', text, 'Partial match:', partialMatch);
              
              if (partialMatch && partialMatch[0].length > 1 && pluginState.editorView) {
                // console.log('Emoji plugin: Found partial match:', partialMatch[0]);
                
                if (partialMatch.index !== null && partialMatch.index !== undefined) {
                  const calculatedPos = pos + partialMatch.index;
                  const docSize = pluginState.editorView.state.doc.content.size;
                  
                  if (calculatedPos >= 0 && calculatedPos <= docSize) {
                    const coords = pluginState.editorView.coordsAtPos(calculatedPos);
                    if (coords) {
                      showSuggestions(partialMatch[0], coords);
                    }
                  } else {
                    console.warn('Emoji plugin: Calculated position out of bounds:', calculatedPos, 'doc size:', docSize);
                  }
                } else {
                  console.warn('Emoji plugin: Invalid partialMatch.index:', partialMatch.index);
                }
              } else if (partialMatch && partialMatch[0] === ':' && pluginState.editorView) {
                // console.log('Emoji plugin: Found colon, showing suggestions');
                
                if (partialMatch.index !== null && partialMatch.index !== undefined) {
                  const calculatedPos = pos + partialMatch.index;
                  const docSize = pluginState.editorView.state.doc.content.size;
                  
                  if (calculatedPos >= 0 && calculatedPos <= docSize) {
                    const coords = pluginState.editorView.coordsAtPos(calculatedPos);
                    if (coords) {
                      showSuggestions(':', coords);
                    }
                  } else {
                    console.warn('Emoji plugin: Calculated position out of bounds:', calculatedPos, 'doc size:', docSize);
                  }
                } else {
                  console.warn('Emoji plugin: Invalid partialMatch.index:', partialMatch.index);
                }
              } else {
                const hasColon = text.includes(':');
                if (!hasColon) {
                  hideSuggestions();
                }
              }
            }
          });
        }
      });
      
      return modified ? tr : null;
    },

    keymap: {
      ':': (state: EditorState, dispatch: ((tr: Transaction) => void) | null, view: EditorView): boolean => {
        const { from } = view.state.selection;
        if (from >= 0 && from <= view.state.doc.content.size) {
          const coords = view.coordsAtPos(from);
          if (coords) {
            showSuggestions(':', coords);
          }
        } else {
          console.warn('Emoji plugin: Invalid cursor position for colon key:', from);
        }
        return false;
      },
      'Backspace': (state: EditorState, dispatch: ((tr: Transaction) => void) | null, view: EditorView): boolean => {
        const { from } = view.state.selection;
        const textBefore = view.state.doc.textBetween(Math.max(0, from - 10), from);
        if (!textBefore.includes(':')) {
          hideSuggestions();
        }
        return false;
      },
      'Escape': (): boolean => {
        hideSuggestions();
        return false;
      },
      'ArrowRight': (): boolean => {
        if (pluginState.suggestions.length > 0) {
          pluginState.selectedIndex = Math.min(pluginState.selectedIndex + 1, pluginState.suggestions.length - 1);
          renderOverlay();
          return true;
        }
        return false;
      },
      'ArrowLeft': (): boolean => {
        if (pluginState.suggestions.length > 0) {
          pluginState.selectedIndex = Math.max(pluginState.selectedIndex - 1, 0);
          renderOverlay();
          return true;
        }
        return false;
      },
      'ArrowDown': (): boolean => {
        if (pluginState.suggestions.length > 0) {
          pluginState.selectedIndex = Math.min(pluginState.selectedIndex + 1, pluginState.suggestions.length - 1);
          renderOverlay();
          return true;
        }
        return false;
      },
      'ArrowUp': (): boolean => {
        if (pluginState.suggestions.length > 0) {
          pluginState.selectedIndex = Math.max(pluginState.selectedIndex - 1, 0);
          renderOverlay();
          return true;
        }
        return false;
      },
      'Tab': (): boolean => {
        if (pluginState.suggestions.length > 0) {
          pluginState.selectedIndex = Math.min(pluginState.selectedIndex + 1, pluginState.suggestions.length - 1);
          renderOverlay();
          return true;
        }
        return false;
      },
      'Shift-Tab': (): boolean => {
        if (pluginState.suggestions.length > 0) {
          pluginState.selectedIndex = Math.max(pluginState.selectedIndex - 1, 0);
          renderOverlay();
          return true;
        }
        return false;
      },
      'Home': (): boolean => {
        if (pluginState.suggestions.length > 0) {
          pluginState.selectedIndex = 0;
          renderOverlay();
          return true;
        }
        return false;
      },
      'End': (): boolean => {
        if (pluginState.suggestions.length > 0) {
          pluginState.selectedIndex = pluginState.suggestions.length - 1;
          renderOverlay();
          return true;
        }
        return false;
      },
      'Enter': (): boolean => {
        if (pluginState.suggestions.length > 0 && pluginState.selectedIndex < pluginState.suggestions.length) {
          const selected = pluginState.suggestions[pluginState.selectedIndex];
          insertEmojiAtCursor(selected.code);
          hideSuggestions();
          return true;
        }
        return false;
      },
      'Space': (): boolean => {
        if (pluginState.suggestions.length > 0 && pluginState.selectedIndex < pluginState.suggestions.length) {
          const selected = pluginState.suggestions[pluginState.selectedIndex];
          insertEmojiAtCursor(selected.code);
          hideSuggestions();
          return true;
        }
        return false;
      },
    }
  });
} 