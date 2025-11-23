
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

describe('Card', () => {
  it('should render with children and a custom class', () => {
    const { getByText } = render(<Card className="my-custom-class">Hello World</Card>);
    const cardElement = getByText('Hello World');
    expect(cardElement).toBeInTheDocument();
    expect(cardElement).toHaveClass('my-custom-class');
  });
});

describe('CardHeader', () => {
  it('should render with children and a custom class', () => {
    const { getByText } = render(<CardHeader className="my-custom-class">Header</CardHeader>);
    const headerElement = getByText('Header');
    expect(headerElement).toBeInTheDocument();
    expect(headerElement).toHaveClass('my-custom-class');
  });
});

describe('CardFooter', () => {
  it('should render with children and a custom class', () => {
    const { getByText } = render(<CardFooter className="my-custom-class">Footer</CardFooter>);
    const footerElement = getByText('Footer');
    expect(footerElement).toBeInTheDocument();
    expect(footerElement).toHaveClass('my-custom-class');
  });
});

describe('CardTitle', () => {
  it('should render with children and a custom class', () => {
    const { getByText } = render(<CardTitle className="my-custom-class">Title</CardTitle>);
    const titleElement = getByText('Title');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveClass('my-custom-class');
  });
});

describe('CardDescription', () => {
  it('should render with children and a custom class', () => {
    const { getByText } = render(<CardDescription className="my-custom-class">Description</CardDescription>);
    const descriptionElement = getByText('Description');
    expect(descriptionElement).toBeInTheDocument();
    expect(descriptionElement).toHaveClass('my-custom-class');
  });
});

describe('CardContent', () => {
  it('should render with children and a custom class', () => {
    const { getByText } = render(<CardContent className="my-custom-class">Content</CardContent>);
    const contentElement = getByText('Content');
    expect(contentElement).toBeInTheDocument();
    expect(contentElement).toHaveClass('my-custom-class');
  });
});
