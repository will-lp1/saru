'use client';

import { useState, useEffect } from 'react';

/**
 * A hook to check if the current viewport width is less than a certain breakpoint
 * @param breakpoint - The width breakpoint to check against (in pixels)
 * @returns boolean indicating if viewport is less than the breakpoint
 */
export function useBreakpoint(breakpoint: number): boolean {
  const [isBelowBreakpoint, setIsBelowBreakpoint] = useState(false);

  useEffect(() => {
    // Initial check
    const checkWidth = () => {
      setIsBelowBreakpoint(window.innerWidth < breakpoint);
    };
    
    // Set on mount
    checkWidth();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkWidth);
    
    // Clean up
    return () => window.removeEventListener('resize', checkWidth);
  }, [breakpoint]);

  return isBelowBreakpoint;
} 