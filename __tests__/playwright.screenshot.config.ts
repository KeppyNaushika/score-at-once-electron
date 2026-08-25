import { defineConfig } from "@playwright/test"
import * as path from "path"

import {
  SCREENSHOT_BASE_URL,
  SCREENSHOT_RENDERER_PORT,
} from "./screenshots/helpers/rendererPort"

/**
 * スクリーンショット自動撮影用 Playwright 設定
 *
 * Next.js dev server を自動起動し、Electron アプリ経由で全画面のスクリーンショットを撮影する。
 *
 * `testDir` / `outputDir` は**設定ファイルのあるディレクトリ**（`__tests__/`）を
 * 起点に解決される（`playwright/lib/common/index.js` の `FullProjectInternal`）。
 * リポジトリルート起点のつもりで `./__tests__/screenshots` と書くと
 * `__tests__/__tests__/screenshots` を指し、テストが1本も見つからないまま緑で終わる。
 *
 * 使用方法:
 *   npm run screenshot          # 種まき → 撮影
 *   npm run screenshot:test     # 撮影のみ（種まき済みであること）
 */
export default defineConfig({
  testDir: "./screenshots",
  testMatch: "**/*.spec.ts",
  /* main/preload のビルドと better-sqlite3 の ABI 2本立てを用意する */
  globalSetup: "./screenshots/globalSetup.ts",
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
  outputDir: "./screenshots/artifacts",
  /**
   * レンダラーが参照する Next.js dev サーバー。
   *
   * `cwd` を明示する。既定は設定ファイルのあるディレクトリ（`__tests__/`）なので、
   * 渡さないと `npx next dev` がそこで走り、`app/` を見つけられずに落ちる。
   *
   * ポートは 3000 ではない（`screenshots/helpers/rendererPort.ts`）。開発用サーバーが
   * 同じ作業ツリーで動いていることがあり、`reuseExistingServer: true` で 3000 番を
   * 再利用すると**そちらのコードに対して撮影が走る**。false にして、このポートの
   * サーバーが自分のものであることを保証する。
   *
   * ビルド成果物の置き場（`NEXT_DIST_DIR`）も分ける。`.next` を共有すると、隣で
   * 動いている開発用サーバーのビルドと互いに壊し合う。
   */
  webServer: {
    command: `npx next dev -p ${SCREENSHOT_RENDERER_PORT}`,
    cwd: path.resolve(__dirname, ".."),
    url: SCREENSHOT_BASE_URL,
    reuseExistingServer: false,
    timeout: 180 * 1000,
    env: { NEXT_DIST_DIR: ".next-screenshot" },
  },
})
