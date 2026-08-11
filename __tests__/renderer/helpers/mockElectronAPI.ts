/**
 * window.electronAPI モックファクトリ
 *
 * レンダラテストでIPC呼び出しをモック化する
 */

import { vi } from "vitest"

import {
  createMockFileOverviewData,
  createMockImportSummary,
  createMockManifest,
  createMockScoringConflictData,
} from "./mockData"

export interface MockArchive {
  selectImportFile: ReturnType<typeof vi.fn>
  analyzeArchive: ReturnType<typeof vi.fn>
  preMatch: ReturnType<typeof vi.fn>
  detectScoringConflicts: ReturnType<typeof vi.fn>
  idIntegrationImport: ReturnType<typeof vi.fn>
  exportExam: ReturnType<typeof vi.fn>
}

/**
 * window.electronAPIのモックを作成し、windowに設定する
 */
export function createMockElectronAPI() {
  const mockArchive: MockArchive = {
    selectImportFile: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: "/path/to/test.score",
      sourceFormat: "score",
    }),
    analyzeArchive: vi.fn().mockResolvedValue({
      success: true,
      manifest: createMockManifest(),
    }),
    preMatch: vi.fn().mockResolvedValue(createMockFileOverviewData()),
    detectScoringConflicts: vi
      .fn()
      .mockResolvedValue(createMockScoringConflictData()),
    idIntegrationImport: vi.fn().mockResolvedValue({
      examId: "imported-exam-id",
      summary: createMockImportSummary(),
      warnings: [],
    }),
    exportExam: vi.fn().mockResolvedValue({
      success: true,
      outputPath: "/path/to/export.score",
    }),
  }

  const mockElectronAPI = {
    archive: mockArchive,
    // AuthContext が使用するメソッド
    getAuthToken: vi.fn().mockResolvedValue(null),
    fetchUsers: vi.fn().mockResolvedValue([]),
    clearAuthToken: vi.fn().mockResolvedValue(undefined),
    saveAuthToken: vi.fn().mockResolvedValue(undefined),
  }

  Object.defineProperty(window, "electronAPI", {
    value: mockElectronAPI,
    writable: true,
    configurable: true,
  })

  return { mockArchive, mockElectronAPI }
}

/**
 * window.electronAPI をクリーンアップ
 */
export function cleanupMockElectronAPI() {
  // window.electronAPI は必須プロパティとして宣言されているため delete 演算子は使えない。
  // Reflect なら型を偽らずに実行時のプロパティだけを取り除ける
  Reflect.deleteProperty(window, "electronAPI")
}
