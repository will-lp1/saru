import { useEffect, useRef, useCallback, type RefObject } from 'react';

const AUTO_SCROLL_IGNORE_ATTR = 'data-auto-scroll-ignore';

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
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;

      // Treat being within 80px of the bottom as "stick to bottom"
      shouldStickToBottomRef.current = distanceFromBottom <= 80;
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
      const hasRelevantMutation = mutations.some(mutation => {
        const targetElement =
          mutation.target instanceof Element
            ? mutation.target
            : mutation.target instanceof CharacterData
              ? mutation.target.parentElement
              : null;

        if (
          targetElement &&
          targetElement.closest(`[${AUTO_SCROLL_IGNORE_ATTR}]`)
        ) {
          return false;
        }

        for (const node of mutation.addedNodes) {
          if (
            node instanceof Element &&
            node.closest(`[${AUTO_SCROLL_IGNORE_ATTR}]`)
          ) {
            return false;
          }
        }

        return true;
      });

      if (hasRelevantMutation && shouldStickToBottomRef.current) {
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
    const end = endRef.current;
    if (end) {
      end.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest',
      });
    }
  }, []);

  return [containerRef, endRef, scrollToBottom];
}
