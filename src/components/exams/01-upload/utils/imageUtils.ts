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

/**
 * 解答の移動操作を実行する
 * @returns 移動後のリスト（移動不可の場合はnull）
 */
export const moveImageInList = (
  answers: ExamPageWithContent[],
  fromIndex: number,
  direction: "left" | "right"
): ExamPageWithContent[] | null => {
  const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1

  if (toIndex < 0 || toIndex >= answers.length) {
    return null
  }

  const newAnswers = [...answers]
  const [movedAnswer] = newAnswers.splice(fromIndex, 1)
  newAnswers.splice(toIndex, 0, movedAnswer)

  return newAnswers
}

/**
 * 解答移動用のページ番号更新リクエストを生成する（id は ExamPage.id）
 */
export const generatePageNumberUpdateRequests = (
  answers: ExamPageWithContent[]
): Array<{ id: string; pageNumber: number }> => {
  return answers.map((answer, index) => ({
    id: answer.id,
    pageNumber: index + 1,
  }))
}
