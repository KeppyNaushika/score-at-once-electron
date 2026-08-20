// @vitest-environment jsdom
/**
 * useAnnotationBrowser フックのテスト
 *
 * ブラウザパネルでのアノテーション再レンダリングパターンを検証：
 *
 * [初回読み込み / 試験切り替え]
 *   - examId → getForBrowseで試験全体のアノテーション取得
 *
 * [フィルタ変更]
 *   - cropRegionId / examStudentId / type / favoritesOnlyフィルタ → displayItemsの再計算
 *
 * [重複グルーピング]
 *   - 同一プロパティのアノテーションをグループ化して表示（count + representative）
 *
 * [お気に入り切り替え]
 *   - toggleFavorite → 書き込み後に一覧を取り直す（手元の配列はつつかない）
 *
 * [アノテーション追加]
 *   - addToTargets → create/batchCreate
 *   - 同一設問 → 元の位置、異設問 → 中央配置
 */

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  type AddToTargetsParams,
  useAnnotationBrowser,
} from "@/components/exams/07-score-at-once/ScoringSidePanel/hooks/useAnnotationBrowser"
import type { AnnotationWithContext } from "@/types/drawingAnnotation.types"

import { createQueryWrapper } from "../../../helpers/queryWrapper"
import {
  cleanupMockDrawingAPI,
  createMockAnnotation,
  createMockDrawingAPI,
  type MockDrawingAPI,
} from "./helpers/mockDrawingAPI"

/** AnnotationWithContext型のモック作成 */
function createMockAnnotationWithContext(
  overrides: Partial<AnnotationWithContext> = {}
): AnnotationWithContext {
  const base = createMockAnnotation(overrides)
  return {
    ...base,
    questionScore: {
      id: "qs-1",
      examStudentId: "student-1",
      cropRegionId: "cr-1",
      cropRegion: { id: "cr-1", label: "問1" },
      student: {
        id: "student-1",
        studentNumber: "1",
        lastName: "テスト",
        firstName: "太郎",
      },
    },
    user: { id: "user-1", username: "testuser", name: "テストユーザー" },
    ...overrides,
  } as AnnotationWithContext
}

/** 一覧が取れるまで待ってからフックを返す */
function renderBrowser(examId = "exam-1") {
  return renderHook(() => useAnnotationBrowser(examId), {
    wrapper: createQueryWrapper(),
  })
}

