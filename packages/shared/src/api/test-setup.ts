import { vi } from 'vitest';

// Mock browser globals for PouchDB-browser
if (typeof global !== 'undefined') {
  const g = global as any;
  
  if (!g.self) {
    g.self = global;
  }
  
  // Mock indexedDB if not available
  if (!g.indexedDB) {
    g.indexedDB = {};
  }
  
  // Mock window object
  if (!g.window) {
    g.window = global;
  }
  
  // Mock navigator
  if (!g.navigator) {
    g.navigator = {
      userAgent: 'node.js',
    };
  }
  
  // Mock location
  if (!g.location) {
    g.location = {
      href: 'http://localhost',
      origin: 'http://localhost',
    };
  }
  
  // Mock other browser APIs that might be needed
  if (!g.localStorage) {
    g.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
  }
}
