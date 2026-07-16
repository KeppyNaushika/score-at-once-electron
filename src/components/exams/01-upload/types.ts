/**
 * マスター解答の型定義
 * 試験の模範解答画像データを表す
 */
export type MasterAnswer = {
  id: string
  examId: string
  imagePath: string
  pageNumber: number
  pageSize: string
  createdAt: Date
  updatedAt: Date
}

/**
 * マスター解答管理コンポーネントのProps
 * @interface MasterAnswerManagerProps
 * @property {string} examId - 試験ID
 * @property {MasterAnswer[]} initialMasterAnswers - 初期マスター解答リスト
 * @property {function} onMasterAnswersChange - マスター解答変更時のコールバック関数
 */
export interface MasterAnswerManagerProps {
  examId: string
  initialMasterAnswers: MasterAnswer[]
  onMasterAnswersChange: (answers: MasterAnswer[]) => void
}

/**
 * マスター解答ギャラリーのProps
 * @interface MasterAnswerGalleryProps
 * @property {MasterAnswer[]} answers - 表示する解答リスト
 * @property {Record<string, string>} imageUrls - 画像IDとURLのマッピング
 * @property {Record<string, boolean>} isDeleting - 削除中の解答IDマップ
 * @property {boolean} isMoving - 移動処理中かどうか
 * @property {function} onDeleteAnswer - 解答削除ハンドラー
 * @property {function} onMoveAnswer - 解答移動ハンドラー
 */
export interface MasterAnswerGalleryProps {
  answers: MasterAnswer[]
  imageUrls: Record<string, string>
  isDeleting: Record<string, boolean>
  isMoving: boolean
  onDeleteAnswer: (answerId: string) => void
  onMoveAnswer: (fromIndex: number, direction: "left" | "right") => void
  onPageSizeChange: (answerId: string, pageSize: string) => void
}

/**
 * 個別マスター解答カードのProps
 * @interface MasterAnswerCardProps
 * @property {MasterAnswer} answer - 解答データ
 * @property {string} imageUrl - 画像URL
 * @property {number} index - 配列内のインデックス
 * @property {number} totalAnswers - 総解答数
 * @property {boolean} isDeleting - 削除中かどうか
 * @property {boolean} isMoving - 移動中かどうか
 * @property {function} onDelete - 削除ハンドラー
 * @property {function} onMoveLeft - 左移動ハンドラー
 * @property {function} onMoveRight - 右移動ハンドラー
 */
export interface MasterAnswerCardProps {
  answer: MasterAnswer
  imageUrl: string
  index: number
  totalAnswers: number
  isDeleting: boolean
  isMoving: boolean
  onDelete: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onPageSizeChange: (pageSize: string) => void
}

/**
 * マスター解答管理の状態
 * @interface MasterAnswersState
 * @property {MasterAnswer[]} answers - 解答リスト
 * @property {Record<string, string>} imageUrls - 画像URLマップ
 * @property {boolean} isUploading - アップロード中かどうか
 * @property {Record<string, boolean>} isDeleting - 削除中マップ
 * @property {boolean} isMoving - 移動中かどうか
 */
export interface MasterAnswersState {
  answers: MasterAnswer[]
  imageUrls: Record<string, string>
  isUploading: boolean
  uploadProgress: number
  isDeleting: Record<string, boolean>
  isMoving: boolean
}

/**
 * ファイルアップロードドロップゾーンのProps
 * @interface FileUploadDropzoneProps
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
