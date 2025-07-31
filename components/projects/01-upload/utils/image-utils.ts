import { ConvertedImage } from "@/lib/pdfConverter"
import { MasterAnswer } from "@/components/projects/01-upload/types"

/**
 * 画像リストをページ番号順にソートする
 * @param {MasterAnswer[]} answers - ソート対象の解答リスト
 * @returns {MasterAnswer[]} ページ番号順にソートされた解答リスト
 */
export const sortImagesByPageNumber = (
  answers: MasterAnswer[],
): MasterAnswer[] => {
  return [...answers].sort((a, b) => a.pageNumber - b.pageNumber)
}

/**
 * 画像URLマップを生成する
 * @param {MasterImage[]} images - 画像リスト
 * @returns {Promise<Record<string, string>>} 画像IDとURLのマッピング
 */
export const generateImageUrls = async (
  images: MasterImage[],
): Promise<Record<string, string>> => {
  const urls: Record<string, string> = {}

  for (const image of images) {
    try {
      const resolvedUrl = await window.electronAPI.resolveFileProtocolPath(
        image.imagePath,
      )
      urls[image.id] = resolvedUrl
    } catch (error) {
      console.error(
        `Failed to resolve path for image ${image.id} (${image.imagePath}):`,
        error,
      )
      urls[image.id] = ""
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
  convertedImages?: ConvertedImage[],
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
  imageCount: number,
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
 * 画像の移動操作を実行する
 * @param {MasterImage[]} images - 現在の画像リスト
 * @param {number} fromIndex - 移動元のインデックス
 * @param {"left" | "right"} direction - 移動方向
 * @returns {MasterImage[] | null} 移動後の画像リスト（移動不可の場合はnull）
 */
export const moveImageInList = (
  images: MasterImage[],
  fromIndex: number,
  direction: "left" | "right",
): MasterImage[] | null => {
  const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1

  if (toIndex < 0 || toIndex >= images.length) {
    return null
  }

  const newImages = [...images]
  const [movedImage] = newImages.splice(fromIndex, 1)
  newImages.splice(toIndex, 0, movedImage)

  return newImages
}

/**
 * 画像移動用のページ番号更新リクエストを生成する
 * @param {MasterImage[]} images - 画像リスト
 * @returns {Array<{id: string, pageNumber: number}>} 更新リクエスト配列
 */
export const generatePageNumberUpdateRequests = (
  images: MasterImage[],
): Array<{ id: string; pageNumber: number }> => {
  return images.map((image, index) => ({
    id: image.id,
    pageNumber: index + 1,
  }))
}
