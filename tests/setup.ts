import React from 'react';
import '@testing-library/jest-dom';

global.React = React;

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserver);

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();
