import { queryOptions } from "@tanstack/react-query"

import type { StudentExportPlacement } from "@/electron-src/lib/shared/types"
import type { IndividualReportOptions } from "@/types/individualReport.types"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 出力（Excel・PDF・印刷）の読み書き。
 *
 * ほとんどが DB を書かない経路である。読み直す対象を持たないので `meta` は
 * `writesDatabase: false` を名乗る。
 *
 * 対応する preload は `electron-src/preload-apis/exportApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** 個人成績表に出せる小計点グループ */
export const subtotalGroupsForReportQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "subtotalGroupsForReport"] as const,
    queryFn: () => window.electronAPI.export.getSubtotalGroupsForReport(examId),
  })

/** 返却済みの版との差分 */
export const returnDiffQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "returnDiff"] as const,
    queryFn: () => window.electronAPI.export.getReturnDiff(examId),
  })

/**
 * 採点済み答案の出力データ（ページごとの画像・採点・注釈）。
 *
 * `studentPlacements` は採番学級から renderer が解いた値で、キーには入れない。
 * 学級の設定が変われば試験の前方一致（`scopeKeys.exam`）で取り直される。
 */
export const excelPreviewDataQuery = (
  examId: string,
  examStudentIds: readonly string[],
  studentPlacements: Record<string, StudentExportPlacement>
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.exam(examId),
      "excelPreview",
      [...examStudentIds],
    ] as const,
    queryFn: () =>
      window.electronAPI.export.getExcelPreviewData({
        examId,
        selectedExamStudentIds: [...examStudentIds],
        studentPlacements,
      }),
  })

/**
 * 個人成績表1枚分のデータ。
 *
 * **表示オプションはキーに入れない。** 小計点グループの選択などは renderer 側で
 * 絞り込むので、変わっても取り直す必要がない（取りに行くときに最新を読む）。
 */
export const individualReportPreviewQuery = (
  examId: string,
  examStudentId: string,
  options: IndividualReportOptions,
  studentPlacements: Record<string, StudentExportPlacement>
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.exam(examId),
      "individualReportPreview",
      examStudentId,
    ] as const,
    queryFn: () =>
      window.electronAPI.export.getIndividualReportData({
        examId,
        selectedExamStudentIds: [examStudentId],
        options,
        studentPlacements,
      }),
  })

/** 出力する答案1ページ分（main が組み立てた形をそのまま持つ） */
export type PdfExportPageRow = Awaited<
  ReturnType<typeof window.electronAPI.export.getPdfExportData>
>["pages"][number]

/** 採点済み答案1人分の出力データ（ページごとの画像・採点・注釈） */
export const pdfExportDataQuery = (examId: string, examStudentId: string) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.exam(examId),
      "pdfExportData",
      examStudentId,
    ] as const,
    queryFn: () =>
      window.electronAPI.export.getPdfExportData({
        examId,
        selectedExamStudentIds: [examStudentId],
      }),
  })

// =====================================================================
// DB を書かない操作
// =====================================================================

/** 印刷ダイアログを開く。ブラウザの印刷と同じで、DB は変わらない */
export const openPrintDialogMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.export.openPrintDialog>[0]
    ) => window.electronAPI.export.openPrintDialog(input),
    meta: {
      writesDatabase: false,
      errorMessage: "印刷できませんでした",
    },
  })

/** HTML を PDF ファイルへ書き出す。出るのはファイルで、DB は変わらない */
export const printHtmlToPdfMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.export.printHtmlToPdf>[0]
    ) => window.electronAPI.export.printHtmlToPdf(input),
    meta: {
      writesDatabase: false,
      errorMessage: "PDFを出力できませんでした",
    },
  })

/** 出力前の突き合わせ。読むだけで DB は変わらない */
export const validateScoringDataMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.export.validateScoringData>[0]
    ) => window.electronAPI.export.validateScoringData(input),
    meta: {
      writesDatabase: false,
      errorMessage: "採点データを確認できませんでした",
    },
  })

/** 未解決の競合を承知のうえで出力したことを監査ログへ残す */
export const recordUnresolvedConflictsMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.export.recordUnresolvedConflicts
      >[0]
    ) => window.electronAPI.export.recordUnresolvedConflicts(input),
    meta: {
      writesDatabase: false,
      errorMessage: "競合の記録を残せませんでした",
    },
  })

/** 採点データを Excel へ書き出す。ファイルを作るだけで DB は変わらない */
export const exportGradingDataExcelMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.exportGradingDataExcel>[0]
    ) => window.electronAPI.exportGradingDataExcel(input),
    meta: {
      writesDatabase: false,
      errorMessage: "採点データを出力できませんでした",
    },
  })

/** 分析用データ（R / exametrika 向け）を書き出す */
export const exportRDataMutation = () =>
  defineMutation({
    mutationFn: (input: Parameters<typeof window.electronAPI.exportRData>[0]) =>
      window.electronAPI.exportRData(input),
    meta: {
      writesDatabase: false,
      errorMessage: "分析用データを出力できませんでした",
    },
  })

/** 返却した時点の姿を記録する */
export const captureReturnSnapshotMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.export.captureReturnSnapshot
      >[0]
    ) => window.electronAPI.export.captureReturnSnapshot(input),
    meta: {
      invalidates: [returnDiffQuery(examId).queryKey],
      errorMessage: "返却時点を記録できませんでした",
    },
  })

// =====================================================================
// フックの外から呼ぶもの
// =====================================================================

/**
 * 採点済み答案 PDF の書き出しは、**1つの操作が複数の折り返しに跨がる**
 * （データ取得 → セッション作成 → 保存先ダイアログ → ページごとの埋め込み →
 * 確定）。各段を `useMutation` にすると、誰も読まない `isPending` が7つ増え、
 * 失敗トーストが進捗モーダルの表示と二重になる。どれも DB を書かないので
 * 取り直す先も無い。`pdfTools.ts` と同じく、そのまま関数として出す。
 */

/** 選んだ受験者ぶんの出力データをその場で取る（書き出しの1段目） */
export const fetchPdfExportData = (
  input: Parameters<typeof window.electronAPI.export.getPdfExportData>[0]
) => window.electronAPI.export.getPdfExportData(input)

/** 個人成績表のデータをその場で取る（印刷の1段目） */
export const fetchIndividualReportData = (
  input: Parameters<typeof window.electronAPI.export.getIndividualReportData>[0]
) => window.electronAPI.export.getIndividualReportData(input)

/** 空ページだけの PDF を開き、そのセッション id を返す */
export const createPdfStreamingSession = (
  input: Parameters<
    typeof window.electronAPI.export.createPdfStreamingSession
  >[0]
) => window.electronAPI.export.createPdfStreamingSession(input)

/** 描き上がったページを1枚ずつ PDF へ埋める */
export const addPageToStreamingSession = (
  input: Parameters<
    typeof window.electronAPI.export.addPageToStreamingSession
  >[0]
) => window.electronAPI.export.addPageToStreamingSession(input)

/** 埋め終わった PDF を保存する */
export const finalizeStreamingSession = (
  input: Parameters<
    typeof window.electronAPI.export.finalizeStreamingSession
  >[0]
) => window.electronAPI.export.finalizeStreamingSession(input)

/** 中断したセッションを捨てる */
export const cancelStreamingSession = (sessionId: string) =>
  window.electronAPI.export.cancelStreamingSession(sessionId)

/** 保存先をダイアログで選ばせる */
export const selectPdfSavePath = (
  input: Parameters<typeof window.electronAPI.export.selectPdfSavePath>[0]
) => window.electronAPI.export.selectPdfSavePath(input)

/**
 * SVG を PNG へ変換する。
 *
 * Canvas が汚染される（taint）のを避けるため main で描く。呼び出し元は PDF の
 * 描画エンジン（フックではないモジュール関数）なので、そのまま関数で出す。
 */
export const convertSvgToPng = (
  input: Parameters<typeof window.electronAPI.export.convertSvgToPng>[0]
) => window.electronAPI.export.convertSvgToPng(input)
