import { defineConfig } from "@playwright/test"

/**
 * スクリーンショット自動撮影用 Playwright 設定
 *
 * Next.js dev server を自動起動し、Electron アプリ経由で全画面のスクリーンショットを撮影する。
 *
 * 使用方法:
 *   # Electron ビルド済みであること
 *   npx tsc -p electron-src
 *   npx playwright test --config=playwright.screenshot.config.ts
 */
export default defineConfig({
  testDir: "./__tests__/screenshots",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 180 * 1000, // 3分（Electron起動 + ページ遷移を考慮）
  expect: {
    timeout: 15 * 1000,
  },
  use: {
    screenshot: "off",
    video: "off",
    trace: "off",
  },
  outputDir: "__tests__/screenshots/artifacts/",
  webServer: {
    command: "npx next dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
})
