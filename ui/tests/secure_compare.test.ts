import { describe, it, expect } from 'vitest';
import { secureCompare } from '../src/middleware';

describe('secureCompare', () => {
  it('should return true for equal strings', () => {
    expect(secureCompare('secret', 'secret')).toBe(true);
    expect(secureCompare('', '')).toBe(true);
    expect(secureCompare('a', 'a')).toBe(true);
    expect(secureCompare('superlongstringwithnumbers123', 'superlongstringwithnumbers123')).toBe(true);
  });

  it('should return false for unequal strings of same length', () => {
    expect(secureCompare('secret', 'secreT')).toBe(false);
    expect(secureCompare('a', 'b')).toBe(false);
    expect(secureCompare('123', '124')).toBe(false);
  });

  it('should return false for strings of different lengths', () => {
    expect(secureCompare('secret', 'secret1')).toBe(false);
    expect(secureCompare('secret', 'secre')).toBe(false);
    expect(secureCompare('', 'a')).toBe(false);
  });
});
