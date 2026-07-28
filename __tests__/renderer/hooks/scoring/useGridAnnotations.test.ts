// @vitest-environment jsdom
/**
 * useGridAnnotations フックのテスト
 *
 * Grid表示（一覧表示）でのアノテーション再レンダリングパターンを検証：
 *
 * [設問切り替え]
 *   - cropRegionId変更 → getByCropRegionで全学生のアノテーション再取得
 *
 * [リフレッシュキー変更]
 *   - refreshKey変更 → 同一cropRegionIdで再取得（ブラウザパネルからの追加後など）
 *
 * [データなし]
 *   - cropRegionId未指定 → 空のMapを返す
 *
 * [examStudentIdグループ化]
 *   - 取得結果をexamStudentIdでグループ化してMapに格納
 */

import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useGridAnnotations } from "@/components/exams/07-score-at-once/ScoringGrid/hooks/useGridAnnotations"

import {
  cleanupMockDrawingAPI,
  createMockAnnotation,
  createMockDrawingAPI,
  type MockDrawingAPI,
} from "./helpers/mockDrawingAPI"

describe("useGridAnnotations", () => {
  let mockAPI: MockDrawingAPI

  beforeEach(() => {
    mockAPI = createMockDrawingAPI()
  })

  afterEach(() => {
    cleanupMockDrawingAPI()
    vi.restoreAllMocks()
  })

  describe("cropRegionId変更（設問切り替え）", () => {
    it("cropRegionId指定で全受験者のアノテーションを取得しexamStudentIdでグループ化する", async () => {
      const annotations = [
        {
          ...createMockAnnotation({ id: "a1" }),
          questionScore: {
            examStudentId: "s1",
            cropRegionId: "cr-1",
            id: "qs-1",
          },
        },
        {
          ...createMockAnnotation({ id: "a2" }),
          questionScore: {
            examStudentId: "s1",
            cropRegionId: "cr-1",
            id: "qs-2",
          },
        },
        {
          ...createMockAnnotation({ id: "a3" }),
          questionScore: {
            examStudentId: "s2",
            cropRegionId: "cr-1",
            id: "qs-3",
          },
        },
      ]
      mockAPI.getByCropRegion.mockResolvedValue({
        success: true,
        data: annotations,
      })

      const { result } = renderHook(() =>
        useGridAnnotations({
          cropRegionId: "cr-1",
          currentUserId: "user-1",
        })
      )

      await waitFor(() => {
        expect(result.current.annotationsByExamStudent.size).toBe(2)
      })

      expect(result.current.annotationsByExamStudent.get("s1")).toHaveLength(2)
      expect(result.current.annotationsByExamStudent.get("s2")).toHaveLength(1)
    })

    it("cropRegionIdが変更されると新しいデータを取得する", async () => {
      mockAPI.getByCropRegion.mockResolvedValue({
        success: true,
        data: [
          {
            ...createMockAnnotation({ id: "a1" }),
            questionScore: {
              examStudentId: "s1",
              cropRegionId: "cr-1",
              id: "qs-1",
            },
          },
        ],
      })

      const { result, rerender } = renderHook(
        ({ cropRegionId }) =>
          useGridAnnotations({ cropRegionId, currentUserId: "user-1" }),
        { initialProps: { cropRegionId: "cr-1" as string | undefined } }
      )

      await waitFor(() => {
        expect(result.current.annotationsByExamStudent.size).toBe(1)
      })

      mockAPI.getByCropRegion.mockResolvedValue({
        success: true,
        data: [
          {
            ...createMockAnnotation({ id: "b1" }),
            questionScore: {
              examStudentId: "s2",
              cropRegionId: "cr-2",
              id: "qs-4",
            },
          },
          {
            ...createMockAnnotation({ id: "b2" }),
            questionScore: {
              examStudentId: "s3",
              cropRegionId: "cr-2",
              id: "qs-5",
            },
          },
        ],
      })

      rerender({ cropRegionId: "cr-2" })

      await waitFor(() => {
        expect(result.current.annotationsByExamStudent.size).toBe(2)
      })

      expect(result.current.annotationsByExamStudent.has("s2")).toBe(true)
      expect(result.current.annotationsByExamStudent.has("s3")).toBe(true)
    })
  })

  describe("cropRegionId未指定", () => {
    it("空のMapを返しAPIを呼ばない", async () => {
      const { result } = renderHook(() =>
        useGridAnnotations({
          cropRegionId: undefined,
          currentUserId: "user-1",
        })
      )

      expect(result.current.annotationsByExamStudent.size).toBe(0)
      expect(mockAPI.getByCropRegion).not.toHaveBeenCalled()
    })
  })

  describe("refreshKey変更（外部からのアノテーション変更通知）", () => {
    it("refreshKey変更で同一cropRegionIdのデータを再取得する", async () => {
      mockAPI.getByCropRegion.mockResolvedValue({
        success: true,
        data: [
          {
            ...createMockAnnotation({ id: "a1" }),
            questionScore: {
              examStudentId: "s1",
              cropRegionId: "cr-1",
              id: "qs-1",
            },
          },
        ],
      })

      const { result, rerender } = renderHook(
        ({ refreshKey }) =>
          useGridAnnotations({
            cropRegionId: "cr-1",
            currentUserId: "user-1",
            refreshKey,
          }),
        { initialProps: { refreshKey: 0 } }
      )

      await waitFor(() => {
        expect(result.current.annotationsByExamStudent.size).toBe(1)
      })

      mockAPI.getByCropRegion.mockResolvedValue({
        success: true,
        data: [
          {
            ...createMockAnnotation({ id: "a1" }),
            questionScore: {
              examStudentId: "s1",
              cropRegionId: "cr-1",
              id: "qs-1",
            },
          },
          {
            ...createMockAnnotation({ id: "a2" }),
            questionScore: {
              examStudentId: "s1",
              cropRegionId: "cr-1",
              id: "qs-2",
            },
          },
        ],
      })

      rerender({ refreshKey: 1 })

      await waitFor(() => {
        expect(result.current.annotationsByExamStudent.get("s1")).toHaveLength(
          2
        )
      })
    })
  })

  describe("API失敗時", () => {
    it("失敗時に空のMapを返す", async () => {
      mockAPI.getByCropRegion.mockResolvedValue({
        success: false,
        error: "取得エラー",
      })

      const { result } = renderHook(() =>
        useGridAnnotations({
          cropRegionId: "cr-1",
          currentUserId: "user-1",
        })
      )

      await waitFor(() => {
        expect(result.current.annotationsByExamStudent.size).toBe(0)
      })
    })
  })
})
