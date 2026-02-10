import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SourceSelection } from '@/components/source-selection';
import { vi, describe, it, expect } from 'vitest';
import type { Source } from '@/lib/types';

// Mock dependencies
vi.mock('@/app/sessions/actions', () => ({
  listSources: vi.fn(),
}));

vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: vi.fn().mockReturnValue(['default', vi.fn()]),
}));

const mockSources: Source[] = [
  {
    name: 'source-1',
    id: '1',
    githubRepo: {
      owner: 'owner1',
      repo: 'public-repo',
      isPrivate: false,
      branches: [],
      defaultBranch: { displayName: 'main' },
    },
  },
  {
    name: 'source-2',
    id: '2',
    githubRepo: {
      owner: 'owner1',
      repo: 'private-repo',
      isPrivate: true,
      branches: [],
      defaultBranch: { displayName: 'main' },
    },
  },
];

describe('SourceSelection', () => {
  it('renders public and private icons correctly', async () => {
    const onSourceSelected = vi.fn();
    const onSourcesLoaded = vi.fn();

    const { container } = render(
      <SourceSelection
        onSourceSelected={onSourceSelected}
        sources={mockSources}
        onSourcesLoaded={onSourcesLoaded}
      />
    );

    // Open the combobox
    const combobox = screen.getByRole('combobox');
    fireEvent.click(combobox);

    // Verify public repo option
    const publicRepoText = screen.getByText('owner1/public-repo');
    expect(publicRepoText).toBeInTheDocument();

    // Verify private repo option
    const privateRepoText = screen.getByText('owner1/private-repo');
    expect(privateRepoText).toBeInTheDocument();

    // Check for icons by class name
    // Lucide icons usually have a class like "lucide-lock" or "lucide-globe"
    // However, exact class depends on how lucide is used/compiled.
    // We can check if there are SVGs rendered next to the text.

    // The private option should have a sibling SVG (Lock)
    const privateIcon = privateRepoText.previousSibling;
    expect(privateIcon).toBeInTheDocument();
    expect(privateIcon?.nodeName).toBe('svg');
    expect(privateIcon).toHaveClass('lucide-lock');

    // The public option should have a sibling SVG (Globe)
    const publicIcon = publicRepoText.previousSibling;
    expect(publicIcon).toBeInTheDocument();
    expect(publicIcon?.nodeName).toBe('svg');
    expect(publicIcon).toHaveClass('lucide-globe');
  });
});
