/**
 * 01-upload（模範解答アップロード）の型定義
 *
 * 模範解答ページは ExamPage そのもの（画像パスと用紙サイズをページが持つ）。
 * 一覧・削除・差し替えで扱う id はすべて ExamPage.id である。
 */

import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"

/**
 * マスター解答管理コンポーネントのProps
 * @property {string} examId - 試験ID
 * @property {ExamPageWithContent[]} initialMasterAnswers - 初期マスター解答リスト
 * @property {function} onMasterAnswersChange - マスター解答変更時のコールバック関数
 */
export interface MasterAnswerManagerProps {
  examId: string
  initialMasterAnswers: ExamPageWithContent[]
  onMasterAnswersChange: (answers: ExamPageWithContent[]) => void
}

/**
 * マスター解答ギャラリーのProps
 * @property {ExamPageWithContent[]} answers - 表示する解答リスト
 * @property {Record<string, string>} imageUrls - ページIDとURLのマッピング
 * @property {Record<string, boolean>} isDeleting - 削除中のページIDマップ
 * @property {boolean} isMoving - 移動処理中かどうか
 * @property {function} onDeleteAnswer - 解答削除ハンドラー
 * @property {function} onReplaceAnswer - 模範解答画像の差し替えハンドラー
 * @property {function} onMoveAnswer - 解答移動ハンドラー
 */
export interface MasterAnswerGalleryProps {
  answers: ExamPageWithContent[]
  imageUrls: Record<string, string>
  isDeleting: Record<string, boolean>
  isReplacing: Record<string, boolean>
  isMoving: boolean
  onDeleteAnswer: (examPageId: string) => void
  onReplaceAnswer: (examPageId: string, file: File) => void
  onMoveAnswer: (fromIndex: number, direction: "left" | "right") => void
  onPageSizeChange: (examPageId: string, pageSize: string) => void
}

/**
 * 個別マスター解答カードのProps
 * @property {ExamPageWithContent} answer - 模範解答ページ
 * @property {string} imageUrl - 画像URL
 * @property {number} index - 配列内のインデックス
 * @property {number} totalAnswers - 総ページ数
 * @property {boolean} isDeleting - 削除中かどうか
 * @property {boolean} isReplacing - 差し替え中かどうか
 * @property {boolean} isMoving - 移動中かどうか
 * @property {function} onDelete - 削除ハンドラー（確認済みの前提で呼ばれる）
 * @property {function} onReplace - 差し替えハンドラー
 * @property {function} onMoveLeft - 左移動ハンドラー
 * @property {function} onMoveRight - 右移動ハンドラー
 */
export interface MasterAnswerCardProps {
  answer: ExamPageWithContent
  imageUrl: string
  index: number
  totalAnswers: number
  isDeleting: boolean
  isReplacing: boolean
  isMoving: boolean
  onDelete: () => void
  onReplace: (file: File) => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onPageSizeChange: (pageSize: string) => void
}

/**
 * マスター解答管理の状態
 */
export interface MasterAnswersState {
  imageUrls: Record<string, string>
  isUploading: boolean
  uploadProgress: number
  isDeleting: Record<string, boolean>
  isReplacing: Record<string, boolean>
  isMoving: boolean
}

/**
 * ファイルアップロードドロップゾーンのProps
 * @property {function} onFilesSelected - ファイル選択時のコールバック関数
 * @property {boolean} isUploading - アップロード中かどうか
 * @property {number} uploadProgress - アップロード進捗（0-100）
 * @property {string} accept - 受け入れ可能なファイル形式
 * @property {number} maxFileSize - 最大ファイルサイズ（バイト）
 * @property {boolean} disabled - 無効化状態
 */
export interface FileUploadDropzoneProps {
  onFilesSelected: (files: File[]) => void
  isUploading?: boolean
  uploadProgress?: number
  accept?: string
  maxFileSize?: number
  disabled?: boolean
}
