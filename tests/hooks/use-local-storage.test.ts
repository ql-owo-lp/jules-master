
/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { storageEmitter } from '@/lib/storage-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('useLocalStorage', () => {
  const KEY = 'test-key';
  const INITIAL_VALUE = { data: 'initial' };
  const NEW_VALUE = { data: 'new' };

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should initialize with the initial value if nothing is in localStorage', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));
    expect(result.current[0]).toEqual(INITIAL_VALUE);
  });

  it('should initialize with the value from localStorage if it exists', () => {
    window.localStorage.setItem(KEY, JSON.stringify(NEW_VALUE));
    const { result } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));
    expect(result.current[0]).toEqual(NEW_VALUE);
  });

  it('should update the value in localStorage when setValue is called', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));

    act(() => {
      result.current[1](NEW_VALUE);
    });

    expect(result.current[0]).toEqual(NEW_VALUE);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual(NEW_VALUE);
  });

  it('should handle function updates in setValue', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, 10));

    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    expect(result.current[0]).toBe(15);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toBe(15);
  });

  it('should handle JSON parsing errors gracefully', () => {
    window.localStorage.setItem(KEY, 'invalid-json');
    const { result } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));
    expect(result.current[0]).toEqual(INITIAL_VALUE);
  });

  it('should synchronize state between two instances of the hook', () => {
    const { result: result1 } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));
    const { result: result2 } = renderHook(() => useLocalStorage(KEY, INITIAL_VALUE));

    act(() => {
        result1.current[1](NEW_VALUE);
    });

    expect(result1.current[0]).toEqual(NEW_VALUE);
    expect(result2.current[0]).toEqual(NEW_VALUE);
  });

});
