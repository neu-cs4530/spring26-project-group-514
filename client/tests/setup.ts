import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

// Node 25+ ships a native localStorage that lacks standard methods
// (getItem, setItem, clear, etc.) unless --localstorage-file is set.
// This shadows jsdom's proper implementation. Replace it with a
// simple in-memory Storage polyfill.
if (
  typeof globalThis.localStorage !== "undefined" &&
  typeof globalThis.localStorage.clear !== "function"
) {
  const storage = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    };
  })();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
});
