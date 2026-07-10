import type {
  AnswerItem,
  UnifiedFile,
} from "@/components/exams/06-student-answers/types"
import type { StudentAnswerImageWithExamPageAndStudent } from "@/types/prismaExtensions"

/** DB取得済みの答案データ（Prisma型）をテーブル表示用のUnifiedFile配列に変換する */
export function convertAnswerSheetsToFiles(
  answerSheets: StudentAnswerImageWithExamPageAndStudent[]
): UnifiedFile[] {
  return answerSheets.map((answerSheet) => {
    const imagePath = answerSheet.imagePath
    const pageNumber = answerSheet.examPage.pageNumber

    return {
      id: answerSheet.id,
      name: `${answerSheet.studentId || "unknown"}_page${pageNumber}`,
      type: imagePath?.split(".").pop() || "image",
      // DB答案は size/buffer を持たない（遅延読込。偽の 0埋めはしない）。
      preview: undefined, // 遅延読み込みでBase64データを設定
      studentId: answerSheet.studentId || undefined,
      pageNumber: pageNumber || 1,
      isSelected: false,
      originalFileName: `答案_${answerSheet.id}`,
      pageLabel: `ページ${pageNumber}`,

      // 既存画像の場合は遅延読み込み用のパス情報を保持
      imagePath: imagePath,

      // テーブルDnD統合用
      color: undefined,
    }
  })
}

/** 答案画像をBase64データURLとして読み込む（遅延読み込み対応） */
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

  try {
    const result = await window.electronAPI.getImageData(file.imagePath)

    if (result.success && result.data) {
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
