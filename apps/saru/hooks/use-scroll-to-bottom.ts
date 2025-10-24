import { useEffect, useRef, useCallback, type RefObject } from 'react';

const AUTO_SCROLL_IGNORE_ATTR = 'data-auto-scroll-ignore';

function getDistanceFromBottom(container: HTMLElement): number {
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
  () => void,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateStickiness = () => {
      shouldStickToBottomRef.current = getDistanceFromBottom(container) <= 80;
    };

    container.addEventListener('scroll', updateStickiness, { passive: true });
    updateStickiness();

    return () => {
      container.removeEventListener('scroll', updateStickiness);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (!container || !end) {
      return;
    }

    const observer = new MutationObserver(mutations => {
      const shouldScroll = mutations.some(mutation => {
        const targetElement = mutation.target instanceof Element
          ? mutation.target
          : mutation.target.parentElement;

        if (targetElement?.closest(`[${AUTO_SCROLL_IGNORE_ATTR}]`)) {
          return false;
        }

        for (const node of mutation.addedNodes) {
          if (node instanceof Element && node.closest(`[${AUTO_SCROLL_IGNORE_ATTR}]`)) {
            return false;
          }
        }

        return true;
      });

      if (shouldScroll && shouldStickToBottomRef.current) {
        end.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
          inline: 'nearest',
        });
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (!container || !end) return;

    if (getDistanceFromBottom(container) > 100) {
      end.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest',
      });
    }
  }, []);

  return [containerRef, endRef, scrollToBottom];
}
