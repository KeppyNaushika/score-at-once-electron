/**
 * PDF Tools - 型定義
 * PDF加工機能で使用する共通型定義
 */

/** ページ回転角度 */
export type RotationDegree = 0 | 90 | 180 | 270

/**
 * エクスポートモード
 *
 * ページ分割は出力プレビューを経由しない元ファイル単位の操作なので、
 * ここではなくインポート済みファイルのアクションとして提供する。
 */
export type PdfExportMode = "merge" | "interleave"

/** 2-in-1 レイアウト */
export type NUpLayout = "2x1" | "1x2" // 横並び / 縦並び

/** 2-in-1 (Nアップ) 設定 */
export interface NUpConfig {
  enabled: boolean
  layout: NUpLayout
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

/**
 * 書き出す1ページ分の入力（IPC境界を渡る）。
 * 結合（1ファイルへ全ページ）とページ別書き出し（1ページ1ファイル）で共通。
 */
export interface PdfPageInput {
  filePath: string
  /** 1-indexed */
  pageNumber: number
  rotation?: RotationDegree
  /** 2-in-1で結合されたページか */
  isNUpCombined?: boolean
  /** 結合する元ページ番号 (例: [1, 2]) */
  combinedPages?: number[]
  nUpLayout?: NUpLayout
}

/** インポートされたファイル */
export interface ImportedFile {
  id: string
  name: string
  path: string
  pageCount: number
  thumbnails: string[] // base64 data URLs
  selectedPages: Set<number> // 1-indexed
  nUp: NUpConfig
  rotation: RotationDegree
  /**
   * 元PDF（パスワード保護時の復号済み複製への差し替え前）のメタデータ。
   * 読み取れなかった場合は null。
   */
  sourcePdfMetadata: SourcePdfMetadata | null
}

/** 出力ページ（並び替え用） */
export interface OutputPage {
  id: string
  sourceFileId: string
  sourceFileName: string
  sourcePageNumber: number // 1-indexed
  thumbnail: string
  rotation: RotationDegree
  isNUpCombined: boolean // 2-in-1で結合されたページか
  combinedPages?: number[] // 結合された元ページ番号 (例: [1, 2])
  nUpLayout?: NUpLayout // 2-in-1レイアウト ("2x1" | "1x2")
}

/** ファイル別変換設定（複合インターリーブ用） */
export interface FileTransform {
  fileId: string
  nUp: NUpConfig
  rotation: RotationDegree
  pagesPerGroup: number // 交互挿入時の1グループあたりページ数
}

/** インターリーブ設定（有効/無効は出力モードが表す） */
export interface InterleaveConfig {
  transforms: FileTransform[]
}
