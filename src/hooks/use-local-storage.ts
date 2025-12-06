
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
    } catch {
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
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          // Dispatch a custom event
          storageEmitter.emit("change", { key, value: valueToStore });
        }
      } catch (error) {
        console.error(error);
      }
    },
    [key, storedValue]
  );
  
  // Effect to listen for storage change events from other instances of the hook
  useEffect(() => {
    const handleStorageChange = (event: { key: string, value: T }) => {
        if (event.key === key && JSON.stringify(event.value) !== JSON.stringify(storedValueRef.current)) {
            setStoredValue(event.value);
        }
    };

    storageEmitter.on("change", handleStorageChange);

    return () => {
        storageEmitter.off("change", handleStorageChange);
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
