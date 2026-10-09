import { useMemo } from "react"

import { toAppImageUrl } from "@/lib/appImageUrl"
import { resolveExamPaperSize } from "@/lib/shared/examPaperSize"

/** 模範解答のページ（並べる順の画像 URL と、注釈の mm→px の基準になる用紙サイズ） */
export function useMasterAnswerPages(
  examPages: Parameters<typeof resolveExamPaperSize>[0]
) {
  /** 用紙サイズ。PDF出力（pdfExport）と同じ関数で決めて注釈のmm→px変換基準を揃える */
  const pageSize = useMemo(() => resolveExamPaperSize(examPages), [examPages])

  /** 全ページの模範解答画像URL（ページ番号順） */
  const allMasterImageUrls = useMemo(() => {
    if (!examPages) return []
    return examPages
      .slice()
      .sort((pageA, pageB) => pageA.pageNumber - pageB.pageNumber)
      .map((page) => (page.imagePath ? toAppImageUrl(page.imagePath) : null))
      .filter((url): url is string => url !== null)
  }, [examPages])

  return { pageSize, allMasterImageUrls }
}
