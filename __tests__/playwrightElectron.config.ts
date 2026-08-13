import { defineConfig, devices } from "@playwright/test"
import * as path from "path"

import {
  E2E_BASE_URL,
  E2E_RENDERER_PORT,
} from "./tests/electron/helpers/rendererPort"

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
   * ポートは 3000 ではない（`helpers/rendererPort.ts`）。開発用サーバーが同じ
   * 作業ツリーで動いていることがあり、3000 番を再利用すると**そちらのコードに
   * 対して** e2e が走ってしまう。`reuseExistingServer` は false にして、この
   * ポートのサーバーが自分のものであることを保証する。
   *
   * ビルド成果物の置き場（`NEXT_DIST_DIR`）も分ける。`.next` を共有すると、
   * 隣で動いている開発用サーバーのビルドと互いに壊し合う。
   */
  webServer: {
    command: `npx next dev -p ${E2E_RENDERER_PORT}`,
    cwd: path.resolve(__dirname, ".."),
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 180 * 1000,
    env: { NEXT_DIST_DIR: ".next-e2e" },
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
