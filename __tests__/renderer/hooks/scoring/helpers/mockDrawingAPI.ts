/**
 * Drawing API モックファクトリ
 *
 * アノテーション関連テストで使用するwindow.electronAPI.drawingのモック
 */

import { vi } from "vitest"

import type {
  DrawingAnnotation,
  DrawingCreateData,
} from "@/types/drawingAnnotation.types"

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

/** DrawingCreateDataからアノテーションを生成（createのモック用） */
function annotationFromCreateData(data: DrawingCreateData): DrawingAnnotation {
  return createMockAnnotation({
    id: data.id || `annotation-${crypto.randomUUID().slice(0, 8)}`,
    questionScoreId: data.questionScoreId,
    type: data.type,
    x: data.x,
    y: data.y,
    color: data.color || "#ef4444",
    strokeWidth: data.strokeWidth || 3,
    width: data.width || 0,
    height: data.height || 0,
    endX: data.endX || 0,
    endY: data.endY || 0,
    lineStyle: data.lineStyle || "solid",
    text: data.text || "",
    fontSize: data.fontSize || 16,
    textBoxWidth: data.textBoxWidth || 0,
    textBoxHeight: data.textBoxHeight || 0,
    horizontalAlign: data.horizontalAlign || "left",
    verticalAlign: data.verticalAlign || "top",
    anchorDirection: data.anchorDirection || "top-left",
    displayX: data.displayX || 0,
    displayY: data.displayY || 0,
  })
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
    create: vi.fn().mockImplementation(async (data: DrawingCreateData) => ({
      success: true,
      data: annotationFromCreateData(data),
    })),
    update: vi.fn().mockImplementation(async (id: string, data: unknown) => ({
      success: true,
      data: createMockAnnotation({ id, ...(data as object) }),
    })),
    delete: vi.fn().mockResolvedValue({ success: true }),
    getByQuestionScore: vi.fn().mockResolvedValue({
      success: true,
      data: [],
    }),
    getByExamStudent: vi.fn().mockResolvedValue({
      success: true,
      data: [],
    }),
    getByCropRegion: vi.fn().mockResolvedValue({
      success: true,
      data: [],
    }),
    batchCreate: vi
      .fn()
      .mockImplementation(async (dataList: DrawingCreateData[]) => ({
        success: true,
        data: dataList.map(annotationFromCreateData),
      })),
    deleteByQuestionScore: vi.fn().mockResolvedValue({ success: true }),
    toggleFavorite: vi
      .fn()
      .mockImplementation(async (id: string, isFavorite: boolean) => ({
        success: true,
        data: createMockAnnotation({ id, isFavorite }),
      })),
    getForBrowse: vi.fn().mockResolvedValue({
      success: true,
      data: [],
    }),
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
