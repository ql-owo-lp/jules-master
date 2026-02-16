"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { storageEmitter } from "@/lib/storage-event";

// Global cache for localStorage values to avoid synchronous reads
// Maps key -> value (string) | null (doesn't exist)
const storeCache = new Map<string, string | null>();

// Initialize listener for cross-tab updates and monkey-patch for same-tab updates
if (typeof window !== "undefined") {
  // Listen for changes from other tabs
  window.addEventListener("storage", (e) => {
    if (e.storageArea === window.localStorage) {
        if (e.key) {
            // Update cache
            storeCache.set(e.key, e.newValue);
            // Notify listeners
            storageEmitter.emit(`storage:${e.key}`, undefined);
        } else {
            // Storage cleared
            storeCache.clear();
        }
    }
  });

  // Monkey-patch Storage.prototype methods to ensure cache consistency and reactivity.
  // We use a flag to prevent double-patching.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.__jules_storage_patched) {
    w.__jules_storage_patched = true;

    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    const originalClear = Storage.prototype.clear;

    Storage.prototype.setItem = function(key: string, value: string) {
      // Ensure value is string as per spec
      const valueStr = String(value);
      originalSetItem.call(this, key, valueStr);

      // Only update cache/emit if this is localStorage
      if (this === window.localStorage) {
        storeCache.set(key, valueStr);
        // Notify listeners within the same tab
        storageEmitter.emit(`storage:${key}`, undefined);
      }
    };

    Storage.prototype.removeItem = function(key: string) {
      originalRemoveItem.call(this, key);

      if (this === window.localStorage) {
        storeCache.set(key, null);
        storageEmitter.emit(`storage:${key}`, undefined);
      }
    };

    Storage.prototype.clear = function() {
      originalClear.call(this);

      if (this === window.localStorage) {
        storeCache.clear();
      }
    };
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return JSON.stringify(initialValue);

    // Check cache first
    if (storeCache.has(key)) {
        const cached = storeCache.get(key);
        // If cached is null (missing) or "undefined", return initialValue
        return cached !== null && cached !== "undefined" ? cached : JSON.stringify(initialValue);
    }

    try {
      const item = window.localStorage.getItem(key);
      storeCache.set(key, item);
      return item && item !== "undefined" ? item : JSON.stringify(initialValue);
    } catch {
      return JSON.stringify(initialValue);
    }
  }, [key, initialValue]);

  const getServerSnapshot = useCallback(() => JSON.stringify(initialValue), [initialValue]);

  const subscribe = useCallback(
    (callback: () => void) => {
      const eventName = `storage:${key}`;
      const onStorage = () => callback();
      storageEmitter.on(eventName, onStorage);
      return () => storageEmitter.off(eventName, onStorage);
    },
    [key]
  );

  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (value: T) => {
      try {
        let currentValue: T | undefined;
        try {
          currentValue = JSON.parse(store);
        } catch {
          // If parsing fails, and the value is a function, re-throw to maintain original behavior
          if (value instanceof Function) throw new Error("Cannot update state based on invalid JSON in storage");
        }

        const valueToStore = value instanceof Function ? value(currentValue as T) : value;

        // Optimization: If the new value is strictly equal to the current value, skip update.
        // We only do this if currentValue was successfully parsed.
        if (currentValue !== undefined && valueToStore === currentValue) return;

        const jsonValue = JSON.stringify(valueToStore);

        // Optimization: If the stringified value is the same as the current store, skip update.
        if (jsonValue === store) return;

        if (typeof window !== "undefined") {
          // This call goes through the monkey-patched setItem,
          // which updates the cache and emits the event.
          window.localStorage.setItem(key, jsonValue);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [key, store]
  );

  // Parse the store string back to T
  const parsedValue = useMemo(() => {
    try {
        return JSON.parse(store);
    } catch {
        return initialValue;
    }
  }, [store, initialValue]);

  return [parsedValue, setValue];
}
