
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "./use-local-storage";
import { storageEmitter } from "@/lib/storage-event";
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe("useLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

    expect(emitSpy).toHaveBeenCalledWith("storage:perf-key", "new-val");
    expect(emitSpy).not.toHaveBeenCalledWith("change", expect.anything());
  });
});
