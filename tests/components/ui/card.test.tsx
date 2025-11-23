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
    render(<Card><div>Child content</div></Card>);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render CardHeader with children', () => {
    render(<CardHeader><div>Header content</div></CardHeader>);
    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('should render CardTitle with children', () => {
    render(<CardTitle><div>Title content</div></CardTitle>);
    expect(screen.getByText('Title content')).toBeInTheDocument();
  });

  it('should render CardDescription with children', () => {
    render(<CardDescription><div>Description content</div></CardDescription>);
    expect(screen.getByText('Description content')).toBeInTheDocument();
  });

  it('should render CardContent with children', () => {
    render(<CardContent><div>Content</div></CardContent>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should render CardFooter with children', () => {
    render(<CardFooter><div>Footer content</div></CardFooter>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });
});
