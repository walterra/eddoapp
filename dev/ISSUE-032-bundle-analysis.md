# ISSUE-011: Configure Bundle Analysis and Performance Monitoring

**Priority:** Medium  
**Category:** Performance  
**Estimated Effort:** 1-2 days  
**Impact:** Medium - Enables optimization and performance tracking  

## Description

The application currently lacks bundle analysis and performance monitoring tools, making it difficult to identify optimization opportunities and track performance regressions. This is essential for maintaining good performance as the application grows.

## Current State

### Missing Analysis Tools
- No bundle size analysis or visualization
- No performance monitoring in production
- No tracking of loading times or user metrics
- No alerts for performance regressions
- No optimization insights or recommendations

### Performance Blind Spots
- Unknown bundle composition and size
- No visibility into third-party dependency impact
- No tracking of Core Web Vitals
- No performance budgets or thresholds
- No regression detection in CI/CD

## Implementation Strategy

### 1. Bundle Analysis Tools
```bash
# Add bundle analysis dependencies
pnpm add -D webpack-bundle-analyzer vite-bundle-analyzer
pnpm add -D rollup-plugin-visualizer
```

### 2. Vite Bundle Analysis Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    // Bundle analysis plugin
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          vendor: ['react', 'react-dom'],
          pouchdb: ['pouchdb-browser'],
          utils: ['date-fns', 'lodash-es'],
          ui: ['flowbite', 'flowbite-react'],
        },
      },
    },
    // Performance budgets
    chunkSizeWarningLimit: 500,
    reportCompressedSize: true,
  },
  // Performance monitoring in dev
  server: {
    // Enable performance monitoring
    middlewareMode: false,
  },
});
```

### 3. Performance Monitoring Setup
```typescript
// src/utils/performance.ts
interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

