/**
 * table-dnd-kit-test準拠のデータ変換レイヤー
 * 既存データ ⟷ table-dnd-kit-test形式の完全互換変換
 * レポート分析に基づき複雑なstate管理を簡素化
 */

import type {
  UnifiedStudent,
  UnifiedFile,
  UploadData,
  ExistingAnswerSheet,
  TableData,
  TableCell,
  DisabledState,
  PlacementStrategy,
} from "@/types/answer-sheet.types"
import type { AnswerSheetWithDetails } from "@/types/electron"
import {
  sortStudentsForTable,
  calculatePosition,
  parsePosition,
  getStudentRowIndex,
} from "./studentOrderUtils"

// ============================================================================
// 既存データからUnified形式への変換
// ============================================================================

/**
 * 既存のStudentDataをUnifiedStudentに変換
 * 05-answer-sheets/page.tsxの形式から変換
 */
export function convertToUnifiedStudent(studentData: any): UnifiedStudent {
  return {
    id: studentData.id,
    lastName: studentData.lastName,
    firstName: studentData.firstName,
    lastNameKana: studentData.lastNameKana,
    firstNameKana: studentData.firstNameKana,
    studentId: studentData.studentId,
    attendanceNumber: studentData.attendanceNumber || null,
    status: studentData.status || "participating",
    customOrder: studentData.customOrder,
  }
}

/**
 * 既存のAnswerSheetWithDetailsからExistingAnswerSheetに変換
 */
export function convertToExistingAnswerSheet(
  answerSheet: AnswerSheetWithDetails
): ExistingAnswerSheet {
  return {
    id: answerSheet.id,
    studentId: answerSheet.studentId,
    pageNumber: answerSheet.pageNumber,
    createdAt: new Date(answerSheet.createdAt),
    isAbsent: answerSheet.isAbsent,
    student: answerSheet.student
      ? {
          id: answerSheet.student.id,
          lastName: answerSheet.student.lastName,
          firstName: answerSheet.student.firstName,
          studentId: answerSheet.student.studentId,
        }
      : undefined,
  }
}

/**
 * 既存のConvertedFileをUnifiedFileに変換
 */
export function convertToUnifiedFile(convertedFile: any): UnifiedFile {
  return {
    id: convertedFile.id,
    name: convertedFile.name,
    type: convertedFile.type,
    size: convertedFile.size,
    buffer: convertedFile.buffer,
    preview: convertedFile.preview,
    studentId: convertedFile.studentId,
    pageNumber: convertedFile.pageNumber,
    isSelected: convertedFile.isSelected || false,
    originalFileName: convertedFile.originalFileName,
    pageLabel: convertedFile.pageLabel,
    // table-dnd-kit-test用のプロパティは後で設定
    color: undefined,
    position: undefined,
  }
}

// ============================================================================
// table-dnd-kit-test形式への変換
// ============================================================================

/**
 * table-dnd-kit-testのgetTableData相当の関数
 * files配列と生徒リストから表形式のデータを生成
 * 🚨 修正: maxPagesを外部から受け取る（模範解答のページ数）
 */
export function getTableData(
  files: UnifiedFile[],
  sortedStudents: UnifiedStudent[], // 既にソート済みの生徒データを受け取る
  disabledState: DisabledState,
  placementStrategy: PlacementStrategy = "page-first",
  maxPages?: number
): TableData {
  // 🚨 修正: 模範解答のページ数を優先使用
  const actualMaxPages = maxPages || Math.max(...files.map((f) => f.pageNumber), 1)

  const tableData: TableData = []

  // 行（生徒）ごとに処理
  for (let studentIndex = 0; studentIndex < sortedStudents.length; studentIndex++) {
    const student = sortedStudents[studentIndex]
    const row: TableCell[] = []

    // 列（ページ）ごとに処理
    for (let pageNumber = 1; pageNumber <= actualMaxPages; pageNumber++) {
      const position = calculatePosition(studentIndex, pageNumber, actualMaxPages)
      
      // この位置に配置されているファイルを検索
      const file = files.find(
        (f) => f.studentId === student.id && f.pageNumber === pageNumber
      ) || null

      // 無効化判定
      const isDisabled = isPositionDisabled(
        position,
        studentIndex,
        pageNumber - 1, // colIndex は 0-based
        disabledState
      )

      const cell: TableCell = {
        studentIndex,
        pageNumber,
        position,
        file,
        student,
        isDisabled,
      }

      row.push(cell)
    }

    tableData.push(row)
  }

  return tableData
}

/**
 * table-dnd-kit-testのisPositionDisabled相当の関数
 */
export function isPositionDisabled(
  position: number,
  rowIndex: number,
  colIndex: number,
  disabledState: DisabledState
): boolean {
  return (
    disabledState.rows.has(rowIndex) ||
    disabledState.cols.has(colIndex) ||
    disabledState.positions.has(position)
  )
}

/**
 * table-dnd-kit-test準拠の自動配置アルゴリズム
 * 複雑なGridStateを廃止し、シンプルなfiles配列操作に統一
 */
