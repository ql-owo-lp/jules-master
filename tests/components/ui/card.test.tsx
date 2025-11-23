import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

describe('Card Components', () => {
  it('should render Card with children', () => {
    render(<Card><div>child</div></Card>);
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('should render CardHeader with children', () => {
    render(<CardHeader><div>header</div></CardHeader>);
    expect(screen.getByText('header')).toBeInTheDocument();
  });

  it('should render CardTitle with children', () => {
    render(<CardTitle><div>title</div></CardTitle>);
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('should render CardDescription with children', () => {
    render(<CardDescription><div>description</div></CardDescription>);
    expect(screen.getByText('description')).toBeInTheDocument();
  });

  it('should render CardContent with children', () => {
    render(<CardContent><div>content</div></CardContent>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('should render CardFooter with children', () => {
    render(<CardFooter><div>footer</div></CardFooter>);
    expect(screen.getByText('footer')).toBeInTheDocument();
  });

  it('should apply custom className to Card', () => {
    const { container } = render(<Card className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should apply custom className to CardHeader', () => {
    const { container } = render(<CardHeader className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should apply custom className to CardTitle', () => {
    const { container } = render(<CardTitle className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should apply custom className to CardDescription', () => {
    const { container } = render(<CardDescription className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should apply custom className to CardContent', () => {
    const { container } = render(<CardContent className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should apply custom className to CardFooter', () => {
    const { container } = render(<CardFooter className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
