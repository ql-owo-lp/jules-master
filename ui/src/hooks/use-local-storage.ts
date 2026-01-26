
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { storageEmitter } from "@/lib/storage-event";

// This hook can't be used during server-side rendering.
// Wrap the component using it with a check for `isClient` or similar.
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  // Always start with initialValue to avoid hydration mismatch.
  // Next.js will render the same initial value on server and client first pass.
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Use a ref to store the latest value for the event handler
  // This avoids including storedValue in the useEffect dependency array
  const storedValueRef = useRef(storedValue);
  useEffect(() => {
    storedValueRef.current = storedValue;
  }, [storedValue]);

  const setValue = useCallback(
    (value: T) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValueRef.current) : value;

        // Update the ref immediately to prevent the event listener from
        // unnecessarily updating the state again when we emit the event
        storedValueRef.current = valueToStore;

        setStoredValue(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          // Dispatch a custom event scoped to this key
          storageEmitter.emit(`storage:${key}`, valueToStore);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [key]
  );
  
  // Effect to listen for storage change events from other instances of the hook
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleStorageChange = (newValue: any) => {
        if (JSON.stringify(newValue) !== JSON.stringify(storedValueRef.current)) {
            setStoredValue(newValue);
        }
    };

    const eventName = `storage:${key}`;
    storageEmitter.on(eventName, handleStorageChange);

    return () => {
        storageEmitter.off(eventName, handleStorageChange);
    };
  }, [key]);

  // Consolidate re-reading from local storage on mount and key change
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const item = window.localStorage.getItem(key);
      const freshValue = item && item !== "undefined" ? JSON.parse(item) : initialValue;
      
      // Update state only if different to avoid infinite loops with objects/arrays
      if (JSON.stringify(freshValue) !== JSON.stringify(storedValue)) {
        setStoredValue(freshValue);
      }
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error);
      if (JSON.stringify(initialValue) !== JSON.stringify(storedValue)) {
          setStoredValue(initialValue);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);


  return [storedValue, setValue];
}
