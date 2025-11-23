import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

describe('Card Components', () => {
  it('should render Card with children and custom className', () => {
    const { container } = render(<Card className="custom-class"><div>Child Content</div></Card>);
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveTextContent('Child Content');
  });

  it('should render CardHeader with children and custom className', () => {
    const { container } = render(<CardHeader className="custom-class"><div>Header Content</div></CardHeader>);
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveTextContent('Header Content');
  });

  it('should render CardTitle with children and custom className', () => {
    const { container } = render(<CardTitle className="custom-class"><div>Title Content</div></CardTitle>);
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveTextContent('Title Content');
  });

  it('should render CardDescription with children and custom className', () => {
    const { container } = render(<CardDescription className="custom-class"><div>Description Content</div></CardDescription>);
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveTextContent('Description Content');
  });

  it('should render CardContent with children and custom className', () => {
    const { container } = render(<CardContent className="custom-class"><div>Content</div></CardContent>);
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveTextContent('Content');
  });

  it('should render CardFooter with children and custom className', () => {
    const { container } = render(<CardFooter className="custom-class"><div>Footer Content</div></CardFooter>);
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveTextContent('Footer Content');
  });
});
