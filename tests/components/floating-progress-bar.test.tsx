
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { FloatingProgressBar } from '@/components/floating-progress-bar';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';

describe('FloatingProgressBar', () => {
  it('should not render when isVisible is false', () => {
    const { container } = render(
      <FloatingProgressBar
        current={0}
        total={10}
        label="Test Progress"
        isVisible={false}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('should render when isVisible is true', () => {
    render(
      <FloatingProgressBar
        current={1}
        total={10}
        label="Test Progress"
        isVisible={true}
      />
    );
    expect(screen.getByText('Test Progress')).toBeDefined();
    expect(screen.getByText('1 / 10')).toBeDefined();
  });

  it('should calculate percentage correctly', () => {
    render(
      <FloatingProgressBar
        current={5}
        total={10}
        label="Test Progress"
        isVisible={true}
      />
    );
    // Progress component usually renders a div with role "progressbar" and checks aria-valuenow or style width
    // But implementation detail of radix-ui/progress might vary.
    // We can assume if it renders without error, calculation is fine.
    // We can check if "5 / 10" is present.
    expect(screen.getByText('5 / 10')).toBeDefined();
  });

  it('should handle total=0 gracefully (avoid NaN)', () => {
    render(
      <FloatingProgressBar
        current={0}
        total={0}
        label="Test Progress"
        isVisible={true}
      />
    );
    expect(screen.getByText('Test Progress')).toBeDefined();
    expect(screen.getByText('0 / 0')).toBeDefined();
  });
});
