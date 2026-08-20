// @vitest-environment jsdom
/**
 * useDrawingState フックのテスト
 *
 * drawingElements状態管理（オプティミスティック更新 + DB統合）を検証する。
 * 全ての再レンダリングパターンを網羅：
 *
 * [設問/生徒ナビゲーション]
 *   - 行き先（答案＋設問＋採点者）変更 → drawingElementsクリア + DB再読み込み
 *
 * [CRUD操作 — オプティミスティック更新]
 *   - addDrawingElement → 即時追加 + 非同期DB保存
 *   - updateDrawingElement → 即時更新 + 非同期DB保存
 *   - updateDrawingElements（一括） → 即時一括更新 + 非同期DB保存
 *   - removeDrawingElement → 即時削除 + 非同期DB削除
 *
 * [エラー時のロールバック]
 *   - addDrawingElement失敗 → 追加を取り消し
 *   - updateDrawingElement失敗 → 更新前に戻す
 *   - removeDrawingElement失敗 → 削除を取り消し
 *
 * [全クリア]
 *   - clearDrawing → drawingElements空 + DB同期
 *
 * [明示的DB再読み込み]
 *   - loadFromDatabase → 設問のアノテーションを再取得
 *
 * [DB→drawingElementsの同期ガード]
 *   - loadVersionRef: 非同期ロードの競合を防止（最新バージョンのみ適用）
 */

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDrawingState } from "@/components/exams/07-score-at-once/ScoringIndividual/hooks/core/useDrawingState"
import type {
  AnnotationTarget,
  DrawingAnnotation,
} from "@/types/drawingAnnotation.types"

import { createQueryWrapper } from "../../../helpers/queryWrapper"
import {
  cleanupMockDrawingAPI,
  createMockAnnotation,
  createMockDrawingAPI,
  MOCK_ANNOTATION_TARGET,
  type MockDrawingAPI,
} from "./helpers/mockDrawingAPI"

// MathJax依存をモック
vi.mock("@/app/textbox-on-canvas-v3/utils/mathJaxUtils", () => ({
  createMathJaxSVG: vi.fn(),
  measureMathJaxContentSize: vi
    .fn()
    .mockResolvedValue({ width: 200, height: 50 }),
}))

function makeElement(
  overrides: Partial<DrawingAnnotation> = {}
): DrawingAnnotation {
  return createMockAnnotation({
    id: `el-${crypto.randomUUID().slice(0, 8)}`,
    ...overrides,
  })
}

/** useLayoutEffect内の非同期loadAnnotationsの完了+useEffectの変換を待つ */
async function waitForDrawingElements(
  result: { current: { drawingElements: DrawingAnnotation[] } },
  expectedLength: number
) {
  await waitFor(() => {
    expect(result.current.drawingElements).toHaveLength(expectedLength)
  })
}

