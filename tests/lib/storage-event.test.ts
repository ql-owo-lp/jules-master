
import { describe, it, expect, vi } from 'vitest';
import { storageEmitter } from '@/lib/storage-event';

describe('storageEmitter', () => {
  it('should register and trigger an event listener', () => {
    const listener = vi.fn();
    storageEmitter.on('test-event', listener);
    storageEmitter.emit('test-event');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should pass a payload to the event listener', () => {
    const listener = vi.fn();
    const payload = { message: 'hello' };
    storageEmitter.on('test-event-with-payload', listener);
    storageEmitter.emit('test-event-with-payload', payload);
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('should unregister an event listener', () => {
    const listener = vi.fn();
    storageEmitter.on('test-event-to-remove', listener);
    storageEmitter.off('test-event-to-remove', listener);
    storageEmitter.emit('test-event-to-remove');
    expect(listener).not.toHaveBeenCalled();
  });

  it('should not throw when trying to unregister a non-existent listener', () => {
    const listener = vi.fn();
    expect(() => storageEmitter.off('non-existent-event', listener)).not.toThrow();
  });

  it('should not throw when emitting an event with no listeners', () => {
    expect(() => storageEmitter.emit('event-with-no-listeners')).not.toThrow();
  });
});
