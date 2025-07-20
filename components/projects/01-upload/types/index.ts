import { Prisma } from "@prisma/client"

/**
 * マスター画像の型定義
 * プロジェクトの模範解答画像データを表す
 */
export type MasterImage = Prisma.MasterImageGetPayload<{}>

/**
 * マスター画像管理コンポーネントのProps
 * @interface MasterImageManagerProps
 * @property {string} projectId - プロジェクトID
 * @property {MasterImage[]} initialMasterImages - 初期マスター画像リスト
 * @property {function} onMasterImagesChange - マスター画像変更時のコールバック関数
 */
export interface MasterImageManagerProps {
  projectId: string
  initialMasterImages: MasterImage[]
  onMasterImagesChange: (images: MasterImage[]) => void
}

/**
 * マスター画像ギャラリーのProps
 * @interface MasterImageGalleryProps
 * @property {MasterImage[]} images - 表示する画像リスト
 * @property {Record<string, string>} imageUrls - 画像IDとURLのマッピング
 * @property {Record<string, boolean>} isDeleting - 削除中の画像IDマップ
 * @property {boolean} isMoving - 移動処理中かどうか
 * @property {function} onDeleteImage - 画像削除ハンドラー
 * @property {function} onMoveImage - 画像移動ハンドラー
 */
export interface MasterImageGalleryProps {
  images: MasterImage[]
  imageUrls: Record<string, string>
  isDeleting: Record<string, boolean>
  isMoving: boolean
  onDeleteImage: (imageId: string) => void
  onMoveImage: (fromIndex: number, direction: "left" | "right") => void
}

/**
 * 個別マスター画像カードのProps
 * @interface MasterImageCardProps
 * @property {MasterImage} image - 画像データ
 * @property {string} imageUrl - 画像URL
 * @property {number} index - 配列内のインデックス
 * @property {number} totalImages - 総画像数
 * @property {boolean} isDeleting - 削除中かどうか
 * @property {boolean} isMoving - 移動中かどうか
 * @property {function} onDelete - 削除ハンドラー
 * @property {function} onMoveLeft - 左移動ハンドラー
 * @property {function} onMoveRight - 右移動ハンドラー
 */
export interface MasterImageCardProps {
  image: MasterImage
  imageUrl: string
  index: number
  totalImages: number
  isDeleting: boolean
  isMoving: boolean
  onDelete: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
}

/**
 * パスワードダイアログの状態
 * @interface PasswordDialogState
 * @property {boolean} isOpen - ダイアログが開いているかどうか
 * @property {string} fileName - 処理中のファイル名
 * @property {number} attempts - パスワード入力試行回数
 * @property {boolean} hasError - エラーが発生しているかどうか
 * @property {boolean} isLoading - 処理中かどうか
 */
export interface PasswordDialogState {
  isOpen: boolean
  fileName?: string
  attempts: number
  hasError: boolean
  isLoading: boolean
}

/**
 * マスター画像管理の状態
 * @interface MasterImagesState
 * @property {MasterImage[]} images - 画像リスト
 * @property {Record<string, string>} imageUrls - 画像URLマップ
 * @property {boolean} isUploading - アップロード中かどうか
 * @property {Record<string, boolean>} isDeleting - 削除中マップ
 * @property {boolean} isMoving - 移動中かどうか
 * @property {PasswordDialogState} passwordDialog - パスワードダイアログ状態
 */
export interface MasterImagesState {
  images: MasterImage[]
  imageUrls: Record<string, string>
  isUploading: boolean
  uploadProgress: number
  isDeleting: Record<string, boolean>
  isMoving: boolean
  passwordDialog: PasswordDialogState
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

/**
 * マスター画像ページの状態管理Props
 * @interface MasterImagePageState
 * @property {MasterImage[]} masterImages - マスター画像リスト
 * @property {boolean} isLoading - ローディング状態
 * @property {any} project - プロジェクトデータ
 */
export interface MasterImagePageState {
  masterImages: MasterImage[]
  isLoading: boolean
  project: any
}