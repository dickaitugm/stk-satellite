/**
 * Custom hook for canvas resize with 2:1 aspect ratio
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_DIMENSION = 200; // Minimum size untuk dianggap valid
const READY_DELAY = 200;   // Delay sebelum mark ready (ms)

/**
 * Hook to observe container resize and maintain 2:1 aspect ratio
 * @returns {Object} { containerRef, dimensions, isReady }
 */
export const useResizeObserver = () => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);
  const readyTimeoutRef = useRef(null);
  const stableDimensionsRef = useRef(null);

  const calculateDimensions = useCallback(() => {
    if (!containerRef.current) return null;
    
    const parent = containerRef.current;
    const availableWidth = parent.clientWidth;
    const availableHeight = parent.clientHeight;
    
    // Pastikan dimensi valid
    if (availableWidth < MIN_DIMENSION || availableHeight < MIN_DIMENSION) {
      return null;
    }
    
    const targetRatio = 2 / 1;
    let newWidth = availableWidth;
    let newHeight = availableWidth / targetRatio;
    
    if (newHeight > availableHeight) {
      newHeight = availableHeight;
      newWidth = availableHeight * targetRatio;
    }
    
    return { width: Math.floor(newWidth), height: Math.floor(newHeight) };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const newDimensions = calculateDimensions();
      
      if (!newDimensions) {
        // Dimensi belum valid, reset ready state
        if (readyTimeoutRef.current) {
          clearTimeout(readyTimeoutRef.current);
          readyTimeoutRef.current = null;
        }
        setIsReady(false);
        return;
      }
      
      // Update dimensions
      setDimensions(newDimensions);
      stableDimensionsRef.current = newDimensions;
      
      // Reset ready timeout setiap ada resize
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
      }
      
      // Set ready setelah dimensi stabil selama READY_DELAY
      readyTimeoutRef.current = setTimeout(() => {
        // Verifikasi dimensi masih sama
        const currentDimensions = calculateDimensions();
        if (currentDimensions && 
            currentDimensions.width === stableDimensionsRef.current.width &&
            currentDimensions.height === stableDimensionsRef.current.height) {
          console.log(`📐 Canvas READY: ${currentDimensions.width} x ${currentDimensions.height}`);
          setIsReady(true);
        }
      }, READY_DELAY);
    };

    // Multiple attempts untuk initial calculation
    const attempts = [0, 50, 100, 200];
    const timeouts = attempts.map(delay => 
      setTimeout(handleResize, delay)
    );

    const resizeObserver = new ResizeObserver(() => {
      // Reset ready saat resize
      setIsReady(false);
      handleResize();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      timeouts.forEach(t => clearTimeout(t));
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [calculateDimensions]);

  return { containerRef, dimensions, isReady };
};
