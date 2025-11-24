
import { vi, describe, it, expect } from 'vitest';
import { storageEmitter } from '@/lib/storage-event';

describe('storageEmitter', () => {
    it('should call a listener when an event is emitted', () => {
        const listener = vi.fn();
        storageEmitter.on('test-event', listener);
        storageEmitter.emit('test-event');
        expect(listener).toHaveBeenCalled();
    });

    it('should not call a listener after it has been removed', () => {
        const listener = vi.fn();
        storageEmitter.on('test-event', listener);
        storageEmitter.off('test-event', listener);
        storageEmitter.emit('test-event');
        expect(listener).not.toHaveBeenCalled();
    });

    it('should pass a payload to the listener', () => {
        const listener = vi.fn();
        const payload = { a: 1 };
        storageEmitter.on('test-event', listener);
        storageEmitter.emit('test-event', payload);
        expect(listener).toHaveBeenCalledWith(payload);
    });
});
