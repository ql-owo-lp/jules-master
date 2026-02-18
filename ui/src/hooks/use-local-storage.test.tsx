
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "./use-local-storage";
import { storageEmitter } from "@/lib/storage-event";
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe("useLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should initialize with default value", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("should update local storage and state when setValue is called", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));

    act(() => {
      result.current[1]("new-value");
    });

    expect(result.current[0]).toBe("new-value");
    expect(window.localStorage.getItem("test-key")).toBe(JSON.stringify("new-value"));
  });

  it("should sync updates between hooks with the same key", () => {
    const { result: result1 } = renderHook(() => useLocalStorage("shared-key", "initial"));
    const { result: result2 } = renderHook(() => useLocalStorage("shared-key", "initial"));

    act(() => {
      result1.current[1]("updated");
    });

    expect(result1.current[0]).toBe("updated");
    expect(result2.current[0]).toBe("updated");
  });

  it("should NOT sync updates to hooks with different keys", () => {
    const { result: result1 } = renderHook(() => useLocalStorage("key1", "initial"));
    const { result: result2 } = renderHook(() => useLocalStorage("key2", "initial"));

    act(() => {
      result1.current[1]("updated-key1");
    });

    expect(result1.current[0]).toBe("updated-key1");
    expect(result2.current[0]).toBe("initial");
  });

  it("should use scoped events for performance", () => {
    const emitSpy = vi.spyOn(storageEmitter, "emit");
    const { result } = renderHook(() => useLocalStorage("perf-key", "initial"));

    act(() => {
      result.current[1]("new-val");
    });

    // The implementation now emits undefined payload as listeners re-read from cache
    expect(emitSpy).toHaveBeenCalledWith("storage:perf-key", undefined);
    expect(emitSpy).not.toHaveBeenCalledWith("change", expect.anything());
  });

  it("should NOT call setItem when setting the same value", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useLocalStorage("same-val-key", "initial"));

    act(() => {
      result.current[1]("new-value");
    });
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current[1]("new-value");
    });
    // Currently, it IS called again, so we expect 2.
    // After optimization, this should be 1.
    expect(setItemSpy).toHaveBeenCalledTimes(1);
  });
});
