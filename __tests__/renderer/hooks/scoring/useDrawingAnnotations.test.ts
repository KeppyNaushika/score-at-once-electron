// @vitest-environment jsdom
/**
 * useDrawingAnnotations フックのテスト
 *
 * DB CRUD操作とannotations状態の更新を検証する。
 * アノテーション再レンダリングの起点となるannotations配列の変更パターンを網羅。
 */

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  type DrawingPersistenceCallbacks,
  useDrawingAnnotations,
} from "@/components/exams/07-score-at-once/ScoringIndividual/hooks/core/useDrawingAnnotations"
import type { DrawingElement } from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import {
  cleanupMockDrawingAPI,
  createMockAnnotation,
  createMockDrawingAPI,
  type MockDrawingAPI,
} from "./helpers/mockDrawingAPI"

// MathJax依存をモック
vi.mock("@/app/textbox-on-canvas-v3/utils/mathJaxUtils", () => ({
  createMathJaxSVG: vi.fn(),
  measureMathJaxContentSize: vi
    .fn()
    .mockResolvedValue({ width: 200, height: 50 }),
}))

const CONTEXT = {
  currentStudentId: "student-1",
  currentCropRegionId: "crop-1",
  currentUserId: "user-1",
}

function makeElement(overrides: Partial<DrawingElement> = {}): DrawingElement {
  return {
    id: `el-${crypto.randomUUID().slice(0, 8)}`,
    type: "text",
    x: 0.1,
    y: 0.2,
    color: "#ef4444",
    strokeWidth: 3,
    ...overrides,
  }
}

