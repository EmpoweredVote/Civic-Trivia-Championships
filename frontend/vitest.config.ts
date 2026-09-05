import { defineConfig } from 'vitest/config';

// Node environment, not jsdom. Every current test exercises pure functions -- rig geometry,
// the greet/poof/gesture/flee reducers -- and none of them touch a DOM or a canvas. Adding
// jsdom now would be unused weight; add it when a test genuinely needs a document.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
