// Polyfill for PouchDB browser compatibility in Node test environment
if (typeof global !== 'undefined') {
  const g = global as typeof globalThis;

  // PouchDB-browser expects self to be available
  if (!g.self) {
    g.self = global as typeof globalThis & Window;
  }

  // Make React globally available for JSX
  if (!g.React) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    g.React = require('react');
  }
}
