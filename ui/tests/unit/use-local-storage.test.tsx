
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { storageEmitter } from '@/lib/storage-event';

// Mock the storageEmitter
vi.mock('@/lib/storage-event', () => ({
  storageEmitter: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));

describe('useLocalStorage', () => {
  beforeEach(() => {
    // Clear mock history before each test
    vi.clearAllMocks();
    // Reset localStorage
    window.localStorage.clear();
  });

  it('should subscribe to storage events only once', () => {
    const { rerender } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Should be called once on initial render
    expect(storageEmitter.on).toHaveBeenCalledTimes(1);
    expect(storageEmitter.off).not.toHaveBeenCalled();

    // Rerender the hook (simulating parent component re-render)
    rerender();

    // `on` should not be called again if dependencies are correct
    expect(storageEmitter.on).toHaveBeenCalledTimes(1);
  });

  it('should re-subscribe when key changes', () => {
    const { rerender } = renderHook(({ key }) => useLocalStorage(key, 'initial'), {
      initialProps: { key: 'key1' },
    });

    expect(storageEmitter.on).toHaveBeenCalledTimes(1);

    // Rerender with a new key
    rerender({ key: 'key2' });

    // Should have unsubscribed from the old key and subscribed to the new one
    expect(storageEmitter.off).toHaveBeenCalledTimes(1);
    expect(storageEmitter.on).toHaveBeenCalledTimes(2);
  });

  it('should not re-subscribe when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    expect(storageEmitter.on).toHaveBeenCalledTimes(1);

    act(() => {
      // This will change the internal `storedValue`
      result.current[1]('new-value');
    });

    // The bug is that it re-subscribes, so this assertion should fail
    expect(storageEmitter.on).toHaveBeenCalledTimes(1);
  });
});
