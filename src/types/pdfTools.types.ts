/**
 * PDF Tools - 型定義
 * PDF加工機能で使用する共通型定義
 */

/** ページ回転角度 */
export type RotationDegree = 0 | 90 | 180 | 270

/** エクスポートモード */
export type ExportMode = "merge" | "split" | "interleave"

/** 2-in-1 レイアウト */
export type NUpLayout = "2x1" | "1x2" // 横並び / 縦並び

/** ページ順序 */
export type PageOrder = "left-right" | "right-left"

/** 2-in-1 (Nアップ) 設定 */
export interface NUpConfig {
  enabled: boolean
  layout: NUpLayout
  order: PageOrder
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

/** インターリーブ設定 */
export interface InterleaveConfig {
  enabled: boolean
  transforms: FileTransform[]
}

/** PDF Tools 全体の状態 */
export interface PdfToolsState {
  importedFiles: ImportedFile[]
  outputPages: OutputPage[]
  exportMode: ExportMode
  interleaveConfig: InterleaveConfig
  isProcessing: boolean
}

/** IPC: PDF結合オプション */
export interface MergePdfsOptions {
  pages: Array<{
    filePath: string
    pageNumber: number
    rotation?: RotationDegree
  }>
  outputPath: string
}

/** IPC: PDF分割オプション */
export interface SplitPdfOptions {
  filePath: string
  outputDir: string
  prefix?: string
}

/** IPC: 2-in-1変換オプション */
export interface NUpOptions {
  filePath: string
  layout: NUpLayout
  order: PageOrder
  outputPath: string
}

/** IPC: PNG書き出しオプション */
export interface ExportPngOptions {
  pages: Array<{
    filePath: string
    pageNumber: number
    rotation?: RotationDegree
  }>
  outputDir: string
  scale?: number
}

/** IPC: 汎用レスポンス */
export interface PdfToolsResult {
  success: boolean
  outputPath?: string
  outputPaths?: string[]
  error?: string
}
