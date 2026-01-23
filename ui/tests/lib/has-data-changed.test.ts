import { expect, test, describe } from 'vitest';
import { hasDataChanged } from '../../src/lib/utils';

describe('hasDataChanged', () => {
  test('returns false for identical arrays', () => {
    const a = [{ id: '1', val: 'a' }, { id: '2', val: 'b' }];
    const b = [{ id: '1', val: 'a' }, { id: '2', val: 'b' }];
    expect(hasDataChanged(a, b)).toBe(false);
  });

  test('returns false for out-of-order identical arrays', () => {
    const a = [{ id: '1', val: 'a' }, { id: '2', val: 'b' }];
    const b = [{ id: '2', val: 'b' }, { id: '1', val: 'a' }];
    expect(hasDataChanged(a, b)).toBe(false);
  });

  test('returns true for different lengths', () => {
    const a = [{ id: '1', val: 'a' }];
    const b = [{ id: '1', val: 'a' }, { id: '2', val: 'b' }];
    expect(hasDataChanged(a, b)).toBe(true);
  });

  test('returns true for different content', () => {
    const a = [{ id: '1', val: 'a' }];
    const b = [{ id: '1', val: 'b' }];
    expect(hasDataChanged(a, b)).toBe(true);
  });

  test('returns true for missing items', () => {
    const a = [{ id: '1', val: 'a' }, { id: '2', val: 'b' }];
    const b = [{ id: '1', val: 'a' }, { id: '3', val: 'c' }];
    expect(hasDataChanged(a, b)).toBe(true);
  });

  test('returns true for partially matching but different item', () => {
      const a = [{ id: '1', val: 'a' }];
      const b = [{ id: '1', val: 'a', extra: 'x' }];
      expect(hasDataChanged(a, b)).toBe(true);
  });
});
