import type { ExamPage } from "@prisma/client"
import { useMemo } from "react"

import type { MasterPageImage } from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import { toAppImageUrl } from "@/lib/appImageUrl"
import { resolveExamPaperSize } from "@/lib/shared/examPaperSize"

/** 模範解答のページ（並べる順のページと画像 URL と、注釈の mm→px の基準になる用紙サイズ） */
export function useMasterAnswerPages(
  examPages: readonly ExamPage[] | undefined
) {
  /** 用紙サイズ。PDF出力（pdfExport）と同じ関数で決めて注釈のmm→px変換基準を揃える */
  const pageSize = useMemo(() => resolveExamPaperSize(examPages), [examPages])

  /**
   * 全ページの模範解答画像（ページ番号順。画像の無いページは除く）。
   * 答案の画像とは examPageId で対応させる（並びの添字では対応させない）
   */
  const masterPageImages = useMemo<MasterPageImage[]>(() => {
    if (!examPages) return []
    return examPages
      .slice()
      .sort((pageA, pageB) => pageA.pageNumber - pageB.pageNumber)
      .flatMap((page) =>
        page.imagePath
          ? [{ examPageId: page.id, imageUrl: toAppImageUrl(page.imagePath) }]
          : []
      )
  }, [examPages])

  return { pageSize, masterPageImages }
}
