/**
 * ファイル検証関連のユーティリティ関数
 * 
 * 模範解答ファイルのアップロード時に使用される
 * ファイル検証ロジックを提供します。
 */

/**
 * サポートされているファイル形式の定義
 */
export const SUPPORTED_FILE_TYPES = {
  PDF: "application/pdf",
  PNG: "image/png", 
  JPEG: "image/jpeg",
  JPG: "image/jpg",
} as const

/**
 * サポートされているファイル拡張子
 */
export const SUPPORTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"] as const

/**
 * 模範解答として有効なファイルかどうかを検証する
 * 
 * @param file - 検証対象のファイル
 * @returns ファイルが有効な場合はtrue、無効な場合はfalse
 */
export function isValidMasterImageFile(file: File): boolean {
  if (!file) return false

  // ファイル名から拡張子を取得
  const fileName = file.name.toLowerCase()
  const hasValidExtension = SUPPORTED_EXTENSIONS.some(ext => 
    fileName.endsWith(ext)
  )

  // MIMEタイプの検証
  const mimeType = file.type.toLowerCase()
  const hasValidMimeType = Object.values(SUPPORTED_FILE_TYPES).some(type =>
    mimeType === type.toLowerCase() || mimeType.startsWith("image/")
  )

  return hasValidExtension && hasValidMimeType
}

/**
 * ファイルがPDFかどうかを判定する
 * 
 * @param file - 検証対象のファイル
 * @returns PDFファイルの場合はtrue、それ以外はfalse
 */
export function isPdfFile(file: File): boolean {
  if (!file) return false
  
  const fileName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()
  
  return fileName.endsWith(".pdf") || mimeType === SUPPORTED_FILE_TYPES.PDF.toLowerCase()
}

/**
 * ファイルが画像かどうかを判定する
 * 
 * @param file - 検証対象のファイル
 * @returns 画像ファイルの場合はtrue、それ以外はfalse
 */
export function isImageFile(file: File): boolean {
  if (!file) return false
  
  const fileName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()
  
  const imageExtensions = [".png", ".jpg", ".jpeg"]
  const hasImageExtension = imageExtensions.some(ext => fileName.endsWith(ext))
  const hasImageMimeType = mimeType.startsWith("image/")
  
  return hasImageExtension && hasImageMimeType
}

/**
 * ファイルサイズが制限内かどうかを検証する
 * 
 * @param file - 検証対象のファイル
 * @param maxSizeInBytes - 最大ファイルサイズ（バイト）
 * @returns ファイルサイズが制限内の場合はtrue、超過している場合はfalse
 */
export function isValidFileSize(file: File, maxSizeInBytes: number): boolean {
  if (!file) return false
  return file.size <= maxSizeInBytes
}

/**
 * ファイル名が有効かどうかを検証する
 * 
 * @param fileName - 検証対象のファイル名
 * @returns ファイル名が有効な場合はtrue、無効な場合はfalse
 */
export function isValidFileName(fileName: string): boolean {
  if (!fileName || fileName.trim().length === 0) return false
  
  // 危険な文字を含まないかチェック
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/
  if (dangerousChars.test(fileName)) return false
  
  // 予約語チェック（Windows）
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
  if (reservedNames.test(fileName)) return false
  
  return true
}