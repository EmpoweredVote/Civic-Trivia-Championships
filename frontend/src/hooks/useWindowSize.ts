import { useState, useEffect } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

export function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    // `resize` fires many times per drag. Coalesce to at most one state update per frame,
    // and drop updates that don't actually change the size, so consumers (and the canvas
    // animation loops downstream of them) aren't re-rendered for nothing.
    let rafId = 0;

    const measure = () => {
      rafId = 0;
      const width = window.innerWidth;
      const height = window.innerHeight;
      setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
    };

    const handleResize = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(measure);
    };

    window.addEventListener('resize', handleResize);
    // Measure once immediately in case the initial value was the SSR fallback
    measure();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return size;
}
