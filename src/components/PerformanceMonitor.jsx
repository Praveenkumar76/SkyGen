import { useEffect } from 'react';

const PerformanceMonitor = () => {
  useEffect(() => {
    // Monitor Core Web Vitals
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          console.log('Page Load Time:', entry.loadEventEnd - entry.loadEventStart, 'ms');
        }
        if (entry.entryType === 'paint') {
          if (entry.name === 'first-contentful-paint') {
            console.log('First Contentful Paint:', entry.startTime, 'ms');
          }
          if (entry.name === 'largest-contentful-paint') {
            console.log('Largest Contentful Paint:', entry.startTime, 'ms');
          }
        }
      }
    });

    observer.observe({ entryTypes: ['navigation', 'paint'] });

    // Monitor resource loading times
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          console.log(`Resource ${entry.name} loaded in:`, entry.duration, 'ms');
        }
      }
    });

    resourceObserver.observe({ entryTypes: ['resource'] });

    return () => {
      observer.disconnect();
      resourceObserver.disconnect();
    };
  }, []);

  return null; // This component doesn't render anything
};

export default PerformanceMonitor;
