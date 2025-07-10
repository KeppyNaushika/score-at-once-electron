import type { AnswerSheetWithDetails } from "@/types/electron"
import type { UnifiedFile } from "@/types/answer-sheet.types"

// Temporary interface to handle serialized answer sheets
interface SerializedAnswerSheet {
  id: string
  studentId: string | null
  pageNumber: number
  originalImagePath: string | null
  isAbsent?: boolean
  student: {
    id: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    studentId: string
  } | null
}

/**
 * データベースから取得した答案データを、テーブル表示用のUnifiedFile形式に変換する
 * @param answerSheets データベースから取得した答案データ
 * @returns UnifiedFile配列
 */
export function convertAnswerSheetsToFiles(
  answerSheets: AnswerSheetWithDetails[] | SerializedAnswerSheet[]
): UnifiedFile[] {
  return answerSheets.map((answerSheet) => {
    // 正しいプロパティ名を使用（originalImagePath）
    const imagePath = answerSheet.originalImagePath
    
    return {
      id: answerSheet.id,
      name: `${answerSheet.studentId || 'unknown'}_page${answerSheet.pageNumber}`,
      type: imagePath?.split('.').pop() || 'image',
      size: 0, // 既存ファイルのサイズは取得不可
      buffer: new ArrayBuffer(0), // 既存ファイルのバッファは遅延読み込み
      preview: undefined, // 遅延読み込みでBase64データを設定
      studentId: answerSheet.studentId || undefined,
      pageNumber: answerSheet.pageNumber || 1,
      isSelected: false,
      originalFileName: `答案_${answerSheet.id}`,
      pageLabel: `ページ${answerSheet.pageNumber}`,
      
      // 既存画像の場合は遅延読み込み用のパス情報を保持
      imagePath: imagePath,
      
      // table-dnd-kit-test統合用
      color: undefined,
      position: undefined,
    }
  })
}

/**
 * 答案画像の遅延読み込み用関数
 * @param file UnifiedFileオブジェクト
 * @returns Base64エンコードされた画像データURL
 */
export async function loadAnswerSheetImage(file: UnifiedFile): Promise<string> {
  if (!file.imagePath) {
    throw new Error('Image path not found')
  }
  
  try {
    const result = await window.electronAPI.getImageData(file.imagePath)
    if (result.success && result.data) {
      return result.data
    } else {
      throw new Error(result.error || 'Failed to load image')
    }
  } catch (error) {
    console.error('Error loading answer sheet image:', error)
    throw error
  }
}