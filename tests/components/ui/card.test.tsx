import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { describe, it, expect } from 'vitest';

describe('Card component', () => {
  it('renders the card component', () => {
    render(<Card>Test Card</Card>);
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });

  it('renders the card header', () => {
    render(<CardHeader>Test Header</CardHeader>);
    expect(screen.getByText('Test Header')).toBeInTheDocument();
  });

    it('renders the card footer', () => {
    render(<CardFooter>Test Footer</CardFooter>);
    expect(screen.getByText('Test Footer')).toBeInTheDocument();
  });

  it('renders the card title', () => {
    render(<CardTitle>Test Title</CardTitle>);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders the card description', () => {
    render(<CardDescription>Test Description</CardDescription>);
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('renders the card content', () => {
    render(<CardContent>Test Content</CardContent>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});
