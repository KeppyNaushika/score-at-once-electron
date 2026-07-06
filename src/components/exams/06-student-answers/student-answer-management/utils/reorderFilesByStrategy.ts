import type {
  PlacementStrategy,
  UnifiedFile,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

import type { ProcessedStudentAnswer } from "../types"
import { convertAnswerSheetsToFiles } from "./convertStudentAnswersToFiles"

/** 配置戦略（ページ順/生徒順）に基づいてファイル配列を再配置する */
export function reorderFilesByStrategy(
  currentFiles: UnifiedFile[],
  students: ExamStudentWithMemberships[],
  modelAnswerCount: number,
  newFileOrder: PlacementStrategy
): UnifiedFile[] {
  // 1. 実際のファイル（空でないもの）を抽出
  const actualFiles = currentFiles.filter((file) => file && file.id)

  if (actualFiles.length === 0) {
    return []
  }

  // 2. 生徒のソート（customOrder準拠）
  const sortedStudents = [...students].sort((studentA, studentB) => {
    const studentAOrder = studentA.customOrder ?? Number.MAX_SAFE_INTEGER
    const studentBOrder = studentB.customOrder ?? Number.MAX_SAFE_INTEGER
    return studentAOrder - studentBOrder
  })

  // 3. 新しい配置戦略に基づく理想的な位置順序を計算
  const newIdealPositions: Array<{ studentIndex: number; pageIndex: number }> =
    []

  if (newFileOrder === "page-first") {
    // ページ順: ページごとに全生徒
    for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        newIdealPositions.push({ studentIndex, pageIndex })
      }
    }
  } else {
    // 生徒順: 生徒ごとに全ページ
    for (
      let studentIndex = 0;
      studentIndex < sortedStudents.length;
      studentIndex++
    ) {
      for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
        newIdealPositions.push({ studentIndex, pageIndex })
      }
    }
  }

  // 4. 新しい順序に基づいてファイル配列を再構築
  const reorderedFiles: UnifiedFile[] = []

  newIdealPositions.forEach((idealPosition) => {
    const targetStudent = sortedStudents[idealPosition.studentIndex]
    const targetPageNumber = idealPosition.pageIndex + 1

    // 現在のファイル配列から対応するファイルを検索
    const matchingFile = actualFiles.find(
      (file) =>
        file.studentId === targetStudent.studentId &&
        file.pageNumber === targetPageNumber
    )

    if (matchingFile) {
      reorderedFiles.push(matchingFile)
    }
    // ファイルが見つからない場合は配列に追加しない（動的無効化で処理）
  })

  return reorderedFiles
}

/** 既存の答案データを配置戦略に基づく統一ファイル配列に変換する */
export function buildOrderedFileArrayFromStudentAnswers(
  studentAnswers: ProcessedStudentAnswer[],
  students: ExamStudentWithMemberships[],
  modelAnswerCount: number,
  fileOrder: PlacementStrategy
): UnifiedFile[] {
  // 基本的なファイル変換を実行
  const basicFiles: UnifiedFile[] = convertAnswerSheetsToFiles(studentAnswers)

  // 生徒のソート（受験生徒順：customOrder準拠）
  const sortedStudents = [...students].sort((studentA, studentB) => {
    const studentAOrder = studentA.customOrder ?? Number.MAX_SAFE_INTEGER
    const studentBOrder = studentB.customOrder ?? Number.MAX_SAFE_INTEGER
    return studentAOrder - studentBOrder
  })

  // 配置戦略に基づく理想的な位置順序を計算
  const idealPositions: Array<{ studentIndex: number; pageIndex: number }> = []

  if (fileOrder === "page-first") {
    // ページ順: ページごとに全生徒
    for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
      for (
        let studentIndex = 0;
        studentIndex < sortedStudents.length;
        studentIndex++
      ) {
        idealPositions.push({ studentIndex, pageIndex })
      }
    }
  } else {
    // 生徒順: 生徒ごとに全ページ
    for (
      let studentIndex = 0;
      studentIndex < sortedStudents.length;
      studentIndex++
    ) {
      for (let pageIndex = 0; pageIndex < modelAnswerCount; pageIndex++) {
        idealPositions.push({ studentIndex, pageIndex })
      }
    }
  }

  // 理想的な位置順序に基づいてファイル配列を構築
  const orderedFiles: UnifiedFile[] = []

  idealPositions.forEach((idealPosition) => {
    const targetStudent = sortedStudents[idealPosition.studentIndex]
    const targetPageNumber = idealPosition.pageIndex + 1

    // 対応するファイルをDBデータから検索
    const matchingFile = basicFiles.find(
      (file) =>
        file.studentId === targetStudent.studentId &&
        file.pageNumber === targetPageNumber
    )

    if (matchingFile) {
      orderedFiles.push(matchingFile)
    }
    // ファイルが見つからない場合は配列に追加しない（動的無効化で処理）
  })

  return orderedFiles
}