export function autoPlaceFiles(
  files: UnifiedFile[],
  students: UnifiedStudent[],
  disabledState: DisabledState,
  strategy: PlacementStrategy,
  maxPages: number
): UnifiedFile[] {
  const sortedStudents = sortStudentsForTable(students)
  let fileIndex = 0
  
  // 有効なファイル（未配置）のみ取得
  const enabledFiles = files.filter(f => !f.studentId)
  
  const getNextFile = () => {
    if (fileIndex < enabledFiles.length) {
      return enabledFiles[fileIndex++]
    }
    return null
  }

  // table-dnd-kit-test準拠の配置ロジック
  if (strategy === "page-first") {
    // ページ優先配置（行優先と同じ）
    const result: UnifiedFile[] = []
    
    for (let studentIndex = 0; studentIndex < sortedStudents.length; studentIndex++) {
      for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        const position = studentIndex * maxPages + (pageNumber - 1)
        
        if (!isPositionDisabled(position, studentIndex, pageNumber - 1, disabledState)) {
          const nextFile = getNextFile()
          if (nextFile) {
            result.push({
              ...nextFile,
              studentId: sortedStudents[studentIndex].id,
              pageNumber,
              position,
            })
          }
        }
      }
    }
    
    return [...files.filter(f => f.studentId), ...result]
    
  } else if (strategy === "student-first") {
    // 生徒優先配置（列優先と同じ）
    const result: UnifiedFile[] = []
    
    // 列優先でファイルを配置
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      for (let studentIndex = 0; studentIndex < sortedStudents.length; studentIndex++) {
        const position = studentIndex * maxPages + (pageNumber - 1)
        
        if (!isPositionDisabled(position, studentIndex, pageNumber - 1, disabledState)) {
          const nextFile = getNextFile()
          if (nextFile) {
            result.push({
              ...nextFile,
              studentId: sortedStudents[studentIndex].id,
              pageNumber,
              position,
            })
          }
        }
      }
    }
    
    return [...files.filter(f => f.studentId), ...result]
    
  } else {
    // filename-auto: ファイル名から自動判定（将来的な拡張）
    // とりあえずpage-firstと同じ動作
    return autoPlaceFiles(files, students, disabledState, "page-first", maxPages)
  }
}

/**
 * 配置戦略に基づく順序生成
 */
function generatePlacementOrder(
  studentCount: number,
  maxPages: number,
  strategy: PlacementStrategy
): number[] {
  const positions: number[] = []

  if (strategy === "page-first") {
    // ページ優先: 1ページ目を全生徒、2ページ目を全生徒...
    for (let page = 1; page <= maxPages; page++) {
      for (let student = 0; student < studentCount; student++) {
        positions.push(calculatePosition(student, page, maxPages))
      }
    }
  } else if (strategy === "student-first") {
    // 生徒優先: 1人目の全ページ、2人目の全ページ...
    for (let student = 0; student < studentCount; student++) {
      for (let page = 1; page <= maxPages; page++) {
        positions.push(calculatePosition(student, page, maxPages))
      }
    }
  } else {
    // filename-auto: ファイル名から自動判定（将来的な拡張）
    // とりあえずpage-firstと同じ動作
    return generatePlacementOrder(studentCount, maxPages, "page-first")
  }

  return positions
}

// ============================================================================
// データベース保存形式への変換
// ============================================================================

/**
 * table形式からElectronAPI用のUploadDataに変換
 */
export function convertToUploadData(
  files: UnifiedFile[],
  students: UnifiedStudent[]
): UploadData[] {
  const sortedStudents = sortStudentsForTable(students)
  const uploadData: UploadData[] = []

  for (const file of files) {
    if (!file.studentId || !file.buffer) {
      continue // 未配置またはバッファなしのファイルはスキップ
    }

    const student = sortedStudents.find((s) => s.id === file.studentId)
    if (!student) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`Student not found for file: ${file.name}`)
      }
      continue
    }

    uploadData.push({
      name: file.name,
      fileName: file.name,
      originalFileName: file.originalFileName,
      type: file.type,
      buffer: file.buffer,
      studentId: file.studentId,
      pageNumber: file.pageNumber,
      overwrite: false, // table-dnd-kit-testでは上書きは個別制御
    })
  }

  return uploadData
}

// ============================================================================
// 状態管理用のヘルパー関数
// ============================================================================

/**
 * 初期の無効化状態を作成
 */
export function createInitialDisabledState(): DisabledState {
  return {
    rows: new Set<number>(),
    cols: new Set<number>(),
    positions: new Set<number>(),
  }
}


/**
 * デバッグ用: table構造の確認
 */
export function debugTableData(tableData: TableData): void {
  if (process.env.NODE_ENV === "development") {
    console.log("🔍 Table構造（デバッグ）:")
    tableData.forEach((row, rowIndex) => {
      console.log(`  行 ${rowIndex} (${row[0]?.student.lastName} ${row[0]?.student.firstName}):`)
      row.forEach((cell, colIndex) => {
        const status = cell.file ? `📄 ${cell.file.name}` : "⬜ 空"
        const disabled = cell.isDisabled ? " [無効]" : ""
        console.log(`    列 ${colIndex} (ページ${cell.pageNumber}): ${status}${disabled}`)
      })
    })
  }
}