import * as React from "react"

const MOBILE_BREAKPOINT = 768

let mql: MediaQueryList | null = null;
const subscribers = new Set<() => void>();

function getMql() {
  if (typeof window === "undefined") return null;
  if (!mql) {
    mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  }
  return mql;
}

function getSnapshot() {
  const mediaQueryList = getMql();
  if (!mediaQueryList) return false;
  return mediaQueryList.matches;
}

function subscribe(callback: () => void) {
  const mediaQueryList = getMql();
  if (!mediaQueryList) return () => {};

  subscribers.add(callback);

  if (subscribers.size === 1) {
    mediaQueryList.addEventListener("change", notifySubscribers);
  }

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0) {
      mediaQueryList.removeEventListener("change", notifySubscribers);
    }
  };
}

function notifySubscribers() {
  for (const subscriber of subscribers) {
    subscriber();
  }
}

function getServerSnapshot() {
  return false; // Default for SSR
}

export function useIsMobile() {
  // Use a global listener instead of one per component to reduce memory overhead
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
