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
  detectConflicts: ReturnType<typeof vi.fn>
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
      success: true,
      filePath: "/path/to/test.score",
    }),
    analyzeArchive: vi.fn().mockResolvedValue({
      success: true,
      manifest: createMockManifest(),
    }),
    preMatch: vi.fn().mockResolvedValue({
      success: true,
      data: createMockFileOverviewData(),
    }),
    detectConflicts: vi.fn().mockResolvedValue({
      success: true,
      results: [],
    }),
    detectScoringConflicts: vi.fn().mockResolvedValue({
      success: true,
      data: createMockScoringConflictData(),
    }),
    idIntegrationImport: vi.fn().mockResolvedValue({
      success: true,
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
    getAuthToken: vi.fn().mockResolvedValue({ success: true, token: null }),
    fetchUsers: vi.fn().mockResolvedValue([]),
    clearAuthToken: vi.fn().mockResolvedValue({ success: true }),
    saveAuthToken: vi.fn().mockResolvedValue({ success: true }),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).electronAPI
}
