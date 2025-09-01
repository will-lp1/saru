'use client';

import { useState, useEffect, ReactNode } from 'react';
import { GripVertical } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useSidebarWithSide } from '@/components/ui/sidebar';

interface ResizablePanelProps {
  children: ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  className?: string;
  side?: 'left' | 'right';
}

export function ResizablePanel({
  children,
  defaultSize = 400,
  minSize = 300,
  maxSize = 600,
  className,
  side = 'right',
}: ResizablePanelProps) {
  const [size, setSize] = useState(defaultSize);
  const [isResizing, setIsResizing] = useState(false);

  const { open: isOpen } = useSidebarWithSide(side);

  // Handle mouse down on resize handle
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Save size to localStorage
  useEffect(() => {
    try {
      const savedSize = localStorage.getItem(`resizable-panel-size-${side}`);
      if (savedSize) {
        const parsedSize = parseInt(savedSize);
        if (!isNaN(parsedSize) && parsedSize >= minSize && parsedSize <= maxSize) {
          setSize(parsedSize);
        }
      }
    } catch (error) {
      console.error('Failed to load size from localStorage:', error);
    }
  }, [minSize, maxSize, side]);

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      // Calculate the new width based on side of the panel
      let newSize;
      if (side === 'right') {
        newSize = window.innerWidth - e.clientX;
      } else {
        newSize = e.clientX;
      }
      
      // Apply constraints
      const constrainedSize = Math.max(minSize, Math.min(maxSize, newSize));
      setSize(constrainedSize);
      
      // Save to localStorage
      try {
        localStorage.setItem(`resizable-panel-size-${side}`, constrainedSize.toString());
      } catch (error) {
        console.error('Failed to save size to localStorage:', error);
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Add cursor styling to body when resizing
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Reset cursor
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, minSize, maxSize, side]);



  return (
    <div className="flex flex-row h-full">
      {/* Left side panel */}
      {side === 'left' && (
        <div 
          className={cn("h-full flex-shrink-0", className)}
          style={{ width: `${size}px` }}
        >
          {children}
        </div>
      )}
      
      {/* Resize handle - only show for right panel when open or animating */}
      {(side === 'left' || isOpen) && (
        <div
          onMouseDown={startResizing}
          className={cn(
            'group relative flex w-2.5 cursor-col-resize items-center justify-center rounded-full',
            'transition-colors',
            isResizing
              ? 'bg-primary/30'
              : 'hover:bg-primary/10 dark:hover:bg-primary/20'
          )}
        >
          <GripVertical
            className={cn(
              'h-4 w-4 text-muted-foreground/40 transition-colors',
              isResizing
                ? 'text-primary'
                : 'group-hover:text-primary/80 dark:group-hover:text-primary'
            )}
          />
        </div>
      )}
      
      {side === 'right' && (
        <>
          <div
            className="relative h-full bg-transparent transition-all duration-200 ease-linear"
            style={{ width: isOpen ? `${size}px` : '0px' }}
          />
          <div
            className={cn(
              'fixed top-0 h-full transition-all duration-200 ease-linear',
              className
            )}
            style={{
              width: `${size}px`,
              right: isOpen ? '0px' : `-${size}px`,
            }}
          >
            <div className="h-full w-full">{children}</div>
          </div>
        </>
      )}
    </div>
  );
}