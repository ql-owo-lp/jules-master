"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { storageEmitter } from "@/lib/storage-event";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return JSON.stringify(initialValue);
    try {
      const item = window.localStorage.getItem(key);
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
        const valueToStore = value instanceof Function ? value(JSON.parse(store)) : value;
        const jsonValue = JSON.stringify(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, jsonValue);
          storageEmitter.emit(`storage:${key}`, valueToStore); // Emit parsed for listeners
          // Force update for current hook by ensuring snapshot changes if needed?
          // Actually storageEmitter triggers callback -> getSnapshot -> new value.
          // But getSnapshot reads localStorage. So we must write first. Done.
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
