// @vitest-environment jsdom
/**
 * useAllStudentAnnotations フックのテスト
 *
 * 透明度制御用の全設問アノテーション読み込みパターンを検証：
 *
 * [生徒切り替え]
 *   - currentExamStudentId変更 → getByExamStudentで全設問のアノテーション再取得
 *
 * [設問切り替え]
 *   - currentCropRegion変更（examIdが変わる場合） → 再取得
 *   - currentCropRegion変更（同一examId内） → cropRegion.idが変わると再取得
 *
 * [リフレッシュキー変更]
 *   - refreshKey変更 → 再取得（キャンバスでのアノテーション変更後）
 *
 * [データなし]
 *   - examStudentId/cropRegion未設定 → 空配列
 */

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useAllStudentAnnotations } from "@/components/exams/07-score-at-once/ScoringIndividual/hooks/view/useAllStudentAnnotations"
import type { CropRegionWithExamPage } from "@/components/exams/07-score-at-once/types"

import { createQueryWrapper } from "../../../helpers/queryWrapper"
import {
  cleanupMockDrawingAPI,
  createMockAnnotation,
  createMockDrawingAPI,
  type MockDrawingAPI,
} from "./helpers/mockDrawingAPI"

function makeCropRegion(
  overrides: Partial<{ id: string; examId: string; label: string }> = {}
): CropRegionWithExamPage {
  return {
    id: overrides.id || "cr-1",
    label: overrides.label || "問1",
    examPage: {
      examId: overrides.examId || "exam-1",
    },
  } as CropRegionWithExamPage
}

describe("useAllStudentAnnotations", () => {
  let mockAPI: MockDrawingAPI

  beforeEach(() => {
    mockAPI = createMockDrawingAPI()
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    cleanupMockDrawingAPI()
    vi.restoreAllMocks()
  })

  describe("currentExamStudentId変更（生徒切り替え）", () => {
    it("生徒変更で全設問のアノテーションを再取得する", async () => {
      const annotations = [
        createMockAnnotation({ id: "a1", questionScoreId: "qs-1" }),
        createMockAnnotation({ id: "a2", questionScoreId: "qs-2" }),
      ]
      mockAPI.getByExamStudent.mockResolvedValue(annotations)

      const { result } = renderHook(
        () =>
          useAllStudentAnnotations({
            currentExamStudentId: "student-1",
            currentCropRegion: makeCropRegion(),
            currentUserId: "user-1",
          }),
        { wrapper: createQueryWrapper() }
      )

      await waitFor(() => {
        expect(result.current.allStudentAnnotations).toHaveLength(2)
      })

      expect(mockAPI.getByExamStudent).toHaveBeenCalledWith(
        "student-1",
        undefined,
        "user-1"
      )
    })

    it("生徒IDが変更されるとデータが再取得される", async () => {
      mockAPI.getByExamStudent.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
      ])

      const { result, rerender } = renderHook(
        ({ examStudentId }) =>
          useAllStudentAnnotations({
            currentExamStudentId: examStudentId,
            currentCropRegion: makeCropRegion(),
            currentUserId: "user-1",
          }),
        {
          initialProps: { examStudentId: "student-1" },
          wrapper: createQueryWrapper(),
        }
      )

      await waitFor(() => {
        expect(result.current.allStudentAnnotations).toHaveLength(1)
      })

      mockAPI.getByExamStudent.mockResolvedValue([
        createMockAnnotation({ id: "b1" }),
        createMockAnnotation({ id: "b2" }),
        createMockAnnotation({ id: "b3" }),
      ])

      rerender({ examStudentId: "student-2" })

      await waitFor(() => {
        expect(result.current.allStudentAnnotations).toHaveLength(3)
      })
    })
  })

  describe("currentCropRegion変更（設問切り替え）", () => {
    // 取得は受験者と操作者だけで決まる（要求に設問領域は入らない）。
    // 設問を切り替えただけで取り直しても同じ答えが返るので、取り直さない。
    // 描いた内容が変わったことは refreshKey が知らせる。
    it("設問を切り替えても取り直さない", async () => {
      mockAPI.getByExamStudent.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
      ])

      const { rerender } = renderHook(
        ({ cropRegion }) =>
          useAllStudentAnnotations({
            currentExamStudentId: "student-1",
            currentCropRegion: cropRegion,
            currentUserId: "user-1",
          }),
        {
          initialProps: { cropRegion: makeCropRegion({ id: "cr-1" }) },
          wrapper: createQueryWrapper(),
        }
      )

      await waitFor(() => {
        expect(mockAPI.getByExamStudent).toHaveBeenCalled()
      })
      const callCount = mockAPI.getByExamStudent.mock.calls.length

      rerender({ cropRegion: makeCropRegion({ id: "cr-2", examId: "exam-1" }) })

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
      expect(mockAPI.getByExamStudent.mock.calls.length).toBe(callCount)
    })
  })

  describe("refreshKey変更（アノテーション変更通知）", () => {
    it("refreshKey変更で再取得される", async () => {
      mockAPI.getByExamStudent.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
      ])

      const { result, rerender } = renderHook(
        ({ refreshKey }) =>
          useAllStudentAnnotations({
            currentExamStudentId: "student-1",
            currentCropRegion: makeCropRegion(),
            currentUserId: "user-1",
            refreshKey,
          }),
        { initialProps: { refreshKey: 0 }, wrapper: createQueryWrapper() }
      )

      await waitFor(() => {
        expect(result.current.allStudentAnnotations).toHaveLength(1)
      })

      mockAPI.getByExamStudent.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
        createMockAnnotation({ id: "a2" }),
      ])

      rerender({ refreshKey: 1 })

      await waitFor(() => {
        expect(result.current.allStudentAnnotations).toHaveLength(2)
      })
    })
  })

  describe("パラメータ未設定", () => {
    it("examStudentId未設定で空配列を返す", async () => {
      const { result } = renderHook(
        () =>
          useAllStudentAnnotations({
            currentExamStudentId: undefined,
            currentCropRegion: makeCropRegion(),
            currentUserId: "user-1",
          }),
        { wrapper: createQueryWrapper() }
      )

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      expect(result.current.allStudentAnnotations).toHaveLength(0)
      expect(mockAPI.getByExamStudent).not.toHaveBeenCalled()
    })

    it("cropRegion未設定で空配列を返す", async () => {
      const { result } = renderHook(
        () =>
          useAllStudentAnnotations({
            currentExamStudentId: "student-1",
            currentCropRegion: null,
            currentUserId: "user-1",
          }),
        { wrapper: createQueryWrapper() }
      )

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      expect(result.current.allStudentAnnotations).toHaveLength(0)
      expect(mockAPI.getByExamStudent).not.toHaveBeenCalled()
    })
  })

  describe("API失敗時", () => {
    it("失敗時に空配列を返す", async () => {
      mockAPI.getByExamStudent.mockRejectedValue(new Error("取得エラー"))

      const { result } = renderHook(
        () =>
          useAllStudentAnnotations({
            currentExamStudentId: "student-1",
            currentCropRegion: makeCropRegion(),
            currentUserId: "user-1",
          }),
        { wrapper: createQueryWrapper() }
      )

      await waitFor(() => {
        expect(mockAPI.getByExamStudent).toHaveBeenCalled()
      })

      expect(result.current.allStudentAnnotations).toHaveLength(0)
    })
  })
})
