/**
 * Vitestファイルレベルセットアップ
 *
 * 各テストファイルで読み込まれ、テスト用環境変数を設定する
 */

import * as path from "path"
import { vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../data/test-database.db")
const TEST_DATA_DIR = path.dirname(TEST_DB_PATH)

// テスト用環境変数を設定
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`
;(process.env as Record<string, string>).NODE_ENV = "test"

// Electron非依存環境（Vitest/Node）でElectron APIをスタブ化
// 一部のelectron-src/モジュールがトップレベルで `import { app } from "electron"` を行うため必須
vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => {
      if (name === "userData") return TEST_DATA_DIR
      return TEST_DATA_DIR
    },
    getAppPath: () => path.resolve(__dirname, ".."),
    isPackaged: false,
    getName: () => "score-at-once-test",
    getVersion: () => "0.0.0-test",
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}))
