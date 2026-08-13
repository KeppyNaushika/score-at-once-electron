/**
 * Electron アプリ起動ヘルパー（e2e 共通）
 *
 * 一時データディレクトリ（SCORE_AT_ONCE_DATA_DIR）を割り当てて起動するため、
 * 既定の data/database.db には一切触れず、新規インストール状態を再現できる。
 */
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test"
import electronPath from "electron"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { E2E_BASE_URL, E2E_RENDERER_PORT } from "./rendererPort"

const ROOT = path.resolve(__dirname, "../../../..")

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
  dataDir: string
  close: () => Promise<void>
}

/** 空のデータディレクトリで Electron を起動し、最初のウィンドウを返す */
export async function launchApp(): Promise<LaunchedApp> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "score-at-once-e2e-"))

  const app = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [path.join(ROOT, "main/electron-src/index.js")],
    cwd: ROOT,
    env: {
      ...process.env,
      SCORE_AT_ONCE_DATA_DIR: dataDir,
      SCORE_AT_ONCE_RENDERER_PORT: String(E2E_RENDERER_PORT),
      NODE_ENV: "development",
    },
    timeout: 60_000,
  })

  const page = await app.firstWindow({ timeout: 60_000 })
  await page.waitForLoadState("domcontentloaded")

  return {
    app,
    page,
    dataDir,
    close: async () => {
      await app.close().catch(() => {})
      fs.rmSync(dataDir, { recursive: true, force: true })
    },
  }
}

/** シード済み管理者ユーザーでログインする */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${E2E_BASE_URL}/login`, {
    waitUntil: "domcontentloaded",
  })
  await page.getByRole("button", { name: "採点を開始" }).first().click()
}
