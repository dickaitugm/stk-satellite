/**
 * Custom hook for canvas resize with 2:1 aspect ratio
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Hook to observe container resize and maintain 2:1 aspect ratio
 * @returns {Object} { containerRef, dimensions }
 */
export const useResizeObserver = () => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const parent = containerRef.current;
      const availableWidth = parent.clientWidth;
      const availableHeight = parent.clientHeight;
      
      const targetRatio = 2 / 1;
      let newWidth = availableWidth;
      let newHeight = availableWidth / targetRatio;
      
      if (newHeight > availableHeight) {
        newHeight = availableHeight;
        newWidth = availableHeight * targetRatio;
      }
      
      setDimensions({ width: newWidth, height: newHeight });
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, []);

  return { containerRef, dimensions };
};
