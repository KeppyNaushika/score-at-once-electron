/**
 * table-dnd-kit-test準拠の型定義
 * 05-answer-sheetsページ専用の統一型定義
 * レポート分析に基づき6つのStudent型と4つのAnswerSheet型を1つに統合
 */

// ============================================================================
// 基本的な型定義
// ============================================================================

/**
 * 統一された生徒型定義
 * 04-studentsのcustomOrder順序に対応
 */
export interface UnifiedStudent {
  id: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  studentId: string
  attendanceNumber?: number | null
  status?: "participating" | "expected" | "absent"
  customOrder?: number | null  // 🚨 必須: 受験生徒順序
}

/**
 * 統一されたファイル型定義
 * ConvertedFile + TestFileの統合版
 */
export interface UnifiedFile {
  id: string
  name: string
  type: string
  size: number
  buffer: ArrayBuffer
  preview?: string
  studentId?: string           // 配置済みの場合の生徒ID
  pageNumber: number           // ページ番号（1から開始）
  isSelected: boolean          // UI選択状態
  originalFileName: string     // 元ファイル名保持
  pageLabel?: string          // 表示用ラベル
  
  // table-dnd-kit-test統合用
  color?: string              // 表示色（テスト・デバッグ用）
  position?: number           // table内の位置（studentIndex * maxPages + pageNumber - 1）
}

// ============================================================================
// table-dnd-kit-test互換の型定義
// ============================================================================

/**
 * 配置戦略
 * table-dnd-kit-testと同じ定義
 */
export type PlacementStrategy = "page-first" | "student-first" | "filename-auto"

/**
 * 無効化状態管理
 * table-dnd-kit-testのDisabledStateと互換
 */
export interface DisabledState {
  rows: Set<number>        // 生徒レベル無効化（studentIndex）
  cols: Set<number>        // ページレベル無効化（pageNumber - 1）
  positions: Set<number>   // セルレベル無効化（position）
}

/**
 * グリッド状態管理（簡素化版）
 * 従来のGridStateを大幅簡素化
 */
export interface SimpleGridState {
  files: UnifiedFile[]                    // メインのファイル配列
  disabledState: DisabledState           // 無効化状態
  placementStrategy: PlacementStrategy   // 配置戦略
  maxPages: number                       // 最大ページ数（動的計算）
}

// ============================================================================
// データベース連携用の型定義
// ============================================================================

/**
 * ElectronAPI用のアップロードデータ形式
 * 既存のuploadAnswerSheets APIとの互換性確保
 */
export interface UploadData {
  name: string
  fileName: string
  originalFileName: string
  type: string
  buffer: ArrayBuffer
  studentId: string        // 受験生徒ID
  pageNumber: number       // ページ番号
  overwrite: boolean       // 上書きフラグ
}

/**
 * 既存のAnswerSheetWithDetailsから必要な部分を抽出
 * 表示用の最小限の情報
 */
export interface ExistingAnswerSheet {
  id: string
  studentId: string | null
  pageNumber: number
  createdAt: Date
  isAbsent: boolean
  student?: {
    id: string
    lastName: string
    firstName: string
    studentId: string
  }
}

// ============================================================================
// 氏名欄拡大表示用の型定義
// ============================================================================

/**
 * レイアウト領域情報（氏名欄拡大表示用）
 * 既存のLayoutRegion型との互換性確保
 */
export interface NameFieldRegion {
  id: string
  type: "name" | "studentId"  // 氏名欄または学籍番号欄
  x: number                   // 相対座標（0-1）
  y: number
  width: number
  height: number
  masterImageId: string       // 対応するマスター画像ID
  pageNumber: number          // ページ番号
}

// ============================================================================
// ユーティリティ型
// ============================================================================

/**
 * table-dnd-kit-testのgetTableData相当の戻り値
 */
export interface TableCell {
  studentIndex: number
  pageNumber: number
  position: number
  file: UnifiedFile | null
  student: UnifiedStudent
  isDisabled: boolean
}

export type TableData = TableCell[][]  // [row][col]形式

/**
 * ドラッグ&ドロップイベント用
 */
export interface DragData {
  type: "file" | "trash"
  file?: UnifiedFile
  sourcePosition?: number
}

// ============================================================================
// ファイル変換用の型定義
// ============================================================================

/**
 * 一時的な変換ファイル（中間データ）
 */
export interface ConvertedFileTemp {
  id: string
  name: string
  type: string
  size: number
  buffer: ArrayBuffer
  preview: string
  originalFileName: string
  pageNumber: number
  pageLabel?: string
}

/**
 * ファイル処理の進捗状態
 */
export interface FileProcessingProgress {
  current: number
  total: number
  fileName?: string
}

/**
 * PDFパスワード処理状態
 */
export interface PasswordDialogState {
  isOpen: boolean
  fileName?: string
  attempts: number
  hasError: boolean
}