describe("useDrawingAnnotations", () => {
  let mockAPI: MockDrawingAPI

  beforeEach(() => {
    mockAPI = createMockDrawingAPI()
  })

  afterEach(() => {
    cleanupMockDrawingAPI()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // 1. loadAnnotations — 設問変更時のDB読み込み
  // =========================================================================
  describe("loadAnnotations（設問変更時のDB読み込み）", () => {
    it("questionScoreIdを指定してアノテーションを読み込む", async () => {
      const annotations = [
        createMockAnnotation({ id: "a1" }),
        createMockAnnotation({ id: "a2" }),
      ]
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: annotations,
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      let loaded: DrawingAnnotation[] = []
      await act(async () => {
        loaded = await result.current.loadAnnotations("qs-1")
      })

      expect(mockAPI.getByQuestionScore).toHaveBeenCalledWith(
        "qs-1",
        undefined,
        "user-1"
      )
      expect(loaded).toHaveLength(2)
      expect(loaded[0].id).toBe("a1")
    })

    it("typeフィルタ付きで読み込む", async () => {
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [createMockAnnotation({ type: "line" })],
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      let loaded: DrawingAnnotation[] = []
      await act(async () => {
        loaded = await result.current.loadAnnotations("qs-1", "line")
      })

      expect(mockAPI.getByQuestionScore).toHaveBeenCalledWith(
        "qs-1",
        "line",
        "user-1"
      )
      expect(loaded[0].type).toBe("line")
    })

    it("読み込み失敗時にerror状態が設定される", async () => {
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: false,
        error: "読み込みエラー",
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      await act(async () => {
        const data = await result.current.loadAnnotations("qs-1")
        expect(data).toEqual([])
      })

      expect(result.current.error).toBeTruthy()
    })
  })

  // =========================================================================
  // 2. saveElement — 新規アノテーション作成
  // =========================================================================
  describe("saveElement（新規アノテーション作成）", () => {
    it("新規要素を保存すると作成されたアノテーションを返す", async () => {
      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      const element = makeElement({ id: "new-1", text: "新規テキスト" })
      await act(async () => {
        const saved = await result.current.saveElement(element, "qs-1")
        expect(saved).not.toBeNull()
      })

      expect(mockAPI.create).toHaveBeenCalledTimes(1)
    })

    it("コールバックonAnnotationCreatedが呼ばれる", async () => {
      const onCreated = vi.fn()
      const callbacks: DrawingPersistenceCallbacks = {
        onAnnotationCreated: onCreated,
      }

      const { result } = renderHook(() =>
        useDrawingAnnotations(callbacks, CONTEXT)
      )

      await act(async () => {
        await result.current.saveElement(makeElement(), "qs-1")
      })

      expect(onCreated).toHaveBeenCalledTimes(1)
    })

    it("userIdが未設定の場合エラーになる", async () => {
      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, {
          ...CONTEXT,
          currentUserId: undefined,
        })
      )

      await act(async () => {
        const saved = await result.current.saveElement(makeElement(), "qs-1")
        expect(saved).toBeNull()
      })

      expect(mockAPI.create).not.toHaveBeenCalled()
      expect(result.current.error).toBeTruthy()
    })

    it("API失敗時にnullを返す", async () => {
      mockAPI.create.mockResolvedValue({
        success: false,
        error: "作成失敗",
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      await act(async () => {
        const saved = await result.current.saveElement(makeElement(), "qs-1")
        expect(saved).toBeNull()
      })

      expect(mockAPI.create).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // 3. updateElement — 既存アノテーション更新
  // =========================================================================
  describe("updateElement（既存アノテーション更新）", () => {
    it("更新すると更新後のアノテーションを返す", async () => {
      const updated = createMockAnnotation({ id: "a1", x: 0.9 })
      mockAPI.update.mockResolvedValue({ success: true, data: updated })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      await act(async () => {
        const returned = await result.current.updateElement(
          makeElement({ id: "a1", x: 0.9 })
        )
        expect(returned?.x).toBe(0.9)
      })

      expect(mockAPI.update).toHaveBeenCalledTimes(1)
    })

    it("コールバックonAnnotationUpdatedが呼ばれる", async () => {
      const onUpdated = vi.fn()
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [createMockAnnotation({ id: "a1" })],
      })
      mockAPI.update.mockResolvedValue({
        success: true,
        data: createMockAnnotation({ id: "a1" }),
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations({ onAnnotationUpdated: onUpdated }, CONTEXT)
      )
      await act(async () => {
        await result.current.loadAnnotations("qs-1")
      })
      await act(async () => {
        await result.current.updateElement(makeElement({ id: "a1" }))
      })

      expect(onUpdated).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // 4. deleteElement — アノテーション削除
  // =========================================================================
  describe("deleteElement（アノテーション削除）", () => {
    it("削除に成功するとtrueを返し対象IDでAPIを呼ぶ", async () => {
      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      await act(async () => {
        const deleted = await result.current.deleteElement("a1")
        expect(deleted).toBe(true)
      })

      expect(mockAPI.delete).toHaveBeenCalledWith("a1")
    })

    it("コールバックonAnnotationDeletedが呼ばれる", async () => {
      const onDeleted = vi.fn()
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [createMockAnnotation({ id: "a1" })],
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations({ onAnnotationDeleted: onDeleted }, CONTEXT)
      )
      await act(async () => {
        await result.current.loadAnnotations("qs-1")
      })
      await act(async () => {
        await result.current.deleteElement("a1")
      })

      expect(onDeleted).toHaveBeenCalledWith("a1")
    })
  })

  // =========================================================================
  // 5. syncElements — 全要素同期（clearDrawingから呼ばれる）
  // =========================================================================
  describe("syncElements（全要素同期）", () => {
    it("空配列で同期するとannotationsがクリアされる", async () => {
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [createMockAnnotation({ id: "a1" })],
      })
      mockAPI.batchCreate.mockResolvedValue({ success: true, data: [] })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )
      await act(async () => {
        await result.current.loadAnnotations("qs-1")
      })
      await act(async () => {
        await result.current.syncElements([], "qs-1")
      })

      expect(mockAPI.deleteByQuestionScore).toHaveBeenCalled()
    })

    it("新しい要素で同期すると作成されたアノテーション配列を返す", async () => {
      const newAnnotations = [
        createMockAnnotation({ id: "new-1" }),
        createMockAnnotation({ id: "new-2" }),
      ]
      mockAPI.batchCreate.mockResolvedValue({
        success: true,
        data: newAnnotations,
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )
      await act(async () => {
        const synced = await result.current.syncElements(
          [makeElement({ id: "new-1" }), makeElement({ id: "new-2" })],
          "qs-1"
        )
        expect(synced).toHaveLength(2)
      })
    })
  })

  // =========================================================================
  // 7. isLoading状態の遷移
  // =========================================================================
  describe("isLoading状態", () => {
    it("読み込み中にisLoadingがtrueになる", async () => {
      let resolvePromise: (value: unknown) => void
      mockAPI.getByQuestionScore.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve
        })
      )

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      // 読み込み開始
      let loadPromise: Promise<DrawingAnnotation[]>
      act(() => {
        loadPromise = result.current.loadAnnotations("qs-1")
      })

      expect(result.current.isLoading).toBe(true)

      // 読み込み完了
      await act(async () => {
        resolvePromise!({ success: true, data: [] })
        await loadPromise!
      })

      expect(result.current.isLoading).toBe(false)
    })
  })
})
