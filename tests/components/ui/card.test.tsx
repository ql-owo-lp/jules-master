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
    render(<Card><div>Child Content</div></Card>);
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('should render CardHeader with children', () => {
    render(<CardHeader><div>Header Content</div></CardHeader>);
    expect(screen.getByText('Header Content')).toBeInTheDocument();
  });

  it('should render CardFooter with children', () => {
    render(<CardFooter><div>Footer Content</div></CardFooter>);
    expect(screen.getByText('Footer Content')).toBeInTheDocument();
  });

  it('should render CardTitle with children', () => {
    render(<CardTitle><div>Title Content</div></CardTitle>);
    expect(screen.getByText('Title Content')).toBeInTheDocument();
  });

  it('should render CardDescription with children', () => {
    render(<CardDescription><div>Description Content</div></CardDescription>);
    expect(screen.getByText('Description Content')).toBeInTheDocument();
  });

  it('should render CardContent with children', () => {
    render(<CardContent><div>Content</div></CardContent>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should apply custom className to Card', () => {
    render(<Card className="custom-class" />);
    expect(document.querySelector('.custom-class')).toBeInTheDocument();
  });
});
