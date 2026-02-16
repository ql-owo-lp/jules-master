
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

  it("should NOT update local storage if the value is the same", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useLocalStorage("same-val-key", "initial"));

    // First update changes value
    act(() => {
      result.current[1]("new-value");
    });

    // Check call count (might be > 1 due to monkey-patching or other internal calls, but should be at least 1)
    const callsAfterFirstUpdate = setItemSpy.mock.calls.length;
    expect(callsAfterFirstUpdate).toBeGreaterThan(0);

    // Second update sets same value
    act(() => {
      result.current[1]("new-value");
    });

    // Expectation: setItem should NOT be called again
    expect(setItemSpy).toHaveBeenCalledTimes(callsAfterFirstUpdate);
  });

  it("should overwrite invalid JSON in local storage when setting a new value directly", () => {
    // Setup invalid JSON
    window.localStorage.setItem("invalid-json-key", "invalid-json-content");

    const { result } = renderHook(() => useLocalStorage("invalid-json-key", "default"));

    // Initial value should be default because parse fails
    expect(result.current[0]).toBe("default");

    // Spy on setItem
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // Set value directly (not function updater)
    act(() => {
      result.current[1]("new-valid-value");
    });

    expect(setItemSpy).toHaveBeenCalled();
    expect(window.localStorage.getItem("invalid-json-key")).toBe(JSON.stringify("new-valid-value"));
  });
});