describe("useAnnotationBrowser", () => {
  let mockAPI: MockDrawingAPI

  beforeEach(() => {
    mockAPI = createMockDrawingAPI()
  })

  afterEach(() => {
    cleanupMockDrawingAPI()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // 一覧の取得
  // =========================================================================
  describe("一覧の取得", () => {
    it("examIdで試験全体のアノテーションを取得する", async () => {
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({ id: "a1" }),
        createMockAnnotationWithContext({ id: "a2" }),
      ])

      const { result } = renderBrowser()

      await waitFor(() => {
        expect(result.current.allAnnotations).toHaveLength(2)
      })
      expect(mockAPI.getForBrowse).toHaveBeenCalledWith("exam-1")
    })

    it("reload で取り直すと一覧が置き換わる", async () => {
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({ id: "a1" }),
      ])

      const { result } = renderBrowser()
      await waitFor(() => {
        expect(result.current.allAnnotations).toHaveLength(1)
      })

      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({ id: "b1" }),
        createMockAnnotationWithContext({ id: "b2" }),
      ])
      await act(async () => {
        await result.current.reload()
      })

      await waitFor(() => {
        expect(result.current.allAnnotations).toHaveLength(2)
      })
    })
  })

  // =========================================================================
  // フィルタ変更 → displayItemsの再計算
  // =========================================================================
  describe("フィルタ変更", () => {
    it("cropRegionIdフィルタでdisplayItemsが絞り込まれる", async () => {
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({
          id: "a1",
          questionScore: {
            id: "qs-1",
            examStudentId: "s1",
            cropRegionId: "cr-1",
            cropRegion: { id: "cr-1", label: "問1" },
          },
        } as Partial<AnnotationWithContext>),
        createMockAnnotationWithContext({
          id: "a2",
          questionScore: {
            id: "qs-2",
            examStudentId: "s1",
            cropRegionId: "cr-2",
            cropRegion: { id: "cr-2", label: "問2" },
          },
        } as Partial<AnnotationWithContext>),
      ])

      const { result } = renderBrowser()
      await waitFor(() => {
        expect(result.current.allAnnotations).toHaveLength(2)
      })
      expect(result.current.displayItems).toHaveLength(2)

      // cr-1のみ
      act(() => {
        result.current.setFilters({ cropRegionId: "cr-1" })
      })
      expect(result.current.displayItems).toHaveLength(1)

      // フィルタ解除
      act(() => {
        result.current.setFilters({ cropRegionId: null })
      })
      expect(result.current.displayItems).toHaveLength(2)
    })

    it("typeフィルタ", async () => {
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({ id: "t1", type: "text" }),
        createMockAnnotationWithContext({ id: "l1", type: "line" }),
      ])

      const { result } = renderBrowser()
      await waitFor(() => {
        expect(result.current.allAnnotations).toHaveLength(2)
      })

      act(() => {
        result.current.setFilters({ type: "text" })
      })
      expect(result.current.displayItems).toHaveLength(1)
      expect(result.current.displayItems[0].representative.type).toBe("text")
    })

    it("favoritesOnlyフィルタ", async () => {
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({ id: "a1", isFavorite: true }),
        createMockAnnotationWithContext({ id: "a2", isFavorite: false }),
      ])

      const { result } = renderBrowser()
      await waitFor(() => {
        expect(result.current.allAnnotations).toHaveLength(2)
      })

      act(() => {
        result.current.setFilters({ favoritesOnly: true })
      })
      expect(result.current.displayItems).toHaveLength(1)
      expect(result.current.displayItems[0].representative.isFavorite).toBe(
        true
      )
    })
  })

  // =========================================================================
  // 重複グルーピング
  // =========================================================================
  describe("重複グルーピング", () => {
    // x, y, type, text, color, strokeWidth, fontSize, lineStyle, width, height, endX, endY, cropRegionIdが同一
    const baseProps = {
      type: "text" as const,
      text: "テスト",
      color: "#ef4444",
      strokeWidth: 3,
      fontSize: 16,
      lineStyle: "solid" as const,
      x: 0.1,
      y: 0.2,
      width: 0,
      height: 0,
      endX: 0,
      endY: 0,
    }

    it("同一プロパティのアノテーションがグループ化される", async () => {
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({ id: "a1", ...baseProps }),
        createMockAnnotationWithContext({ id: "a2", ...baseProps }),
        createMockAnnotationWithContext({ id: "a3", ...baseProps }),
      ])

      const { result } = renderBrowser()

      // 3件が1グループにまとまる
      await waitFor(() => {
        expect(result.current.displayItems).toHaveLength(1)
      })
      expect(result.current.displayItems[0].count).toBe(3)
      expect(result.current.displayItems[0].allIds).toHaveLength(3)
    })

    it("異なるプロパティのアノテーションは別グループ", async () => {
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({
          id: "a1",
          type: "text",
          text: "テスト1",
        }),
        createMockAnnotationWithContext({
          id: "a2",
          type: "text",
          text: "テスト2",
        }),
      ])

      const { result } = renderBrowser()

      await waitFor(() => {
        expect(result.current.displayItems).toHaveLength(2)
      })
      expect(result.current.displayItems[0].count).toBe(1)
      expect(result.current.displayItems[1].count).toBe(1)
    })

    it("グループ内にお気に入りが1件でもあればisFavorite=true", async () => {
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({
          id: "a1",
          isFavorite: false,
          ...baseProps,
        }),
        createMockAnnotationWithContext({
          id: "a2",
          isFavorite: true,
          ...baseProps,
        }),
      ])

      const { result } = renderBrowser()

      await waitFor(() => {
        expect(result.current.displayItems).toHaveLength(1)
      })
      expect(result.current.displayItems[0].isFavorite).toBe(true)
    })
  })

  // =========================================================================
  // toggleFavorite
  // =========================================================================
  describe("toggleFavorite（お気に入り切り替え）", () => {
    it("書き込んだあと一覧を取り直す（手元の配列はつつかない）", async () => {
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({ id: "a1", isFavorite: false }),
      ])

      const { result } = renderBrowser()
      await waitFor(() => {
        expect(result.current.allAnnotations).toHaveLength(1)
      })
      expect(result.current.allAnnotations[0].isFavorite).toBe(false)

      // DB が変わったことにする。取り直しでこれが載る
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({ id: "a1", isFavorite: true }),
      ])

      await act(async () => {
        await result.current.toggleFavorite("a1", false)
      })

      expect(mockAPI.toggleFavorite).toHaveBeenCalledWith("a1", true)
      await waitFor(() => {
        expect(result.current.allAnnotations[0].isFavorite).toBe(true)
      })
    })
  })

  // =========================================================================
  // addToTargets — ブラウザパネルからのアノテーション追加
  // =========================================================================
  describe("addToTargets（アノテーション追加）", () => {
    it("単一ターゲットにcreateで追加される", async () => {
      const { result } = renderBrowser()
      await waitFor(() => {
        expect(mockAPI.getForBrowse).toHaveBeenCalled()
      })

      const source = createMockAnnotationWithContext({
        id: "source-1",
        x: 0.3,
        y: 0.4,
      })

      const params: AddToTargetsParams = {
        sourceAnnotation: source,
        targets: [
          {
            examStudentId: "student-2",
            cropRegionId: "cr-1",
            userId: "user-1",
          },
        ],
        targetCropRegionId: "cr-1",
        sourceCropRegionId: "cr-1", // 同一設問
      }

      await act(async () => {
        await result.current.addToTargets(params)
      })

      expect(mockAPI.create).toHaveBeenCalledTimes(1)
      // 行き先は答案＋設問＋採点者。置き場所の採点行は渡さない
      const [target, annotation] = mockAPI.create.mock.calls[0]
      expect(target).toEqual({
        examStudentId: "student-2",
        cropRegionId: "cr-1",
        userId: "user-1",
      })
      expect("questionScoreId" in annotation).toBe(false)
      // 同一設問なので元の位置を保持
      expect(annotation.x).toBe(0.3)
      expect(annotation.y).toBe(0.4)
    })

    it("複数ターゲットにbatchCreateで追加される", async () => {
      const { result } = renderBrowser()
      await waitFor(() => {
        expect(mockAPI.getForBrowse).toHaveBeenCalled()
      })

      const params: AddToTargetsParams = {
        sourceAnnotation: createMockAnnotationWithContext({ id: "source-1" }),
        targets: ["student-2", "student-3", "student-4"].map(
          (examStudentId) => ({
            examStudentId,
            cropRegionId: "cr-1",
            userId: "user-1",
          })
        ),
        targetCropRegionId: "cr-1",
        sourceCropRegionId: "cr-1",
      }

      await act(async () => {
        await result.current.addToTargets(params)
      })

      expect(mockAPI.batchCreate).toHaveBeenCalledTimes(1)
      expect(mockAPI.batchCreate.mock.calls[0][0]).toHaveLength(3)
    })

    it("異設問への追加時に中央配置される（line型）", async () => {
      const { result } = renderBrowser()
      await waitFor(() => {
        expect(mockAPI.getForBrowse).toHaveBeenCalled()
      })

      const source = createMockAnnotationWithContext({
        id: "source-1",
        type: "line",
        x: 0.1,
        y: 0.1,
        endX: 0.3,
        endY: 0.3,
      })

      const params: AddToTargetsParams = {
        sourceAnnotation: source,
        targets: [
          {
            examStudentId: "student-2",
            cropRegionId: "cr-2",
            userId: "user-1",
          },
        ],
        targetCropRegionId: "cr-2", // 異なる設問
        sourceCropRegionId: "cr-1",
      }

      await act(async () => {
        await result.current.addToTargets(params)
      })

      const createData = mockAPI.create.mock.calls[0][1]
      // 中央配置: midX=(0.1+0.3)/2=0.2, offset=0.5-0.2=0.3
      expect(createData.x).toBeCloseTo(0.4) // 0.1 + 0.3
      expect(createData.endX).toBeCloseTo(0.6) // 0.3 + 0.3
    })

    it("異設問への追加時に中央配置される（rect型）", async () => {
      const { result } = renderBrowser()
      await waitFor(() => {
        expect(mockAPI.getForBrowse).toHaveBeenCalled()
      })

      const source = createMockAnnotationWithContext({
        id: "source-1",
        type: "rectangle",
        x: 0.1,
        y: 0.1,
        width: 0.2,
        height: 0.2,
      })

      const params: AddToTargetsParams = {
        sourceAnnotation: source,
        targets: [
          {
            examStudentId: "student-2",
            cropRegionId: "cr-2",
            userId: "user-1",
          },
        ],
        targetCropRegionId: "cr-2",
        sourceCropRegionId: "cr-1",
      }

      await act(async () => {
        await result.current.addToTargets(params)
      })

      const createData = mockAPI.create.mock.calls[0][1]
      // 中央配置: 0.5 - 0.2/2 = 0.4
      expect(createData.x).toBeCloseTo(0.4)
      expect(createData.y).toBeCloseTo(0.4)
    })

    it("ターゲットが空配列の場合は何も行わない", async () => {
      const { result } = renderBrowser()
      await waitFor(() => {
        expect(mockAPI.getForBrowse).toHaveBeenCalled()
      })

      const params: AddToTargetsParams = {
        sourceAnnotation: createMockAnnotationWithContext(),
        targets: [],
        targetCropRegionId: "cr-1",
        sourceCropRegionId: "cr-1",
      }

      await act(async () => {
        await result.current.addToTargets(params)
      })

      expect(mockAPI.create).not.toHaveBeenCalled()
      expect(mockAPI.batchCreate).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // ソート順
  // =========================================================================
  describe("ソート順", () => {
    it("お気に入りが優先表示される", async () => {
      mockAPI.getForBrowse.mockResolvedValue([
        createMockAnnotationWithContext({
          id: "a1",
          isFavorite: false,
          text: "通常",
          updatedAt: new Date("2026-01-02"),
        }),
        createMockAnnotationWithContext({
          id: "a2",
          isFavorite: true,
          text: "お気に入り",
          updatedAt: new Date("2026-01-01"),
        }),
      ])

      const { result } = renderBrowser()

      // お気に入りが先
      await waitFor(() => {
        expect(result.current.displayItems).toHaveLength(2)
      })
      expect(result.current.displayItems[0].representative.text).toBe(
        "お気に入り"
      )
    })
  })
})
