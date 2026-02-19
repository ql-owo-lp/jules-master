
import { useState, useEffect } from 'react';

export function useAsyncLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentKey, setCurrentKey] = useState(key);

  // Handle key change (derived state)
  if (key !== currentKey) {
    setCurrentKey(key);
    setIsLoaded(false);
    setStoredValue(initialValue);
  }

  // Load from localStorage on mount or key change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
      // If no item, storedValue is already initialValue (from reset)
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    } finally {
      setIsLoaded(true);
    }
  }, [key]);

  // Save to localStorage when storedValue changes, but only after loading
  useEffect(() => {
    if (typeof window === 'undefined' || !isLoaded) return;

    const saveToStorage = () => {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    };

    if ('requestIdleCallback' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).requestIdleCallback(saveToStorage);
    } else {
      setTimeout(saveToStorage, 0);
    }
  }, [key, storedValue, isLoaded]);

  return [storedValue, setStoredValue];
}
