/**
 * 06-student-answers ページ専用の型定義（entity-first）
 *
 * 保存済み答案（view）は Prisma `include` が作るエンティティ（`PlacedAnswerImage`）を
 * そのまま持ち回る（射影・平坦化・scalar 抜き出しをしない）。表示値（pageNumber・氏名）は
 * 列（ExamPage 実体）・行（ExamStudent 実体）から表示時に導出する。
 * 未保存答案（upload）だけは DB レコードが存在しないため、同定フィールド＋未永続バイトを持つ
 * 投射型（`UnsavedAnswerImage`）で扱う（アップロード前に限り許容される投射）。
 *
 * 同定・key は必ず id（`studentAnswerImage.id` / `studentId` / `examPageId`）。
 * sqlite-nas-sync では id 以外の unique が同期違反となるため、pageNumber 等の序数は
 * 恒久的に key になり得ない。
 */

// ============================================================================
// セル要素の同定（表・DnD・生成ロジックが共通で読む最小形）
// ============================================================================

/**
 * 表・DnD が扱うセル要素の同定。保存済み（`PlacedAnswerImage`）・未保存
 * （`UnsavedAnswerImage`）の両方が満たす。座標は id のみ（examPageId・studentId）。
 */
export interface AnswerImageIdentity {
  id: string
  studentId: string | null // 配置済みの生徒（= Student.id）。未配置は null
  examPageId: string | null // 配置済みの ExamPage.id。未配置は null
}

// 保存済み答案の実体は Prisma payload（`PlacedAnswerImage`＝@/types/prismaExtensions）を
// そのまま使う。所在を隠す再エクスポートは置かず、各消費者が prismaExtensions から直接 import する。

/**
 * 表の列となる ExamPage の最小契約（同定＝id、表示＝pageNumber）。
 * 供給の `StudentAnswerDatasetExamPage`（ExamPage 実体）がこれを満たすため、
 * 呼び出し側は実体をそのまま渡し、表は id/pageNumber だけを読む。
 */
export interface ExamPageColumn {
  id: string
  pageNumber: number
}

/**
 * 未保存答案（アップロード源）。ドロップ→変換した画像で、DB にはまだ無い。
 * `PlacedAnswerImage` と同じ同定フィールド（id/studentId/examPageId）を満たしつつ、
 * バイトは state 上の `buffer`（`imagePath` は保存まで null）で持つ。
 * upload の配置は「配列順＋配置戦略」で決まるため studentId/examPageId は未使用
 * （型統一のため保持し、確定時は列＝ExamPage 実体・行＝ExamStudent 実体から導出する）。
 */
export interface UnsavedAnswerImage extends AnswerImageIdentity {
  imagePath: string | null // 保存まで null
  buffer?: ArrayBuffer // 未変換で残ることはないが補正前後で差し替わるため任意
  preview?: string // blob URL（サムネイル表示用）
  name: string // 保存ファイル名の素・alt 用
  originalFileName: string // 元ファイル名保持
  fileType: string // MIME タイプ
  size?: number // バイト数（表示用）
  isSelected: boolean // UI選択状態
  correctionStatus?: "corrected" | "skipped" | "not_requested"
  correctedForPage?: number // 補正時に対応付けたマスターページ番号
  correctionError?: string
}

// ============================================================================
// テーブルDnD互換の型定義
// ============================================================================

/**
 * 配置戦略
 */
export type PlacementStrategy = "page-first" | "student-first"

// ============================================================================
// データベース連携用の型定義
// ============================================================================

/**
 * ElectronAPI用のアップロードデータ形式（uploadStudentAnswers の入力）。
 * 配置先は examPageId 直指定（列＝ExamPage 実体から導出）。
 */
export interface UploadData {
  name: string
  fileName: string
  originalFileName: string
  type: string
  buffer: ArrayBuffer
  studentId: string // 受験生徒ID（= Student.id）
  examPageId: string // 配置先 ExamPage.id
  overwrite: boolean // 上書きフラグ
  correctWithMarkers?: boolean // マーカー補正フラグ
  correctionStatus?: "corrected" | "skipped" | "not_requested" // クライアント側補正結果
}

// ============================================================================
// 変更状態管理用の型定義
// ============================================================================

/**
 * 保留中の変更データ（view 方式B の move/swap を確認モーダルへ渡す view-model）。
 * 同定は id（examPageId/studentId）。studentName・pageNumber は確認モーダル表示用に
 * 生成時点でエンティティから導出して持つ（DBデータの射影ではなく UI 差分の表示補助）。
 */
export interface PendingChange {
  id: string // ユニークID
  movedFileId: string // 移動されたファイルのID（= StudentAnswerImage.id）
  targetFileId: string | null // 移動先にあったファイルのID（空の場合はnull）
  timestamp: Date // 変更時刻
  fromPosition: PendingChangePosition // 移動元の位置
  toPosition: PendingChangePosition // 移動先の位置
}

/** 変更の移動元/移動先の位置。同定は examPageId/studentId、表示は導出値。 */
export interface PendingChangePosition {
  studentId: string | null
  examPageId: string
  pageNumber: number // 表示用（列 ExamPage から導出）
  studentName?: string // 表示用（行 ExamStudent から導出）
}

/**
 * 移動1件ごとの採点データ処理方針（view 方式B）。
 * - carry: 採点も追従（同一ページの生徒付け替えのみ可）
 * - discard: 採点を破棄（要再採点。ページ跨ぎは常にこれ）
 * バックエンド `applyStudentAnswerPlacements` の scorePolicy と一致させる。
 */
export type PlacementScorePolicy = "carry" | "discard"
