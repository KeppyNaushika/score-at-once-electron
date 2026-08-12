import { defineConfig, devices } from "@playwright/test"
import * as path from "path"

/**
 * 一括採点Electronアプリケーション専用Playwright設定
 */
export default defineConfig({
  testDir: "./tests/electron",
  /* 起動前に main/preload ビルドと better-sqlite3 の Electron ABI を用意する */
  globalSetup: "./tests/electron/globalSetup.ts",
  /**
   * レンダラーが参照する Next.js dev サーバー。
   *
   * `cwd` を明示する。既定は設定ファイルのあるディレクトリ（`__tests__/`）なので、
   * 自前で起動しようとすると `app/` を見つけられずに落ちる。
   *
   * **`reuseExistingServer` は 3000 番に居るものをそのまま使う。** 別のセッションが
   * dev サーバーを立てていると、そちらのコードに対して e2e が走ってしまう。
   * 走らせる前に 3000 番が自分のものか確かめること。
   */
  webServer: {
    command: "npx next dev",
    cwd: path.resolve(__dirname, ".."),
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
  /* 並列実行を制限（Electronアプリの同時起動を避ける） */
  fullyParallel: false,
  workers: 1,
  /* テスト失敗時に停止 */
  forbidOnly: !!process.env.CI,
  /* リトライ設定 */
  retries: process.env.CI ? 2 : 0,
  /* レポーター設定 */
  reporter: [
    ["html", { outputFolder: "test-results/electron-html-report" }],
    ["list"],
  ],
  /* 共通設定 */
  use: {
    /* テスト失敗時のスクリーンショット */
    screenshot: "only-on-failure",
    /* テスト実行の動画記録 */
    video: "retain-on-failure",
    /* テストトレース（デバッグ用） */
    trace: "on-first-retry",
  },

  /* Electronアプリケーション設定 */
  projects: [
    {
      name: "electron",
      use: {
        ...devices["Desktop Chrome"],
        // Electronアプリケーション固有の設定
      },
    },
  ],

  /* テスト結果の出力先 */
  outputDir: "test-results/electron-artifacts/",

  /* グローバルタイムアウト */
  timeout: 60 * 1000, // 60秒（Electronアプリの起動時間を考慮）
  expect: {
    timeout: 10 * 1000, // 10秒
  },
})
