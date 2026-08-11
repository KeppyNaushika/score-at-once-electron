/**
 * Drawing API モックファクトリ
 *
 * アノテーション関連テストで使用するwindow.electronAPI.drawingのモック
 */

import { vi } from "vitest"

import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

/** テスト用アノテーションデータを作成 */
export function createMockAnnotation(
  overrides: Partial<DrawingAnnotation> = {}
): DrawingAnnotation {
  return {
    id: `annotation-${crypto.randomUUID().slice(0, 8)}`,
    questionScoreId: "qs-1",
    type: "text",
    x: 0.1,
    y: 0.2,
    color: "#ef4444",
    strokeWidth: 3,
    width: 0,
    height: 0,
    endX: 0,
    endY: 0,
    lineStyle: "solid",
    text: "テスト",
    fontSize: 16,
    textBoxWidth: 0,
    textBoxHeight: 0,
    horizontalAlign: "left",
    verticalAlign: "top",
    anchorDirection: "top-left",
    displayX: 0,
    displayY: 0,
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export interface MockDrawingAPI {
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  getByQuestionScore: ReturnType<typeof vi.fn>
  getByExamStudent: ReturnType<typeof vi.fn>
  getByCropRegion: ReturnType<typeof vi.fn>
  batchCreate: ReturnType<typeof vi.fn>
  deleteByQuestionScore: ReturnType<typeof vi.fn>
  toggleFavorite: ReturnType<typeof vi.fn>
  getForBrowse: ReturnType<typeof vi.fn>
}

/**
 * window.electronAPI.drawing のモックを作成しwindowに設定する
 */
export function createMockDrawingAPI(): MockDrawingAPI {
  const mockDrawing: MockDrawingAPI = {
    // 作成も更新も行そのものを受け取り、そのまま返す
    create: vi
      .fn()
      .mockImplementation(async (annotation: DrawingAnnotation) => annotation),
    update: vi
      .fn()
      .mockImplementation(async (annotation: DrawingAnnotation) => annotation),
    delete: vi.fn().mockResolvedValue(undefined),
    getByQuestionScore: vi.fn().mockResolvedValue([]),
    getByExamStudent: vi.fn().mockResolvedValue([]),
    getByCropRegion: vi.fn().mockResolvedValue([]),
    batchCreate: vi
      .fn()
      .mockImplementation(
        async (annotations: DrawingAnnotation[]) => annotations
      ),
    deleteByQuestionScore: vi.fn().mockResolvedValue(undefined),
    toggleFavorite: vi
      .fn()
      .mockImplementation(async (id: string, isFavorite: boolean) =>
        createMockAnnotation({ id, isFavorite })
      ),
    getForBrowse: vi.fn().mockResolvedValue([]),
  }

  Object.defineProperty(window, "electronAPI", {
    value: { drawing: mockDrawing },
    writable: true,
    configurable: true,
  })

  return mockDrawing
}

/** window.electronAPI をクリーンアップ */
export function cleanupMockDrawingAPI() {
  // window.electronAPI は必須プロパティとして宣言されているため delete 演算子は使えない。
  // Reflect なら型を偽らずに実行時のプロパティだけを取り除ける
  Reflect.deleteProperty(window, "electronAPI")
}
