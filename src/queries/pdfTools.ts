import { defineMutation } from "./defineMutation"

/**
 * PDF ツール（結合・分割・PNG出力・ファイル選択）。
 *
 * どれもファイルを読み書きするだけで DB は変わらない。
 *
 * 対応する preload は `electron-src/preload-apis/pdfToolsApi.ts`。
 */

export const mergePdfsMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.pdfTools.mergePdfs>[0]
    ) => window.electronAPI.pdfTools.mergePdfs(input),
    meta: {
      writesDatabase: false,
      errorMessage: "PDF を結合できませんでした",
    },
  })

export const splitPdfMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.pdfTools.splitPdf>[0]
    ) => window.electronAPI.pdfTools.splitPdf(input),
    meta: {
      writesDatabase: false,
      errorMessage: "PDF を分割できませんでした",
    },
  })

export const exportPdfAsPngMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.pdfTools.exportAsPng>[0]
    ) => window.electronAPI.pdfTools.exportAsPng(input),
    meta: {
      writesDatabase: false,
      errorMessage: "PNG を書き出せませんでした",
    },
  })

/** 保存先をダイアログで選ばせる */
export const selectPdfSavePathMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.pdfTools.selectSavePath>[0]
    ) => window.electronAPI.pdfTools.selectSavePath(input),
    meta: {
      writesDatabase: false,
      errorMessage: "保存先を選べませんでした",
    },
  })

/** 取り込むファイルをダイアログで選ばせる */
export const selectPdfFilesMutation = () =>
  defineMutation({
    mutationFn: () => window.electronAPI.pdfTools.selectFiles(),
    meta: {
      writesDatabase: false,
      errorMessage: "ファイルを選べませんでした",
    },
  })

/**
 * フックの外から呼ぶもの。
 *
 * 取り込みの下請け（`useImportedFiles` のモジュール関数）はコンポーネントでは
 * ないので `useMutation` を置けない。DB を触らないぶん取り直す先も無いので、
 * そのまま関数として出す。
 */

/** パスワード付き PDF の復号済みコピーを作り、そのパスを返す */
export const createDecryptedPdfCopy = (
  input: Parameters<typeof window.electronAPI.pdfTools.createDecryptedCopy>[0]
) => window.electronAPI.pdfTools.createDecryptedCopy(input)

/** PDF のページ数・ページサイズ・暗号化の有無を読む */
export const readPdfInfo = (filePath: string) =>
  window.electronAPI.pdfTools.getPdfInfo(filePath)

/** PDF の中身を読む（ダイアログで選ばれた絶対パス用） */
export const readPdfFile = (filePath: string) =>
  window.electronAPI.pdfTools.readFile(filePath)

/** ドラッグ＆ドロップされた File から実ファイルのパスを取る */
export const pathForFile = (file: File) =>
  window.electronAPI.pdfTools.getPathForFile(file)
