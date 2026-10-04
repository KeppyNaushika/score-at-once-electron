/**
 * PDF Tools - 型定義
 * PDF加工機能で使用する共通型定義
 */

/** ページ回転角度（時計回り） */
export const ROTATION_DEGREES = [0, 90, 180, 270] as const
export type RotationDegree = (typeof ROTATION_DEGREES)[number]

/**
 * エクスポートモード
 *
 * ページ分割は出力プレビューを経由しない元ファイル単位の操作なので、
 * ここではなくインポート済みファイルのアクションとして提供する。
 */
export const PDF_EXPORT_MODES = ["merge", "interleave"] as const
export type PdfExportMode = (typeof PDF_EXPORT_MODES)[number]

/** 1面に入れるページ数（N-up）。1 は面にまとめず、元のページをそのまま出す */
export const PAGES_PER_SHEET_OPTIONS = [1, 2, 4, 8, 9, 16] as const
export type PagesPerSheet = (typeof PAGES_PER_SHEET_OPTIONS)[number]

/**
 * 面の中でページを置いていく順（どの角から、どちら向きに埋めるか）。
 * 左上から右へ（Z）・左上から下へ（N）・右上から左へ・右上から下へ。
 */
export const SLOT_ORDERS = [
  "from-top-left-rightward",
  "from-top-left-downward",
  "from-top-right-leftward",
  "from-top-right-downward",
] as const
export type SlotOrder = (typeof SLOT_ORDERS)[number]

/**
 * N-up の設定（1面に何ページを、どの順に置くか）。
 *
 * 行×列と用紙の縦横は持たない。置くページの縦横（回転後）から、ページが最も大きく
 * 収まる方を描くときに決める（`computeSheetLayout`）。ページの寸法を知っているのは
 * 描く側（PDF は元ファイル、PNG はページ画像）だけなので。
 */
export interface NUpConfig {
  pagesPerSheet: PagesPerSheet
  slotOrder: SlotOrder
}

/** 元PDFファイルのメタデータ（取り込み時に getPdfInfo で取得） */
export interface SourcePdfMetadata {
  pageCount: number
  /** 1ページ目の幅（ポイント: 1pt = 1/72 inch） */
  pageWidth: number
  /** 1ページ目の高さ（ポイント） */
  pageHeight: number
  /** パスワード等で暗号化されていたか */
  isEncrypted: boolean
}

/** 書き出す元ページ1枚（IPC境界を渡る） */
export interface PdfSourcePageInput {
  kind: "page"
  filePath: string
  /** 1-indexed */
  pageNumber: number
  /** 時計回り。元PDFの /Rotate に足して回す */
  rotation: RotationDegree
}

/**
 * 書き出す N-up の面1枚（IPC境界を渡る）。
 *
 * スロットには元ページのほか、面も入る（全体 N-up: ファイルごとの面を1スロットへ
 * 縮めて入れる）。面は木になり、葉が元ページ。葉ごとにファイルを持つので、1つの面が
 * 複数のファイルをまたいでよい。
 */
export interface PdfNUpSheetInput {
  kind: "sheet"
  nUp: NUpConfig
  /** 並べ方（`nUp.slotOrder`）の順に並べたスロットの中身。null は空きスロット */
  slots: (PdfPageInput | null)[]
}

/**
 * 書き出す1ページ分の入力（IPC境界を渡る）。元ページそのままか、N-up の面。
 * 結合（1ファイルへ全ページ）とページ別書き出し（1ページ1ファイル）で共通。
 */
export type PdfPageInput = PdfSourcePageInput | PdfNUpSheetInput

/** インポートされたファイル */
export interface ImportedFile {
  id: string
  name: string
  path: string
  pageCount: number
  thumbnails: string[] // base64 data URLs
  selectedPages: Set<number> // 1-indexed
  nUp: NUpConfig
  /** ページごとの回転の既定（プレビューで個別に回したページはそちらが優先） */
  rotation: RotationDegree
  /**
   * 元PDF（パスワード保護時の復号済み複製への差し替え前）のメタデータ。
   * 読み取れなかった場合は null。
   */
  sourcePdfMetadata: SourcePdfMetadata | null
}

/**
 * 出力に載る元ページ1枚（プレビューの1マス。並べ替え・除外・回転の単位）。
 * id は元ページのキー（"fileId:pageNumber"）で、作り直しても変わらない。
 */
export interface OutputPage {
  kind: "page"
  id: string
  sourceFileId: string
  sourceFileName: string
  sourcePageNumber: number // 1-indexed
  thumbnail: string
  /** 時計回り。N-up の面では、スロットの中でこのページだけを回す */
  rotation: RotationDegree
}

/**
 * N-up の面（出力の1ページに、複数のページを縮めて並べたもの）。
 *
 * スロットには元ページか、面が入る。ファイルごとの面をさらに全体の面へまとめると、
 * 全体の面のスロットにファイルごとの面が入る（`groupIntoGlobalSheets`）。
 * id は先頭の元ページのキー（入れ子の面とその外側の面で同じ値になりうるので、
 * 比べるときは同じ段どうしで比べる）。
 */
export interface NUpSheet {
  kind: "sheet"
  id: string
  nUp: NUpConfig
  /** 並べ方（`nUp.slotOrder`）の順に並べたスロットの中身。null は空きスロット（端数） */
  slots: (OutputSheet | null)[]
}

/** 出力の1ページ: 元ページそのままか、N-up の面 */
export type OutputSheet = OutputPage | NUpSheet

/**
 * 交互挿入でのファイル別設定。
 * N-up・回転はここに持たず、ファイルの設定（ImportedFile の nUp / rotation）を使う
 * （左のファイル欄と交互挿入の欄のどちらで変えても同じ値になるように）。
 */
export interface FileTransform {
  fileId: string
  pagesPerGroup: number // 交互挿入時の1グループあたりページ数
}

/** インターリーブ設定（有効/無効は出力モードが表す） */
export interface InterleaveConfig {
  transforms: FileTransform[]
}