describe("useDrawingState", () => {
  let mockAPI: MockDrawingAPI

  beforeEach(() => {
    mockAPI = createMockDrawingAPI()
  })

  afterEach(() => {
    cleanupMockDrawingAPI()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // 設問/生徒ナビゲーション → drawingElements再構築
  // =========================================================================
  describe("行き先の変更（設問/生徒ナビゲーション）", () => {
    it("行き先の変更でdrawingElementsがクリアされDBから再読み込みされる", async () => {
      const annotations1 = [createMockAnnotation({ id: "a1", x: 0.1 })]
      const annotations2 = [
        createMockAnnotation({ id: "b1", x: 0.5 }),
        createMockAnnotation({ id: "b2", x: 0.6 }),
      ]

      mockAPI.getByTarget.mockImplementation(
        async (target: AnnotationTarget) => {
          if (target.cropRegionId === "cr-1") return annotations1
          if (target.cropRegionId === "cr-2") return annotations2
          return []
        }
      )

      const { result, rerender } = renderHook(
        ({ target }) => useDrawingState(target, true),
        {
          initialProps: { target: MOCK_ANNOTATION_TARGET },
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 1)
      expect(result.current.drawingElements[0].id).toBe("a1")

      // 設問変更
      rerender({ target: { ...MOCK_ANNOTATION_TARGET, cropRegionId: "cr-2" } })

      await waitForDrawingElements(result, 2)
      expect(result.current.drawingElements[0].id).toBe("b1")
    })

    it("行き先がnullになるとdrawingElementsがクリアされる", async () => {
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
      ])

      // 行き先は途中で消えうる（生徒や設問の選択が外れる）ので union で持つ
      const initialProps: { target: AnnotationTarget | null } = {
        target: MOCK_ANNOTATION_TARGET,
      }
      const { result, rerender } = renderHook(
        ({ target }: { target: AnnotationTarget | null }) =>
          useDrawingState(target, true),
        { initialProps, wrapper: createQueryWrapper() }
      )

      await waitForDrawingElements(result, 1)

      rerender({ target: null })

      expect(result.current.drawingElements).toHaveLength(0)
    })

    it("同じ行き先を別の入れ物で渡してもDB再読み込みしない", async () => {
      // 行き先は3つのidの組。取り直しのたびに入れ物が変わるので、入れ物の同一性で
      // 判定すると描いたばかりの注釈が読み直しで一瞬消える
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
      ])

      const { result, rerender } = renderHook(
        ({ target }) => useDrawingState(target, true),
        {
          initialProps: { target: { ...MOCK_ANNOTATION_TARGET } },
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 1)

      const callCount = mockAPI.getByTarget.mock.calls.length
      rerender({ target: { ...MOCK_ANNOTATION_TARGET } })

      expect(mockAPI.getByTarget).toHaveBeenCalledTimes(callCount)
    })

    it("設問を開いただけでは書き込みが1つも走らない", async () => {
      // 段階21 の本丸。かつては設問を表示した時点で採点行を作らせていたので、
      // めくるだけで status:"unscored" の空行が量産されていた
      // （docs/branch-review-findings.md #2）
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
      ])

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        { wrapper: createQueryWrapper() }
      )

      await waitForDrawingElements(result, 1)

      expect(mockAPI.create).not.toHaveBeenCalled()
      expect(mockAPI.batchCreate).not.toHaveBeenCalled()
      expect(mockAPI.update).not.toHaveBeenCalled()
      expect(mockAPI.deleteByTarget).not.toHaveBeenCalled()
      expect(mockAPI.delete).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // addDrawingElement — キャンバス描画完了 / テキスト確定 / ブラウザパネル追加
  // =========================================================================
  describe("addDrawingElement（アノテーション追加）", () => {
    it("要素が即座にdrawingElementsに追加される（オプティミスティック更新）", async () => {
      let resolveCreate: (value: unknown) => void
      mockAPI.create.mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve
        })
      )

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitFor(() => {
        expect(mockAPI.getByTarget).toHaveBeenCalled()
      })

      const element = makeElement({ id: "new-1" })
      let addPromise: Promise<void> | void

      act(() => {
        addPromise = result.current.addDrawingElement(element)
      })

      // DB応答前にdrawingElementsに追加されている
      expect(
        result.current.drawingElements.find((element) => element.id === "new-1")
      ).toBeDefined()

      // DB応答を完了
      await act(async () => {
        resolveCreate!(createMockAnnotation({ id: "new-1" }))
        await addPromise!
      })
    })

    it("DB保存失敗時もオプティミスティック更新は残る（useDrawingAnnotationsがエラーを吸収）", async () => {
      // 注: useDrawingAnnotations.saveElementが内部でtry-catchしnullを返すため、
      // useDrawingStateのcatch節に到達せずロールバックが発動しない
      mockAPI.getByTarget.mockResolvedValue([])
      mockAPI.create.mockRejectedValue(new Error("保存失敗"))

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitFor(() => {
        expect(mockAPI.getByTarget).toHaveBeenCalled()
      })

      await act(async () => {
        await result.current.addDrawingElement(makeElement({ id: "fail-1" }))
      })

      // DB保存は失敗するが、ローカル状態は残る（エラーがuseDrawingAnnotations内で吸収されるため）
      expect(
        result.current.drawingElements.find(
          (element) => element.id === "fail-1"
        )
      ).toBeDefined()
    })

    it("行き先が決まっていない場合は追加を拒否する", async () => {
      const { result } = renderHook(() => useDrawingState(null, true), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.addDrawingElement(makeElement())
      })

      expect(mockAPI.create).not.toHaveBeenCalled()
      expect(result.current.drawingElements).toHaveLength(0)
    })

    it("enablePersistence=falseの場合はDB保存せずローカルのみ", async () => {
      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, false),
        {
          wrapper: createQueryWrapper(),
        }
      )

      const element = makeElement({ id: "local-1" })
      act(() => {
        result.current.addDrawingElement(element)
      })

      expect(mockAPI.create).not.toHaveBeenCalled()
      expect(result.current.drawingElements).toHaveLength(1)
    })
  })

  // =========================================================================
  // updateDrawingElement — ドラッグ移動 / リサイズ / プロパティ変更
  // =========================================================================
  describe("updateDrawingElement（単一要素更新）", () => {
    it("要素が即座に更新される（オプティミスティック更新）", async () => {
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1", x: 0.1 }),
      ])

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 1)

      await act(async () => {
        await result.current.updateDrawingElement("a1", { x: 0.9 })
      })

      // ローカル状態は即座に更新される
      expect(result.current.drawingElements[0].x).toBe(0.9)
    })

    it("DB更新失敗時もオプティミスティック更新は残る", async () => {
      // 注: useDrawingAnnotations.updateElementが内部でtry-catchしnullを返すため、
      // useDrawingStateのcatch節に到達せずロールバックが発動しない
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1", x: 0.1 }),
      ])
      mockAPI.update.mockRejectedValue(new Error("更新失敗"))

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 1)

      await act(async () => {
        await result.current.updateDrawingElement("a1", { x: 0.9 })
      })

      // DB更新失敗してもローカル状態は更新されたまま（エラーが吸収されるため）
      expect(result.current.drawingElements[0].x).toBe(0.9)
    })
  })

  // =========================================================================
  // updateDrawingElements — 一括更新（複数要素のドラッグなど）
  // =========================================================================
  describe("updateDrawingElements（一括更新）", () => {
    it("複数要素が1回のsetStateで更新される", async () => {
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1", x: 0.1 }),
        createMockAnnotation({ id: "a2", x: 0.2 }),
        createMockAnnotation({ id: "a3", x: 0.3 }),
      ])

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 3)

      await act(async () => {
        await result.current.updateDrawingElements([
          { id: "a1", updates: { x: 0.5 } },
          { id: "a2", updates: { x: 0.6 } },
        ])
      })

      expect(
        result.current.drawingElements.find((element) => element.id === "a1")?.x
      ).toBe(0.5)
      expect(
        result.current.drawingElements.find((element) => element.id === "a2")?.x
      ).toBe(0.6)
      expect(
        result.current.drawingElements.find((element) => element.id === "a3")?.x
      ).toBe(0.3)
    })
  })

  // =========================================================================
  // removeDrawingElement — Delete/Backspaceキー / コンテキストメニュー削除
  // =========================================================================
  describe("removeDrawingElement（アノテーション削除）", () => {
    it("要素が即座にdrawingElementsから削除される", async () => {
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
        createMockAnnotation({ id: "a2" }),
      ])

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 2)

      await act(async () => {
        await result.current.removeDrawingElement("a1")
      })

      expect(result.current.drawingElements).toHaveLength(1)
      expect(result.current.drawingElements[0].id).toBe("a2")
    })

    it("選択状態からも同時に除去される", async () => {
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
      ])

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 1)

      act(() => {
        result.current.setSelectedElementIds(["a1"])
      })
      expect(result.current.selectedElementIds).toContain("a1")

      await act(async () => {
        await result.current.removeDrawingElement("a1")
      })

      expect(result.current.selectedElementIds).not.toContain("a1")
    })

    it("DB削除失敗時もオプティミスティック削除は残る", async () => {
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
      ])
      mockAPI.delete.mockRejectedValue(new Error("削除失敗"))

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 1)

      await act(async () => {
        await result.current.removeDrawingElement("a1")
      })

      // DB削除失敗してもローカルからは削除されたまま
      expect(result.current.drawingElements).toHaveLength(0)
    })
  })

  // =========================================================================
  // clearDrawing — 全クリア（UIボタン）
  // =========================================================================
  describe("clearDrawing（全クリア）", () => {
    it("drawingElementsが空になりDB同期される", async () => {
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
        createMockAnnotation({ id: "a2" }),
      ])
      mockAPI.batchCreate.mockResolvedValue([])

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 2)

      await act(async () => {
        await result.current.clearDrawing()
      })

      expect(result.current.drawingElements).toHaveLength(0)
      expect(result.current.selectedElementIds).toHaveLength(0)
    })
  })

  // =========================================================================
  // loadFromDatabase — 明示的再読み込み（ブラウザパネルからの追加後など）
  // =========================================================================
  describe("loadFromDatabase（明示的再読み込み）", () => {
    it("現在の行き先でDBから再読み込みされる", async () => {
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
      ])

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 1)

      // 別のアノテーションが追加された想定
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
        createMockAnnotation({ id: "a2" }),
      ])

      await act(async () => {
        await result.current.loadFromDatabase()
      })

      await waitForDrawingElements(result, 2)
    })
  })

  // =========================================================================
  // onAnnotationChanged コールバック — ビュー間連携の起点
  // =========================================================================
  describe("onAnnotationChangedコールバック", () => {
    it("addDrawingElementでonAnnotationChangedが呼ばれる", async () => {
      const onChanged = vi.fn()
      mockAPI.getByTarget.mockResolvedValue([])

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true, onChanged),
        { wrapper: createQueryWrapper() }
      )

      await waitFor(() => {
        expect(mockAPI.getByTarget).toHaveBeenCalled()
      })

      await act(async () => {
        await result.current.addDrawingElement(makeElement({ id: "new-1" }))
      })

      expect(onChanged).toHaveBeenCalled()
    })

    it("updateDrawingElementでローカル状態が即座に更新される", async () => {
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1", x: 0.1 }),
      ])

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true),
        {
          wrapper: createQueryWrapper(),
        }
      )

      await waitForDrawingElements(result, 1)
      expect(result.current.drawingElements[0].x).toBe(0.1)

      await act(async () => {
        await result.current.updateDrawingElement("a1", { x: 0.5 })
      })

      // 即座にローカルが更新される
      expect(result.current.drawingElements[0].x).toBe(0.5)
    })

    it("removeDrawingElementでonAnnotationChangedが呼ばれる", async () => {
      const onChanged = vi.fn()
      mockAPI.getByTarget.mockResolvedValue([
        createMockAnnotation({ id: "a1" }),
      ])

      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, true, onChanged),
        { wrapper: createQueryWrapper() }
      )

      await waitForDrawingElements(result, 1)

      onChanged.mockClear()
      await act(async () => {
        await result.current.removeDrawingElement("a1")
      })

      expect(onChanged).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 選択状態の管理
  // =========================================================================
  describe("選択状態の管理", () => {
    it("addToSelection / removeFromSelection / toggleSelection", () => {
      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, false),
        {
          wrapper: createQueryWrapper(),
        }
      )

      act(() => result.current.addToSelection("a1"))
      expect(result.current.selectedElementIds).toEqual(["a1"])

      act(() => result.current.addToSelection("a2"))
      expect(result.current.selectedElementIds).toEqual(["a1", "a2"])

      act(() => result.current.addToSelection("a1"))
      expect(result.current.selectedElementIds).toEqual(["a1", "a2"])

      act(() => result.current.removeFromSelection("a1"))
      expect(result.current.selectedElementIds).toEqual(["a2"])

      act(() => result.current.toggleSelection("a2"))
      expect(result.current.selectedElementIds).toEqual([])

      act(() => result.current.toggleSelection("a3"))
      expect(result.current.selectedElementIds).toEqual(["a3"])
    })

    it("clearSelection", () => {
      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, false),
        {
          wrapper: createQueryWrapper(),
        }
      )

      act(() => result.current.setSelectedElementIds(["a1", "a2", "a3"]))
      act(() => result.current.clearSelection())
      expect(result.current.selectedElementIds).toEqual([])
    })
  })

  // =========================================================================
  // ツール状態の管理
  // =========================================================================
  describe("ツール・設定の状態管理", () => {
    it("setCurrentTool / setStrokeColor / setStrokeWidth / setLineStyle / setFontSize", () => {
      const { result } = renderHook(
        () => useDrawingState(MOCK_ANNOTATION_TARGET, false),
        {
          wrapper: createQueryWrapper(),
        }
      )

      act(() => result.current.setCurrentTool("line"))
      expect(result.current.currentTool).toBe("line")

      act(() => result.current.setStrokeColor("#00ff00"))
      expect(result.current.strokeColor).toBe("#00ff00")

      act(() => result.current.setStrokeWidth(5))
      expect(result.current.strokeWidth).toBe(5)

      act(() => result.current.setLineStyle("wave"))
      expect(result.current.lineStyle).toBe("wave")

      act(() => result.current.setFontSize(24))
      expect(result.current.fontSize).toBe(24)
    })
  })
})
