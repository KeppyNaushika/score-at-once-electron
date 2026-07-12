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
 * セルに載る要素の「描画ビュー」（表・DnD・プレビューが読む最小共通形）。
 * 未保存画像（PendingImage 相当）と DB答案（ExistingAnswer 相当）の**両ソースを射影**した
 * 表示専用の投射であって、エンティティの併合ではない（"Unified" とは呼ばない）。
 * upload 源（`PendingImage`）はこれを満たす上位型。DB答案（`ExistingAnswer`）は
 * テーブル境界で `convertAnswerSheetsToFiles` によりこの形へ射影する。
 */
export interface AnswerItem {
  id: string
  studentId?: string // 配置済みの生徒ID（= Student.id）
  pageNumber: number // マス列（1始まりの序数）
  name: string // 表示・alt 用
  preview?: string // 未保存は blob URL、DB答案は遅延読込前は無し
  imagePath?: string | null // DB答案の遅延読込パス
  correctionStatus?: "corrected" | "skipped" | "not_requested"
  correctionError?: string
  color?: string
}

/**
 * 未保存画像（アップロード源）。ドロップ→変換した画像で、DB にはまだ無い。
 * 本物の `buffer`/`size` を持ち、マーカー補正の対象になる。
 * `AnswerItem` を満たす上位型（buffer 等の upload 専用フィールドを追加で持つ）で、
 * upload モードのパイプライン（`useStudentAnswerUpload`・DnD 方式A・マーカー補正）は
 * この型で流れる。DB答案（`ExistingAnswer`）とは併合しない（偽の 0埋めはしない）。
 */
export interface PendingImage extends AnswerItem {
  type: string
  size?: number // バイト数（表示用）
  buffer?: ArrayBuffer // 未変換で残ることはないが補正前後で差し替わるため任意
  isSelected: boolean // UI選択状態
  originalFileName: string // 元ファイル名保持
  pageLabel?: string // 表示用ラベル
  correctedForPage?: number // 補正時に対応付けたマスターページ番号
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
 * 移動1件ごとの採点データ処理方針（view 方式B）。
 * - carry: 採点も追従（同一ページの生徒付け替えのみ可）
 * - discard: 採点を破棄（要再採点。ページ跨ぎは常にこれ）
 * バックエンド `applyStudentAnswerPlacements` の scorePolicy と一致させる。
 */
export type PlacementScorePolicy = "carry" | "discard"
