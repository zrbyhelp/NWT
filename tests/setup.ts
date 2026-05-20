import "@testing-library/jest-dom/vitest";

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
}
