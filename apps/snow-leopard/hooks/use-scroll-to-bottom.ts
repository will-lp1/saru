import { useEffect, useRef, useState, type RefObject } from 'react';

export function useScrollToBottom<T extends HTMLElement>(): {
  isAtBottom: boolean;
  scrollToBottom: () => void;
  containerRef: RefObject<T>;
  endRef: RefObject<T>;
} {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = () => {
    const end = endRef.current;
    if (end) {
      end.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (container && end) {
      const observer = new MutationObserver(() => {
        end.scrollIntoView({ behavior: 'instant', block: 'end' });
      });

      const handleScroll = () => {
        if (container) {
          const { scrollTop, scrollHeight, clientHeight } = container;
          const atBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
          setIsAtBottom(atBottom);
        }
      };

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      container.addEventListener('scroll', handleScroll);
      handleScroll(); // Check initial state

      return () => {
        observer.disconnect();
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  return { isAtBottom, scrollToBottom, containerRef, endRef };
}
