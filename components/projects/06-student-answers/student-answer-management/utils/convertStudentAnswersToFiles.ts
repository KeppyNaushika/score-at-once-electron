import type { ProcessedStudentAnswer } from "@/components/projects/06-student-answers/student-answer-management/types"
import type { UnifiedFile } from "@/components/projects/06-student-answers/types"

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
      projectPage: {
        pageNumber: number
      }
    }

/**
 * データベースから取得した答案データを、テーブル表示用のUnifiedFile形式に変換する
 * @param answerSheets データベースから取得した答案データ
 * @returns UnifiedFile配列
 */
export function convertAnswerSheetsToFiles(
  answerSheets: AnswerSheetInput[],
): UnifiedFile[] {
  return answerSheets.map((answerSheet) => {
    // Handle both processed format (originalImagePath) and raw format (imagePath)
    const imagePath =
      "originalImagePath" in answerSheet
        ? answerSheet.originalImagePath
        : answerSheet.imagePath

    // Handle both processed format (pageNumber) and raw format (projectPage.pageNumber)
    const pageNumber =
      "pageNumber" in answerSheet
        ? answerSheet.pageNumber
        : answerSheet.projectPage.pageNumber

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

      // table-dnd-kit-test統合用
      color: undefined,
      position: undefined,
    }
  })
}

/**
 * 生徒答案画像の遅延読み込み用関数
 * @param file UnifiedFileオブジェクト
 * @returns Base64エンコードされた画像データURL
 */
export async function loadStudentAnswerImage(file: UnifiedFile): Promise<string> {
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
