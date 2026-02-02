import { describe, it, expect } from 'vitest';
import { secureCompare } from '../src/middleware';

describe('secureCompare', () => {
  it('should return true for equal strings', async () => {
    expect(await secureCompare('secret', 'secret')).toBe(true);
    expect(await secureCompare('', '')).toBe(true);
    expect(await secureCompare('a', 'a')).toBe(true);
    expect(await secureCompare('superlongstringwithnumbers123', 'superlongstringwithnumbers123')).toBe(true);
  });

  it('should return false for unequal strings of same length', async () => {
    expect(await secureCompare('secret', 'secreT')).toBe(false);
    expect(await secureCompare('a', 'b')).toBe(false);
    expect(await secureCompare('123', '124')).toBe(false);
  });

  it('should return false for strings of different lengths', async () => {
    expect(await secureCompare('secret', 'secret1')).toBe(false);
    expect(await secureCompare('secret', 'secre')).toBe(false);
    expect(await secureCompare('', 'a')).toBe(false);
  });
});
