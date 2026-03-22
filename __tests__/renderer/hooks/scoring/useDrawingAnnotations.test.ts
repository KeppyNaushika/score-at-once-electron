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
import type { DrawingElement } from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"
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

      await act(async () => {
        await result.current.loadAnnotations("qs-1")
      })

      expect(mockAPI.getByQuestionScore).toHaveBeenCalledWith(
        "qs-1",
        undefined,
        "user-1"
      )
      expect(result.current.annotations).toHaveLength(2)
      expect(result.current.annotations[0].id).toBe("a1")
    })

    it("typeフィルタ付きで読み込む", async () => {
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [createMockAnnotation({ type: "line" })],
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      await act(async () => {
        await result.current.loadAnnotations("qs-1", "line")
      })

      expect(mockAPI.getByQuestionScore).toHaveBeenCalledWith(
        "qs-1",
        "line",
        "user-1"
      )
      expect(result.current.annotations[0].type).toBe("line")
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

    it("再読み込みでannotations配列が完全に置換される", async () => {
      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      // 初回読み込み
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [createMockAnnotation({ id: "a1" })],
      })
      await act(async () => {
        await result.current.loadAnnotations("qs-1")
      })
      expect(result.current.annotations).toHaveLength(1)

      // 別の設問を読み込み
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [
          createMockAnnotation({ id: "b1" }),
          createMockAnnotation({ id: "b2" }),
          createMockAnnotation({ id: "b3" }),
        ],
      })
      await act(async () => {
        await result.current.loadAnnotations("qs-2")
      })

      expect(result.current.annotations).toHaveLength(3)
      expect(result.current.annotations[0].id).toBe("b1")
    })
  })

  // =========================================================================
  // 2. saveElement — 新規アノテーション作成
  // =========================================================================
  describe("saveElement（新規アノテーション作成）", () => {
    it("新規要素を保存してannotationsに追加される", async () => {
      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      const element = makeElement({ id: "new-1", text: "新規テキスト" })
      await act(async () => {
        const saved = await result.current.saveElement(element, "qs-1")
        expect(saved).not.toBeNull()
      })

      expect(mockAPI.create).toHaveBeenCalledTimes(1)
      expect(result.current.annotations).toHaveLength(1)
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

    it("API失敗時にannotationsに追加されない", async () => {
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

      expect(result.current.annotations).toHaveLength(0)
    })
  })

  // =========================================================================
  // 3. updateElement — 既存アノテーション更新
  // =========================================================================
  describe("updateElement（既存アノテーション更新）", () => {
    it("更新後にannotations内の対象要素が置換される", async () => {
      // まず読み込み
      const original = createMockAnnotation({ id: "a1", x: 0.1 })
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [original],
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )
      await act(async () => {
        await result.current.loadAnnotations("qs-1")
      })

      // 更新
      const updated = createMockAnnotation({ id: "a1", x: 0.9 })
      mockAPI.update.mockResolvedValue({ success: true, data: updated })

      await act(async () => {
        await result.current.updateElement(makeElement({ id: "a1", x: 0.9 }))
      })

      expect(result.current.annotations[0].x).toBe(0.9)
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
    it("削除後にannotationsから除去される", async () => {
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [
          createMockAnnotation({ id: "a1" }),
          createMockAnnotation({ id: "a2" }),
        ],
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )
      await act(async () => {
        await result.current.loadAnnotations("qs-1")
      })
      expect(result.current.annotations).toHaveLength(2)

      await act(async () => {
        await result.current.deleteElement("a1")
      })

      expect(result.current.annotations).toHaveLength(1)
      expect(result.current.annotations[0].id).toBe("a2")
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
  // 5. deleteByType — タイプ別一括削除
  // =========================================================================
  describe("deleteByType（タイプ別一括削除）", () => {
    it("指定タイプのアノテーションのみ削除される", async () => {
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [
          createMockAnnotation({
            id: "t1",
            type: "text",
            questionScoreId: "qs-1",
          }),
          createMockAnnotation({
            id: "l1",
            type: "line",
            questionScoreId: "qs-1",
          }),
        ],
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )
      await act(async () => {
        await result.current.loadAnnotations("qs-1")
      })

      await act(async () => {
        await result.current.deleteByType("qs-1", "text")
      })

      expect(result.current.annotations).toHaveLength(1)
      expect(result.current.annotations[0].type).toBe("line")
    })

    it("タイプ未指定で全削除される", async () => {
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [
          createMockAnnotation({ id: "a1", questionScoreId: "qs-1" }),
          createMockAnnotation({ id: "a2", questionScoreId: "qs-1" }),
        ],
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )
      await act(async () => {
        await result.current.loadAnnotations("qs-1")
      })
      await act(async () => {
        await result.current.deleteByType("qs-1")
      })

      expect(result.current.annotations).toHaveLength(0)
    })
  })

  // =========================================================================
  // 6. syncElements — 全要素同期（clearDrawingから呼ばれる）
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
      expect(result.current.annotations).toHaveLength(0)
    })

    it("新しい要素で同期するとannotationsが置換される", async () => {
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
        await result.current.syncElements(
          [makeElement({ id: "new-1" }), makeElement({ id: "new-2" })],
          "qs-1"
        )
      })

      expect(result.current.annotations).toHaveLength(2)
    })
  })

  // =========================================================================
  // 7. loadAllStudentAnnotations — 透明度制御用の全設問読み込み
  // =========================================================================
  describe("loadAllStudentAnnotations（透明度制御用）", () => {
    it("学生IDと試験IDで全アノテーションを取得する", async () => {
      const allAnnotations = [
        createMockAnnotation({ id: "a1", questionScoreId: "qs-1" }),
        createMockAnnotation({ id: "a2", questionScoreId: "qs-2" }),
      ]
      mockAPI.getByStudent.mockResolvedValue({
        success: true,
        data: allAnnotations,
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )

      let loaded: unknown[] = []
      await act(async () => {
        loaded = await result.current.loadAllStudentAnnotations(
          "student-1",
          "exam-1"
        )
      })

      expect(mockAPI.getByStudent).toHaveBeenCalledWith(
        "student-1",
        "exam-1",
        undefined,
        "user-1"
      )
      expect(loaded).toHaveLength(2)
    })
  })

  // =========================================================================
  // 8. clearCache — キャッシュクリア
  // =========================================================================
  describe("clearCache（キャッシュクリア）", () => {
    it("annotations・stats・errorがすべてクリアされる", async () => {
      mockAPI.getByQuestionScore.mockResolvedValue({
        success: true,
        data: [createMockAnnotation()],
      })

      const { result } = renderHook(() =>
        useDrawingAnnotations(undefined, CONTEXT)
      )
      await act(async () => {
        await result.current.loadAnnotations("qs-1")
      })
      expect(result.current.annotations).toHaveLength(1)

      act(() => {
        result.current.clearCache()
      })

      expect(result.current.annotations).toHaveLength(0)
      expect(result.current.error).toBeNull()
    })
  })

  // =========================================================================
  // 9. isLoading状態の遷移
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
