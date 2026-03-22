import type { ProcessedStudentAnswer } from "@/components/exams/06-student-answers/student-answer-management/types"
import type { UnifiedFile } from "@/components/exams/06-student-answers/types"

// For backward compatibility, support both processed and raw formats
type AnswerSheetInput =
  | ProcessedStudentAnswer
  | {
      // Raw Prisma format
      id: string
      studentId: string | null
      imagePath: string
      student: {
        id: string
        lastName: string
        firstName: string
        lastNameKana: string
        firstNameKana: string
        studentId: string
      } | null
      examPage: {
        pageNumber: number
      }
    }

/** DB取得済みの答案データをテーブル表示用のUnifiedFile配列に変換する */
export function convertAnswerSheetsToFiles(
  answerSheets: AnswerSheetInput[]
): UnifiedFile[] {
  return answerSheets.map((answerSheet) => {
    // Handle both processed format (originalImagePath) and raw format (imagePath)
    const imagePath =
      "originalImagePath" in answerSheet
        ? answerSheet.originalImagePath
        : answerSheet.imagePath

    // Handle both processed format (pageNumber) and raw format (examPage.pageNumber)
    const pageNumber =
      "pageNumber" in answerSheet
        ? answerSheet.pageNumber
        : answerSheet.examPage.pageNumber

    return {
      id: answerSheet.id,
      name: `${answerSheet.studentId || "unknown"}_page${pageNumber}`,
      type: imagePath?.split(".").pop() || "image",
      size: 0, // 既存ファイルのサイズは取得不可
      buffer: new ArrayBuffer(0), // 既存ファイルのバッファは遅延読み込み
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
      position: undefined,
    }
  })
}

/** UnifiedFileから答案画像をBase64データURLとして読み込む（遅延読み込み対応） */
export async function loadStudentAnswerImage(
  file: UnifiedFile
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
