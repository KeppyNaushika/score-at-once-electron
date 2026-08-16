import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import type { ConvertedImage } from "@/lib/pdfConverter"

/**
 * 模範解答ページをページ番号順にソートする
 */
export const sortImagesByPageNumber = (
  answers: ExamPageWithContent[]
): ExamPageWithContent[] => {
  return [...answers].sort(
    (answerA, answerB) => answerA.pageNumber - answerB.pageNumber
  )
}

/**
 * ファイルタイプに基づいてアップロード用データを作成する
 * @param {File} file - アップロード対象のファイル
 * @param {ConvertedImage[]} convertedImages - PDF変換済み画像データ（PDFの場合）
 * @returns {ConvertedImage[]} アップロード用データ配列
 */
export const createUploadData = async (
  file: File,
  convertedImages?: ConvertedImage[]
): Promise<ConvertedImage[]> => {
  if (file.type === "application/pdf") {
    return convertedImages || []
  } else {
    // 通常の画像ファイルの処理
    const buffer = await file.arrayBuffer()
    return [
      {
        name: file.name,
        type: file.type,
        buffer: buffer,
      },
    ]
  }
}

/**
 * アップロード結果メッセージを生成する
 * @param {number} totalPages - 総ページ数
 * @param {number} pdfCount - PDFファイル数
 * @param {number} imageCount - 画像ファイル数
 * @returns {string} 成功メッセージ
 */
export const generateUploadSuccessMessage = (
  totalPages: number,
  pdfCount: number,
  imageCount: number
): string => {
  let message = `${totalPages}枚の模範解答をアップロードしました`

  if (pdfCount > 0 && imageCount > 0) {
    message += ` (PDF ${pdfCount}ファイル, 画像 ${imageCount}ファイル)`
  } else if (pdfCount > 0) {
    message += ` (PDF ${pdfCount}ファイル)`
  }

  return message
}
