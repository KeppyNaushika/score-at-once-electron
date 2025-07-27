import { defineConfig, devices } from '@playwright/test';

/**
 * 一括採点アプリケーション用Playwright設定
 * Electronアプリケーションのテストに特化
 */
export default defineConfig({
  testDir: './tests',
  /* 並列実行を制限（Electronアプリの同時起動を避ける） */
  fullyParallel: false,
  workers: 1,
  /* テスト失敗時に停止 */
  forbidOnly: !!process.env.CI,
  /* リトライ設定 */
  retries: process.env.CI ? 2 : 0,
  /* レポーター設定 */
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['list'],
  ],
  /* 共通設定 */
  use: {
    /* テスト失敗時のスクリーンショット */
    screenshot: 'only-on-failure',
    /* テスト実行の動画記録 */
    video: 'retain-on-failure',
    /* テストトレース（デバッグ用） */
    trace: 'on-first-retry',
    /* ベースURL */
    baseURL: 'http://localhost:3000',
  },

  /* ブラウザ設定 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* テスト実行前のセットアップ */
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000, // 60秒
  },

  /* テスト結果の出力先 */
  outputDir: 'test-results/artifacts/',
  
  /* グローバルタイムアウト */
  timeout: 30 * 1000, // 30秒
  expect: {
    timeout: 5 * 1000, // 5秒
  },
});