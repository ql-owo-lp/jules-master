
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { storageEmitter } from "@/lib/storage-event";

// This hook can't be used during server-side rendering.
// Wrap the component using it with a check for `isClient` or similar.
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

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
          // This avoids notifying every single useLocalStorage hook in the app
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
    // The payload is now just the value, as the event is already scoped to the key
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

  // Re-read from local storage when isClient becomes true
  useEffect(() => {
    if (isClient) {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          const freshValue = JSON.parse(item);
          if(JSON.stringify(freshValue) !== JSON.stringify(storedValue)) {
            setStoredValue(freshValue);
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, key]);


  return [storedValue, setValue];
}
