/**
 * ファイル検証関連のユーティリティ関数
 *
 * 模範解答ファイルのアップロード時に使用される
 * ファイル検証ロジックを提供します。
 */

/**
 * サポートされているファイル形式の定義
 */
const SUPPORTED_FILE_TYPES = {
  PDF: "application/pdf",
  PNG: "image/png",
  JPEG: "image/jpeg",
  JPG: "image/jpg",
} as const

/**
 * サポートされているファイル拡張子
 */
const SUPPORTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"] as const

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
  const hasValidExtension = SUPPORTED_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext)
  )

  // MIMEタイプの検証
  const mimeType = file.type.toLowerCase()
  const hasValidMimeType = Object.values(SUPPORTED_FILE_TYPES).some(
    (type) => mimeType === type.toLowerCase() || mimeType.startsWith("image/")
  )

  return hasValidExtension && hasValidMimeType
}