export class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};

  constructor() {
    this.observeWebVitals();
  }

  private observeWebVitals() {
    // First Contentful Paint
    this.observePerformanceEntry('first-contentful-paint', (entry) => {
      this.metrics.fcp = entry.startTime;
    });

    // Largest Contentful Paint
    this.observeLCP();

    // First Input Delay
    this.observeFID();

    // Cumulative Layout Shift
    this.observeCLS();

    // Time to First Byte
    this.observeTTFB();
  }

  private observeLCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.lcp = lastEntry.startTime;
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  }

  private observeFID() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.metrics.fid = entry.processingStart - entry.startTime;
      });
    });

    observer.observe({ entryTypes: ['first-input'] });
  }

  private observeCLS() {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          this.metrics.cls = clsValue;
        }
      });
    });

    observer.observe({ entryTypes: ['layout-shift'] });
  }

  private observeTTFB() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.metrics.ttfb = entry.responseStart - entry.requestStart;
      });
    });

    observer.observe({ entryTypes: ['navigation'] });
  }

  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  reportMetrics() {
    const metrics = this.getMetrics();
    
    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.table(metrics);
    }
    
    // In production, send to analytics service
    if (process.env.NODE_ENV === 'production') {
      this.sendToAnalytics(metrics);
    }
  }

  private sendToAnalytics(metrics: Partial<PerformanceMetrics>) {
    // Future: Send to analytics service (Google Analytics, etc.)
    // For now, just store in localStorage for debugging
    localStorage.setItem('performance-metrics', JSON.stringify({
      ...metrics,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }));
  }
}
```

## Acceptance Criteria

- [ ] Bundle analysis generates visual reports
- [ ] Performance metrics are tracked and reported
- [ ] Bundle size budgets are enforced
- [ ] Performance regressions are detected in CI/CD
- [ ] Core Web Vitals are monitored
- [ ] Bundle composition is optimized
- [ ] Performance data is accessible for analysis
- [ ] Alerts are configured for performance thresholds

## Implementation Plan

### Phase 1: Bundle Analysis Setup (Day 1)

1. **Install and configure bundle analysis tools**
   ```bash
   pnpm add -D rollup-plugin-visualizer
   pnpm add -D vite-bundle-analyzer
   ```

2. **Update Vite configuration**
   ```typescript
   // Enhanced vite.config.ts with analysis
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   import { visualizer } from 'rollup-plugin-visualizer';

   export default defineConfig({
     plugins: [
       react(),
       visualizer({
         filename: 'dist/bundle-analysis.html',
         open: process.env.ANALYZE_BUNDLE === 'true',
         gzipSize: true,
         brotliSize: true,
         template: 'treemap', // or 'sunburst', 'network'
       }),
     ],
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             'vendor-react': ['react', 'react-dom'],
             'vendor-pouchdb': ['pouchdb-browser'],
             'vendor-ui': ['flowbite', 'flowbite-react'],
             'vendor-utils': ['date-fns', 'lodash-es'],
           },
         },
       },
       reportCompressedSize: true,
       chunkSizeWarningLimit: 500,
     },
   });
   ```

3. **Add bundle analysis scripts**
   ```json
   // package.json
   {
     "scripts": {
       "build:analyze": "ANALYZE_BUNDLE=true pnpm build",
       "analyze": "pnpm build:analyze && open dist/bundle-analysis.html"
     }
   }
   ```

### Phase 2: Performance Monitoring (Day 1-2)

4. **Implement performance monitoring**
   ```typescript
   // src/utils/performanceMonitor.ts
   // (Implementation from above)
   ```

5. **Integrate with React app**
   ```typescript
   // src/eddo.tsx
   import { PerformanceMonitor } from './utils/performanceMonitor';

   function App() {
     useEffect(() => {
       const monitor = new PerformanceMonitor();
       
       // Report metrics after page load
       window.addEventListener('load', () => {
         setTimeout(() => monitor.reportMetrics(), 2000);
       });

       return () => {
         // Cleanup observers
       };
     }, []);

     return (
       // App content
     );
   }
   ```

6. **Create performance dashboard component**
   ```typescript
   // src/components/PerformanceDashboard.tsx (dev only)
   function PerformanceDashboard() {
     const [metrics, setMetrics] = useState<Partial<PerformanceMetrics>>({});

     useEffect(() => {
       const stored = localStorage.getItem('performance-metrics');
       if (stored) {
         setMetrics(JSON.parse(stored));
       }
     }, []);

     if (process.env.NODE_ENV !== 'development') {
       return null;
     }

     return (
       <div className="performance-dashboard">
         <h3>Performance Metrics</h3>
         <div className="metrics-grid">
           <div className="metric">
             <label>First Contentful Paint</label>
             <span>{metrics.fcp?.toFixed(2)}ms</span>
           </div>
           <div className="metric">
             <label>Largest Contentful Paint</label>
             <span>{metrics.lcp?.toFixed(2)}ms</span>
           </div>
           <div className="metric">
             <label>First Input Delay</label>
             <span>{metrics.fid?.toFixed(2)}ms</span>
           </div>
           <div className="metric">
             <label>Cumulative Layout Shift</label>
             <span>{metrics.cls?.toFixed(4)}</span>
           </div>
         </div>
       </div>
     );
   }
   ```

### Phase 3: CI/CD Integration (Day 2)

7. **Add performance budgets to CI**
   ```yaml
   # .github/workflows/performance.yml
   name: Performance Check
   
   on:
     pull_request:
       branches: [main]
   
   jobs:
     performance:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '18'
             cache: 'pnpm'
         
         - run: pnpm install
         - run: pnpm build
         
         # Bundle size check
         - name: Bundle Size Check
           run: |
             BUNDLE_SIZE=$(du -sk dist | cut -f1)
             echo "Bundle size: ${BUNDLE_SIZE}KB"
             if [ $BUNDLE_SIZE -gt 2048 ]; then
               echo "Bundle size exceeded 2MB limit"
               exit 1
             fi
         
         # Generate bundle analysis
         - name: Generate Bundle Analysis
           run: pnpm build:analyze
         
         - name: Upload Bundle Analysis
           uses: actions/upload-artifact@v4
           with:
             name: bundle-analysis
             path: dist/bundle-analysis.html
   ```

8. **Add performance monitoring to tests**
   ```typescript
   // src/__tests__/performance.test.ts
   describe('Performance', () => {
     it('should load main page within performance budget', async () => {
       const startTime = performance.now();
       
       render(<App />);
       
       await waitFor(() => {
         expect(screen.getByText('Eddo')).toBeInTheDocument();
       });
       
       const loadTime = performance.now() - startTime;
       expect(loadTime).toBeLessThan(1000); // 1 second budget
     });

     it('should not have memory leaks', async () => {
       const initialMemory = (performance as any).memory?.usedJSHeapSize;
       
       const { unmount } = render(<TodoBoard />);
       
       // Force garbage collection if available
       if (global.gc) {
         global.gc();
       }
       
       unmount();
       
       const finalMemory = (performance as any).memory?.usedJSHeapSize;
       
       // Memory should not increase significantly
       if (initialMemory && finalMemory) {
         expect(finalMemory - initialMemory).toBeLessThan(1024 * 1024); // 1MB
       }
     });
   });
   ```

## Bundle Optimization Strategies

### 1. Code Splitting
```typescript
// Lazy load components
const TodoBoard = lazy(() => import('./components/TodoBoard'));
const Settings = lazy(() => import('./components/Settings'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<TodoBoard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### 2. Tree Shaking Optimization
```typescript
// vite.config.ts - ensure proper tree shaking
export default defineConfig({
  build: {
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
      },
    },
  },
});
```

### 3. Dynamic Imports
```typescript
// Only load heavy utilities when needed
async function exportTodos() {
  const { generatePDF } = await import('./utils/pdfGenerator');
  return generatePDF(todos);
}
```

## Performance Thresholds

### Bundle Size Budgets
- **Main bundle:** < 500KB
- **Vendor bundle:** < 1MB
- **Total bundle:** < 2MB
- **Individual chunks:** < 250KB

### Core Web Vitals Targets
- **First Contentful Paint:** < 1.8s
- **Largest Contentful Paint:** < 2.5s
- **First Input Delay:** < 100ms
- **Cumulative Layout Shift:** < 0.1

### Custom Metrics
- **Time to Interactive:** < 3s
- **Bundle Parse Time:** < 200ms
- **Memory Usage:** < 50MB

## Monitoring Dashboard

### Development Dashboard
```typescript
// Performance debug panel (dev only)
function PerformanceDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState({});

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="performance-debug-panel">
      <button onClick={() => setIsOpen(!isOpen)}>
        📊 Performance
      </button>
      {isOpen && (
        <div className="debug-panel">
          <h4>Bundle Analysis</h4>
          <button onClick={() => window.open('/dist/bundle-analysis.html')}>
            View Bundle Report
          </button>
          
          <h4>Core Web Vitals</h4>
          <PerformanceMetrics />
          
          <h4>Memory Usage</h4>
          <MemoryMonitor />
        </div>
      )}
    </div>
  );
}
```

## Dependencies

- Can be implemented independently
- Benefits from ISSUE-006 (memory leak fix) for accurate memory monitoring
- Complements other performance improvements

## Definition of Done

- Bundle analysis generates visual reports showing composition
- Performance metrics are tracked for Core Web Vitals
- CI/CD pipeline enforces bundle size budgets
- Performance regressions trigger alerts
- Development dashboard shows real-time metrics
- Bundle optimization strategies are documented
- Performance thresholds are defined and monitored
- Memory usage tracking is implemented
- Code splitting reduces initial bundle size
- Tree shaking eliminates unused code