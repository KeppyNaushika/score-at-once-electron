/**
 * PDF出力用Canvas描画の共有型
 *
 * 形の SSOT は main 側の `PdfExportPageData`（`electron-src/lib/prisma/pdfExport.ts`）で、
 * ここでは導出だけを行う。以前は同じ形をこちらでも宣言していたため、
 * `PdfCanvasRenderer` が受け取ったデータを1件ずつ組み立て直す必要があり、
 * その過程で union 列を `as` で絞り直していた。
 */

import type { PdfExportPageData } from "@/electron-src/lib/prisma/pdfExport"

/** 採点データ（PDF出力用） */
export type ScoringDataForPdf = PdfExportPageData["scoringData"][number]

/** 小計点データ（PDF出力用）。描画対象は算出できたものだけなので `score` は非 null。 */
export type SubtotalDataForPdf = Omit<
  PdfExportPageData["subtotalData"][number],
  "score"
> & { score: number }

/** 合計点データ（PDF出力用）。小計と同じく描画時点では `score` が確定している。 */
export type TotalScoreDataForPdf = Omit<
  PdfExportPageData["totalScoreData"][number],
  "score"
> & { score: number }
