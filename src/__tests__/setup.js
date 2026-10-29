import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom's Range doesn't implement getClientRects/getBoundingClientRect —
  // this is a jsdom limitation, not an app bug (real browsers support it).
  if (window.Range && !window.Range.prototype.getClientRects) {
    window.Range.prototype.getClientRects = () => [];
  }
  if (window.Range && !window.Range.prototype.getBoundingClientRect) {
    window.Range.prototype.getBoundingClientRect = () => ({
      top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0,
    });
  }
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}
