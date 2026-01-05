import { ConvertedImage } from "@/lib/pdfConverter"
import { MasterAnswer } from "@/components/projects/01-upload/types"

/**
 * 画像リストをページ番号順にソートする
 * @param {MasterAnswer[]} answers - ソート対象の解答リスト
 * @returns {MasterAnswer[]} ページ番号順にソートされた解答リスト
 */
export const sortImagesByPageNumber = (
  answers: MasterAnswer[]
): MasterAnswer[] => {
  return [...answers].sort((a, b) => a.pageNumber - b.pageNumber)
}

/**
 * 画像URLマップを生成する
 * @param {MasterAnswer[]} answers - 解答リスト
 * @returns {Promise<Record<string, string>>} 解答IDとURLのマッピング
 */
export const generateImageUrls = async (
  answers: MasterAnswer[]
): Promise<Record<string, string>> => {
  const urls: Record<string, string> = {}

  for (const answer of answers) {
    try {
      const resolvedUrl = await window.electronAPI.resolveFileProtocolPath(
        answer.imagePath
      )
      urls[answer.id] = resolvedUrl
    } catch (error) {
      console.error(
        `Failed to resolve path for answer ${answer.id} (${answer.imagePath}):`,
        error
      )
      urls[answer.id] = ""
    }
  }

  return urls
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
 * @param {MasterAnswer[]} answers - 現在の解答リスト
 * @param {number} fromIndex - 移動元のインデックス
 * @param {"left" | "right"} direction - 移動方向
 * @returns {MasterAnswer[] | null} 移動後の解答リスト（移動不可の場合はnull）
 */
export const moveImageInList = (
  answers: MasterAnswer[],
  fromIndex: number,
  direction: "left" | "right"
): MasterAnswer[] | null => {
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
 * 解答移動用のページ番号更新リクエストを生成する
 * @param {MasterAnswer[]} answers - 解答リスト
 * @returns {Array<{id: string, pageNumber: number}>} 更新リクエスト配列
 */
export const generatePageNumberUpdateRequests = (
  answers: MasterAnswer[]
): Array<{ id: string; pageNumber: number }> => {
  return answers.map((answer, index) => ({
    id: answer.id,
    pageNumber: index + 1,
  }))
}

/**
 * ProjectPage配列からMasterAnswer配列を生成する
 * @param {ProjectPageWithDetails[]} projectPages - プロジェクトページ一覧
 * @returns {MasterAnswer[]} MasterAnswer形式の配列
 */
type MinimalPageImage = {
  id: string
  imagePath: string
  imageType: string
  createdAt: Date
  updatedAt: Date
}

type MinimalMasterImage = {
  id: string
  imagePath: string
  createdAt: Date
  updatedAt: Date
}

type MinimalProjectPage = {
  id: string
  projectId: string
  pageNumber: number
  masterImages?: MinimalMasterImage[]
  pageImages?: MinimalPageImage[]
}

export const convertProjectPagesToMasterAnswers = <
  T extends MinimalProjectPage,
>(
  projectPages: T[]
): MasterAnswer[] => {
  return projectPages.flatMap((page) => {
    // 新スキーマでは masterImages、旧スキーマでは pageImages(MODEL_ANSWER) を参照する
    const masterImages =
      page.masterImages && page.masterImages.length > 0
        ? page.masterImages
        : page.pageImages?.filter((img) => img.imageType === "MODEL_ANSWER") ||
          []

    if (masterImages.length === 0) {
      console.warn(
        `Project page ${page.id} has no master images (masterImages/pageImages MODEL_ANSWER not found).`
      )
      return []
    }

    return masterImages.map((masterImage) => ({
      id: masterImage.id,
      projectId: page.projectId,
      imagePath: masterImage.imagePath,
      pageNumber: page.pageNumber,
      createdAt: masterImage.createdAt,
      updatedAt: masterImage.updatedAt,
    }))
  })
}
