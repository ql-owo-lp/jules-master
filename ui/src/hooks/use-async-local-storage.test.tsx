
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAsyncLocalStorage } from "./use-async-local-storage";
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe("useAsyncLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should initialize with default value", () => {
    const { result } = renderHook(() => useAsyncLocalStorage("test-key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("should load value from local storage on mount", async () => {
    window.localStorage.setItem("test-key", JSON.stringify("loaded-value"));
    const { result } = renderHook(() => useAsyncLocalStorage("test-key", "default"));

    // Wait for effect to update state (it might be immediate in test env)
    await waitFor(() => {
        expect(result.current[0]).toBe("loaded-value");
    });
  });

  it("should update state immediately and local storage asynchronously when setValue is called", async () => {
    const { result } = renderHook(() => useAsyncLocalStorage("test-key", "default"));

    // Wait for initial load to finish (so isLoaded becomes true)
    await waitFor(() => {});

    act(() => {
      result.current[1]("new-value");
    });

    // State updates immediately
    expect(result.current[0]).toBe("new-value");

    // LocalStorage updates asynchronously (via setTimeout/requestIdleCallback)
    await waitFor(() => {
        expect(window.localStorage.getItem("test-key")).toBe(JSON.stringify("new-value"));
    });
  });

  it("should handle key change correctly", async () => {
      const { result, rerender } = renderHook(({ key }) => useAsyncLocalStorage(key, "default"), {
          initialProps: { key: "key1" }
      });

      // Wait for load
      await waitFor(() => {});

      act(() => {
          result.current[1]("value1");
      });

      await waitFor(() => {
          expect(window.localStorage.getItem("key1")).toBe(JSON.stringify("value1"));
      });

      // Change key
      rerender({ key: "key2" });

      // Should reset to default immediately
      expect(result.current[0]).toBe("default");

      // Should NOT overwrite key2 with value1 (stale state)
      // Since we reset state immediately, save effect sees "default".
      // But we also reset isLoaded=false.
      // So save effect should NOT run until load finishes.
      // Load finishes -> isLoaded=true.
      // Then save effect runs with "default".
      // So key2 becomes "default" (if it was empty).

      await waitFor(() => {
         // Key2 might be set to default if empty
         // But definitely not "value1"
         expect(window.localStorage.getItem("key2")).not.toBe(JSON.stringify("value1"));
      });

      // Update value for key2
      act(() => {
          result.current[1]("value2");
      });

      await waitFor(() => {
          expect(window.localStorage.getItem("key2")).toBe(JSON.stringify("value2"));
      });

      // Key1 should remain unchanged
      expect(window.localStorage.getItem("key1")).toBe(JSON.stringify("value1"));
  });
});
