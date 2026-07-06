/**
 * テーブルDnD準拠の型定義
 * 06-student-answersページ専用の統一型定義
 *
 * 受験生徒は Prisma 拡張型 `ExamStudentWithMemberships` をそのまま持ち回るため、
 * 独自の生徒 view-model は定義しない（採番学級などの派生表示値が要る場合はフックで導出する）。
 */

// ============================================================================
// 基本的な型定義
// ============================================================================

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
  studentId?: string // 配置済みの場合の生徒ID
  pageNumber: number // ページ番号（1から開始）
  isSelected: boolean // UI選択状態
  originalFileName: string // 元ファイル名保持
  pageLabel?: string // 表示用ラベル

  // テーブルDnD統合用
  color?: string // 表示色（テスト・デバッグ用）
  position?: number // table内の位置（studentIndex * maxPages + pageNumber - 1）
  imagePath?: string | null // 既存画像ファイルのパス（遅延読み込み用）
  correctionStatus?: "corrected" | "skipped" | "not_requested" // マーカー補正結果
  correctedForPage?: number // 補正時に対応付けたマスターページ番号
  correctionError?: string // 補正失敗時の理由
}

// ============================================================================
// テーブルDnD互換の型定義
// ============================================================================

/**
 * 配置戦略
 * テーブルDnDと同じ定義
 */
export type PlacementStrategy = "page-first" | "student-first"

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
  studentId: string // 受験生徒ID
  pageNumber: number // ページ番号
  overwrite: boolean // 上書きフラグ
  correctWithMarkers?: boolean // マーカー補正フラグ
  correctionStatus?: "corrected" | "skipped" | "not_requested" // クライアント側補正結果
}

// ============================================================================
// 変更状態管理用の型定義
// ============================================================================

/**
 * 保留中の変更データ
 * 2つのファイルの位置入れ替えを表現
 */
export interface PendingChange {
  id: string // ユニークID
  movedFileId: string // 移動されたファイルのID
  targetFileId: string | null // 移動先にあったファイルのID（空の場合はnull）
  timestamp: Date // 変更時刻
  fromPosition: {
    // 移動元の位置
    studentId: string | null
    pageNumber: number
    studentName?: string // 表示用
  }
  toPosition: {
    // 移動先の位置
    studentId: string | null
    pageNumber: number
    studentName?: string // 表示用
  }
}

/**
 * 採点データ処理オプション
 */
export type ScoringDataOption =
  | "image-only" // 答案画像のみ入れ替え
  | "with-scoring" // 採点情報も一緒に入れ替え
