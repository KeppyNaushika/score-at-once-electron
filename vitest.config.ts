import * as path from "path"
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
    alias: [
      {
        find: "@/electron-src",
        replacement: path.resolve(__dirname, "./electron-src"),
      },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") },
      // Prisma 7: @prisma/client（exact match のみ）を生成済みクライアントへ
      {
        find: /^@prisma\/client$/,
        replacement: path.resolve(__dirname, "./generated/prisma/client"),
      },
    ],
  },
})
