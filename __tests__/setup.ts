/**
 * Vitestファイルレベルセットアップ
 *
 * 各テストファイルで読み込まれ、Electron API のスタブ等を敷く
 */

import * as path from "path"
import { vi } from "vitest"

const TEST_DATA_DIR = path.resolve(__dirname, "../data")

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
