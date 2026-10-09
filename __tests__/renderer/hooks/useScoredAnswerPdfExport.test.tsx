// @vitest-environment jsdom
/**
 * 採点済み答案 PDF の確定（finalize）が1回だけ呼ばれることの検査。
 *
 * 確定の effect は「描画完了 + 全ページ埋め込み済み」で走り、`await` の間に
 * 親の状態（進捗・ステップ）を更新する。親が再描画されると、親がその場で書く
 * `onExportCompleted` の矢印関数が作り直され、effect がもう一度走る。確定中の
 * セッションを `await` の後で手放していたので、2回目も確認を通り、同じセッションを
 * 2回確定しに行っていた（2回目は main で「セッションが見つかりません」になり、
 * 1回目の「完了しました」を「PDF保存中にエラーが発生しました」で上書きする）。
 */
import type { Exam } from "@prisma/client"
import { act, renderHook } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useScoredAnswerPdfExport } from "@/components/exams/09-export/hooks/useScoredAnswerPdfExport"
import type { ExportOptions } from "@/components/exams/09-export/types"
import type { PdfExportPageData } from "@/electron-src/lib/prisma/pdfExport"
import {
  addPageToStreamingSession,
  cancelStreamingSession,
  createPdfStreamingSession,
  fetchPdfExportData,
  finalizeStreamingSession,
  selectPdfSavePath,
} from "@/queries/export"

vi.mock("@/queries/export", () => ({
  addPageToStreamingSession: vi.fn(),
  cancelStreamingSession: vi.fn(),
  createPdfStreamingSession: vi.fn(),
  fetchPdfExportData: vi.fn(),
  finalizeStreamingSession: vi.fn(),
  selectPdfSavePath: vi.fn(),
}))

const exam: Exam = {
  id: "exam-1",
  examName: "テスト試験",
  referenceDate: null,
  description: null,
  markerCorrectionEnabled: false,
  anonymousScoringEnforced: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

const exportOptions: ExportOptions = {
  includeScoredAnswers: true,
  includeIndividualReports: false,
  includeGradingData: false,
  format: "pdf",
  markPosition: "center",
  markSize: 1,
  showMarks: true,
  pdfOrientation: "portrait",
  parallelCount: 1,
}

const page: PdfExportPageData = {
  examStudentId: "exam-student-1",
  studentName: "生徒 一郎",
  pageNumber: 1,
  imagePath: "/tmp/page.png",
  imageUrl: "file:///tmp/page.png",
  pageSize: "A4",
  scoringData: [],
  subtotalData: [],
  totalScoreData: [],
  totalScore: null,
  totalMaxScore: null,
  annotations: [],
}

/**
 * 親（ExportMainView）と同じ形で描く。進捗などの状態は親が持ち、
 * `onExportCompleted` は描画のたびに作り直す矢印関数で渡す。
 */
function useExportPageHarness(onExportCompleted: () => void) {
  const [, setIsExporting] = useState(false)
  const [, setShowProgressModal] = useState(false)
  const [, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState<
    "processing" | "completed" | "error"
  >("processing")
  const [currentStep, setCurrentStep] = useState("")
  const pdfExport = useScoredAnswerPdfExport({
    exam,
    selectedStudents: new Set([page.examStudentId]),
    exportOptions,
    setIsExporting,
    setShowProgressModal,
    setExportProgress,
    setExportStatus,
    setCurrentStep,
    onExportCompleted: () => onExportCompleted(),
  })
  return { pdfExport, exportStatus, currentStep }
}

describe("useScoredAnswerPdfExport", () => {
  beforeEach(() => {
    vi.mocked(fetchPdfExportData).mockReset()
    vi.mocked(createPdfStreamingSession).mockReset()
    vi.mocked(selectPdfSavePath).mockReset()
    vi.mocked(addPageToStreamingSession).mockReset()
    vi.mocked(finalizeStreamingSession).mockReset()
    vi.mocked(cancelStreamingSession).mockReset()

    vi.mocked(fetchPdfExportData).mockResolvedValue({
      examName: exam.examName,
      pages: [page],
    })
    vi.mocked(createPdfStreamingSession).mockResolvedValue("session-1")
    vi.mocked(selectPdfSavePath).mockResolvedValue({
      canceled: false,
      filePath: "/tmp/out.pdf",
    })
    vi.mocked(addPageToStreamingSession).mockResolvedValue(undefined)
  })

  it("確定中に親が再描画されても、確定は1回だけ呼ぶ", async () => {
    // main の確定は時間がかかる（pdf-lib の save とファイル書き込み）。
    // その間に親の状態が変わって再描画が起きる
    let resolveFinalize: () => void = () => {}
    const finalizeCalls: string[] = []
    vi.mocked(finalizeStreamingSession).mockImplementation(({ sessionId }) => {
      finalizeCalls.push(sessionId)
      // main と同じく、確定したセッションはもう無い
      if (finalizeCalls.length > 1) {
        return Promise.reject(new Error("セッションが見つかりません"))
      }
      return new Promise<void>((resolve) => {
        resolveFinalize = resolve
      })
    })
    const onExportCompleted = vi.fn()

    const { result } = renderHook(() => useExportPageHarness(onExportCompleted))

    await act(async () => {
      await result.current.pdfExport.executeExportScoredAnswers()
    })
    await act(async () => {
      await result.current.pdfExport.handlePageComplete({
        pageIndex: 0,
        examStudentId: page.examStudentId,
        pageNumber: page.pageNumber,
        imageData: new ArrayBuffer(8),
      })
    })
    await act(async () => {
      await result.current.pdfExport.handleCanvasComplete([])
    })

    // 確定の await 中。親の再描画で effect が走り直しても2回目は出ない
    expect(finalizeCalls).toEqual(["session-1"])

    await act(async () => {
      resolveFinalize()
    })

    expect(finalizeCalls).toEqual(["session-1"])
    expect(onExportCompleted).toHaveBeenCalledTimes(1)
    expect(result.current.exportStatus).toBe("completed")
    expect(result.current.currentStep).toBe("完了しました")
    expect(cancelStreamingSession).not.toHaveBeenCalled()
  })

  it("確定に失敗したら、そのセッションを解放してエラーを出す", async () => {
    vi.mocked(finalizeStreamingSession).mockRejectedValue(
      new Error("書き込めませんでした")
    )
    const onExportCompleted = vi.fn()

    const { result } = renderHook(() => useExportPageHarness(onExportCompleted))

    await act(async () => {
      await result.current.pdfExport.executeExportScoredAnswers()
    })
    await act(async () => {
      await result.current.pdfExport.handlePageComplete({
        pageIndex: 0,
        examStudentId: page.examStudentId,
        pageNumber: page.pageNumber,
        imageData: new ArrayBuffer(8),
      })
    })
    await act(async () => {
      await result.current.pdfExport.handleCanvasComplete([])
    })

    expect(finalizeStreamingSession).toHaveBeenCalledTimes(1)
    expect(cancelStreamingSession).toHaveBeenCalledWith("session-1")
    expect(onExportCompleted).not.toHaveBeenCalled()
    expect(result.current.exportStatus).toBe("error")
    expect(result.current.currentStep).toBe("PDF保存中にエラーが発生しました")
  })
})
