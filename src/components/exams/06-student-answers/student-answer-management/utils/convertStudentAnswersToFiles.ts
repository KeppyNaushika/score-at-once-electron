import type { AnswerItem } from "@/components/exams/06-student-answers/types"
import type { StudentAnswerImageWithExamPageAndStudent } from "@/types/prismaExtensions"

/** DB取得済みの答案データ（Prisma型）を共通描画ビュー AnswerItem 配列に射影する */
export function convertAnswerSheetsToFiles(
  answerSheets: StudentAnswerImageWithExamPageAndStudent[]
): AnswerItem[] {
  return answerSheets.map((answerSheet) => {
    const imagePath = answerSheet.imagePath
    const pageNumber = answerSheet.examPage.pageNumber

    return {
      id: answerSheet.id,
      name: `${answerSheet.studentId || "unknown"}_page${pageNumber}`,
      // DB答案は buffer を持たない（imagePath で遅延読込。偽の 0埋めはしない）。
      preview: undefined, // 遅延読み込みでBase64データを設定
      studentId: answerSheet.studentId || undefined,
      pageNumber: pageNumber || 1,
      // 既存画像の場合は遅延読み込み用のパス情報を保持
      imagePath: imagePath,
    }
  })
}

// imagePath → 読み込み済みデータURL のキャッシュ。
// グリッドのセルで一度読み込んだ画像を、ドラッグ中の DragOverlay プレビュー（別インスタンスの
// FilePreviewCell）が即座に再利用できるようにする（再取得による灰色アイコン→画像のポップインを防ぐ）。
// 同一画像の重複 IPC 取得の削減にもなる。
const imageDataUrlCache = new Map<string, string>()

/** 既に読み込み済みなら同期でデータURLを返す（未読込は undefined） */
export function getCachedStudentAnswerImage(
  imagePath: string
): string | undefined {
  return imageDataUrlCache.get(imagePath)
}

/** 答案画像をBase64データURLとして読み込む（遅延読み込み・キャッシュ対応） */
export async function loadStudentAnswerImage(
  file: AnswerItem
): Promise<string> {
  // 新規ファイル（メモリ内）の場合はpreviewを返す
  if (file.preview && !file.imagePath) {
    return file.preview
  }

  // 既存ファイル（DB保存済み）の場合
  if (!file.imagePath) {
    throw new Error("Image path not found")
  }

  const cached = imageDataUrlCache.get(file.imagePath)
  if (cached) {
    return cached
  }

  try {
    const result = await window.electronAPI.getImageData(file.imagePath)

    if (result.success && result.data) {
      imageDataUrlCache.set(file.imagePath, result.data)
      return result.data
    } else {
      const error = result.error || "Failed to load image"
      throw new Error(error)
    }
  } catch (error) {
    console.error("画像読み込みエラー:", error)
    throw error
  }
}
