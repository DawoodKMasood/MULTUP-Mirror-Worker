import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    deps: {
      interopDefault: true,
    },
  },
  esbuild: {
    target: 'es2022',
  },
})