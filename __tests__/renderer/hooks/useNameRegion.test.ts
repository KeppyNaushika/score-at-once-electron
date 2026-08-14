// @vitest-environment jsdom
/**
 * 06-student-answers 氏名欄クリッピング（useNameRegion）の検証。
 *
 * 守りたい不変条件は「氏名欄の有無が ExamPage.id で解決されること」。
 * pageNumber は序数で、ページ挿入・並べ替えでシフトするうえ sqlite-nas-sync の制約により
 * unique を張れない（＝重複しうる）。序数でキーすると別ページの氏名欄設定を引いたり、
 * 同じ pageNumber のページが互いを上書きして片方の設定が消えたりする。
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useNameRegion } from "@/components/exams/06-student-answers/student-answer-table/hooks/useNameRegion"

const EXAM_ID = "eeeeeeee-0000-4000-8000-000000000000"
const PAGE_A = "aaaaaaaa-0001-4001-8001-000000000001"
const PAGE_B = "aaaaaaaa-0002-4002-8002-000000000002"

interface MockCropRegion {
  id: string
  examPageId: string
  type: string
}

/** window.electronAPI に必要なメソッドだけを差し込む */
function installElectronAPI(cropRegions: MockCropRegion[]) {
  const getCropRegionsByExamId = vi.fn().mockResolvedValue(cropRegions)
  const getExamPagesByExamId = vi.fn().mockResolvedValue([])

  Object.defineProperty(window, "electronAPI", {
    value: { getCropRegionsByExamId, getExamPagesByExamId },
    writable: true,
    configurable: true,
  })

  return { getCropRegionsByExamId, getExamPagesByExamId }
}

/** 取得は TanStack Query が持つので、フックの検証にも provider が要る */
function renderUseNameRegion() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return renderHook(() => useNameRegion(EXAM_ID), {
    wrapper: ({ children }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      ),
  })
}

afterEach(() => {
  Object.defineProperty(window, "electronAPI", {
    value: undefined,
    writable: true,
    configurable: true,
  })
})

describe("useNameRegion", () => {
  it("氏名欄を持つ ExamPage の id 集合を返す", async () => {
    installElectronAPI([
      { id: "region-a", examPageId: PAGE_A, type: "STUDENT_NAME" },
      { id: "region-b", examPageId: PAGE_B, type: "ANSWER" },
    ])

    const { result } = renderUseNameRegion()

    await waitFor(() => {
      expect(result.current.nameRegionExamPageIds.has(PAGE_A)).toBe(true)
    })
    expect(result.current.nameRegionExamPageIds.has(PAGE_B)).toBe(false)
  })

  it("pageNumber が重複するページがあっても両方の設定が独立して残る", async () => {
    // PAGE_A・PAGE_B が同じ pageNumber を持ちうる状況の再現。
    // 序数キーだと後勝ちで片方が消えるが、id キーなら両方が独立して残る。
    installElectronAPI([
      { id: "region-a", examPageId: PAGE_A, type: "STUDENT_NAME" },
      { id: "region-b", examPageId: PAGE_B, type: "STUDENT_NAME" },
    ])

    const { result } = renderUseNameRegion()

    await waitFor(() => {
      expect(result.current.nameRegionExamPageIds.size).toBe(2)
    })
    expect(result.current.nameRegionExamPageIds.has(PAGE_A)).toBe(true)
    expect(result.current.nameRegionExamPageIds.has(PAGE_B)).toBe(true)
  })

  it("氏名欄の解決に ExamPage 一覧（序数の供給元）を参照しない", async () => {
    const { getCropRegionsByExamId, getExamPagesByExamId } = installElectronAPI(
      [{ id: "region-a", examPageId: PAGE_A, type: "STUDENT_NAME" }]
    )

    const { result } = renderUseNameRegion()

    // 実 canvas を与えないと描画前に打ち切られ、以降の解決経路を検証できない
    result.current.canvasRef.current = document.createElement("canvas")
    // 画像デコードは jsdom で完了しないため、解決経路の呼び出しだけを待つ
    void result.current.drawNameRegionCanvas("data:image/png;base64,", PAGE_A)

    await waitFor(() => {
      expect(getCropRegionsByExamId).toHaveBeenCalledWith(EXAM_ID)
    })
    expect(getExamPagesByExamId).not.toHaveBeenCalled()
  })

  it("列に対応する ExamPage が無い孤立答案（examPageId が null）はクリップしない", async () => {
    installElectronAPI([
      { id: "region-a", examPageId: PAGE_A, type: "STUDENT_NAME" },
    ])

    const { result } = renderUseNameRegion()
    result.current.canvasRef.current = document.createElement("canvas")

    // 採点領域はフックのマウント時に引くので、ここで「引いていないこと」は見ない
    // （見るべきは、対象ページが無いときにクリップ結果を返さないこと）
    const canvas = await result.current.drawNameRegionCanvas(
      "data:image/png;base64,",
      null
    )

    expect(canvas).toBeNull()
  })
})
