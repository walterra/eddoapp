// Polyfill for PouchDB browser compatibility in Node test environment
if (typeof global !== 'undefined') {
  const g = global as typeof globalThis;

  // PouchDB-browser expects self to be available
  if (!g.self) {
    g.self = global as typeof globalThis & Window;
  }
}
