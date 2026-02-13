import { useEffect } from 'react';
import { onCLS, onINP, onLCP } from 'web-vitals';

export function useWebVitals() {
  useEffect(() => {
    const logMetric = (metric: { name: string; value: number; rating: string }) => {
      if (import.meta.env.DEV) {
        const emoji = metric.rating === 'good' ? '[GOOD]' : metric.rating === 'needs-improvement' ? '[NEEDS IMPROVEMENT]' : '[POOR]';
        console.log(`[Web Vitals] ${metric.name}: ${Math.round(metric.value)} ${emoji}`);
      }
    };

    onCLS(logMetric);
    onINP(logMetric);
    onLCP(logMetric);
  }, []);
}
