/**
 * Drawing API モックファクトリ
 *
 * アノテーション関連テストで使用するwindow.electronAPI.drawingのモック
 */

import { vi } from "vitest"

import type {
  AnnotationTarget,
  DrawingAnnotation,
} from "@/types/drawingAnnotation.types"

/**
 * テストで使う注釈の行き先（答案＋設問＋採点者）。
 *
 * 注釈は置き場所（採点行）を持たない。保存の口はこの3つを受け取り、行が要るかは
 * main が決める。
 */
export const MOCK_ANNOTATION_TARGET: AnnotationTarget = {
  examStudentId: "es-1",
  cropRegionId: "cr-1",
  userId: "user-1",
}

/** テスト用アノテーションデータを作成 */
export function createMockAnnotation(
  overrides: Partial<DrawingAnnotation> = {}
): DrawingAnnotation {
  return {
    id: `annotation-${crypto.randomUUID().slice(0, 8)}`,
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
  getByTarget: ReturnType<typeof vi.fn>
  getByExamStudent: ReturnType<typeof vi.fn>
  getByCropRegion: ReturnType<typeof vi.fn>
  batchCreate: ReturnType<typeof vi.fn>
  deleteByTarget: ReturnType<typeof vi.fn>
  toggleFavorite: ReturnType<typeof vi.fn>
  getForBrowse: ReturnType<typeof vi.fn>
}

/**
 * window.electronAPI.drawing のモックを作成しwindowに設定する
 */
export function createMockDrawingAPI(): MockDrawingAPI {
  const mockDrawing: MockDrawingAPI = {
    // 作成は行き先と行を受け取り、行をそのまま返す。更新は行だけ
    create: vi
      .fn()
      .mockImplementation(
        async (_target: AnnotationTarget, annotation: DrawingAnnotation) =>
          annotation
      ),
    update: vi
      .fn()
      .mockImplementation(async (annotation: DrawingAnnotation) => annotation),
    delete: vi.fn().mockResolvedValue(undefined),
    getByTarget: vi.fn().mockResolvedValue([]),
    getByExamStudent: vi.fn().mockResolvedValue([]),
    getByCropRegion: vi.fn().mockResolvedValue([]),
    batchCreate: vi.fn().mockImplementation(
      async (
        writes: Array<{
          target: AnnotationTarget
          annotation: DrawingAnnotation
        }>
      ) => writes.map((write) => write.annotation)
    ),
    deleteByTarget: vi.fn().mockResolvedValue(undefined),
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
