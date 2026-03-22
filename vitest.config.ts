import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    setupFiles: ["__tests__/setup.ts"],
    globalSetup: ["__tests__/globalSetup.ts"],
    testTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@/electron-src": path.resolve(__dirname, "./electron-src"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
