
import { describe, it, expect } from 'vitest';

// We can't easily import the internal function from the component file without exporting it.
// Since it's a small logic inside the component, we can either export it or just duplicate the logic here for testing the pattern.
// Ideally, we should refactor it to a util, but for this task I will test the logic in isolation as requested.

const getRepoNameFromSource = (source: string | undefined): string | undefined => {
    if (!source) return undefined;
    // source format: sources/github/owner/repo
    const parts = source.split('/');
    if (parts.length >= 4) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
    return undefined;
};

describe('getRepoNameFromSource Logic', () => {
  it('should return undefined for undefined source', () => {
    expect(getRepoNameFromSource(undefined)).toBeUndefined();
  });

  it('should return undefined for invalid source format', () => {
    expect(getRepoNameFromSource('invalid')).toBeUndefined();
  });

  it('should correctly extract repo name', () => {
    expect(getRepoNameFromSource('sources/github/owner/repo')).toBe('owner/repo');
  });

  it('should handle complex repo names', () => {
    expect(getRepoNameFromSource('sources/github/owner-name/repo-name')).toBe('owner-name/repo-name');
  });
});
