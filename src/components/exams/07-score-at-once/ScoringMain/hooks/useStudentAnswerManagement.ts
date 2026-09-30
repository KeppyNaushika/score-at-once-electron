/**
 * 生徒・答案管理ロジックフック
 *
 * ScoringMainViewから抽出された生徒データ管理と
 * 個別表示用のナビゲーション関数を提供
 */

import { useCallback, useEffect, useMemo } from "react"

import type {
  GradingMode,
  ScoringExamStudent,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

/**
 * useStudentAnswerManagementの入力パラメータ
 */
interface UseStudentAnswerManagementParams {
  /** ページ画像一覧 */
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  /** 選択中のページ画像ID集合 */
  selectedStudentAnswerImageIds: Set<string>
  /** 現在の採点モード */
  gradingMode: GradingMode
  /** 現在の採点領域（ナビゲーション用） */
  currentCropRegion: QuestionAnswerRegionRow | undefined
  /** 選択ページ画像IDを設定する関数 */
  setSelectedPageImageIds: (ids: Set<string>) => void
  /** 現在の生徒インデックスを設定する関数 */
}

/**
 * useStudentAnswerManagementの戻り値
 */
interface UseStudentAnswerManagementReturn {
  /** 受験者の一覧（受験者の並び順） */
  examStudents: ScoringExamStudent[]
  /** 生徒変更ハンドラー */
  handleStudentChange: (examStudentId: string) => void
  /** 次の生徒へ移動（個別表示用） */
  handleIndividualNextStudent: () => void
  /** 前の生徒へ移動（個別表示用） */
  handleIndividualPrevStudent: () => void
}

/**
 * 生徒・答案管理ロジックフック
 *
 * @param params - 生徒・答案管理に必要なパラメータ
 * @returns 生徒一覧とナビゲーション関数
 */
export function useStudentAnswerManagement(
  params: UseStudentAnswerManagementParams
): UseStudentAnswerManagementReturn {
  const {
    studentAnswerImages,
    selectedStudentAnswerImageIds,
    gradingMode,
    currentCropRegion,
    setSelectedPageImageIds,
  } = params

  /**
   * 個別表示用の受験者（答案に同梱された受験者を重複なく、受験者の並び順で）
   */
  const examStudents = useMemo(() => {
    const uniqueExamStudents = new Map<string, ScoringExamStudent>()
    studentAnswerImages.forEach((sheet) => {
      if (!uniqueExamStudents.has(sheet.examStudentId)) {
        uniqueExamStudents.set(sheet.examStudentId, sheet.examStudent)
      }
    })
    return Array.from(uniqueExamStudents.values()).sort(
      (examStudentA, examStudentB) =>
        (examStudentA.customOrder ?? 0) - (examStudentB.customOrder ?? 0)
    )
  }, [studentAnswerImages])

  /**
   * 個別表示用のナビゲーション関数
   */
  const handleStudentChange = useCallback(
    (examStudentId: string) => {
      const studentSheets = studentAnswerImages.filter(
        (sheet) => sheet.examStudentId === examStudentId
      )
      if (studentSheets.length > 0) {
        // 現在の設問ページに対応するpageImageを優先選択
        // currentCropRegionのexamPageIdと一致するものを探す
        const currentPageSheet = currentCropRegion
          ? studentSheets.find(
              (sheet) => sheet.examPageId === currentCropRegion.examPageId
            )
          : null

        const targetSheet = currentPageSheet || studentSheets[0]
        setSelectedPageImageIds(new Set([targetSheet.id]))
      }
    },
    [studentAnswerImages, setSelectedPageImageIds, currentCropRegion]
  )

  /**
   * 個別モードで最初の生徒を自動選択
   */
  useEffect(() => {
    if (
      gradingMode === "individual" &&
      examStudents.length > 0 &&
      selectedStudentAnswerImageIds.size === 0
    ) {
      handleStudentChange(examStudents[0].id)
    }
  }, [
    gradingMode,
    examStudents,
    selectedStudentAnswerImageIds.size,
    handleStudentChange,
  ])

  /**
   * 次の生徒へ移動（個別表示用）
   */
  const handleIndividualNextStudent = useCallback(() => {
    if (selectedStudentAnswerImageIds.size === 0) return

    const currentAnswerId = Array.from(selectedStudentAnswerImageIds)[0]
    const currentAnswer = studentAnswerImages.find(
      (sheet) => sheet.id === currentAnswerId
    )
    if (!currentAnswer) return

    const currentIndex = examStudents.findIndex(
      (examStudent) => examStudent.id === currentAnswer.examStudentId
    )
    if (currentIndex < examStudents.length - 1) {
      const nextExamStudent = examStudents[currentIndex + 1]
      // 現在の設問ページに対応するpageImageを優先選択
      const nextStudentSheets = studentAnswerImages.filter(
        (sheet) => sheet.examStudentId === nextExamStudent.id
      )
      const nextStudentAnswer = currentCropRegion
        ? nextStudentSheets.find(
            (sheet) => sheet.examPageId === currentCropRegion.examPageId
          ) || nextStudentSheets[0]
        : nextStudentSheets[0]
      if (nextStudentAnswer) {
        setSelectedPageImageIds(new Set([nextStudentAnswer.id]))
      }
    }
  }, [
    examStudents,
    selectedStudentAnswerImageIds,
    studentAnswerImages,
    setSelectedPageImageIds,
    currentCropRegion,
  ])

  /**
   * 前の生徒へ移動（個別表示用）
   */
  const handleIndividualPrevStudent = useCallback(() => {
    if (selectedStudentAnswerImageIds.size === 0) return

    const currentAnswerId = Array.from(selectedStudentAnswerImageIds)[0]
    const currentAnswer = studentAnswerImages.find(
      (sheet) => sheet.id === currentAnswerId
    )
    if (!currentAnswer) return

    const currentIndex = examStudents.findIndex(
      (examStudent) => examStudent.id === currentAnswer.examStudentId
    )
    if (currentIndex > 0) {
      const prevExamStudent = examStudents[currentIndex - 1]
      const prevStudentSheets = studentAnswerImages.filter(
        (sheet) => sheet.examStudentId === prevExamStudent.id
      )
      const prevStudentAnswer = currentCropRegion
        ? prevStudentSheets.find(
            (sheet) => sheet.examPageId === currentCropRegion.examPageId
          ) || prevStudentSheets[0]
        : prevStudentSheets[0]
      if (prevStudentAnswer) {
        setSelectedPageImageIds(new Set([prevStudentAnswer.id]))
      }
    }
  }, [
    examStudents,
    selectedStudentAnswerImageIds,
    studentAnswerImages,
    setSelectedPageImageIds,
    currentCropRegion,
  ])

  return {
    examStudents,
    handleStudentChange,
    handleIndividualNextStudent,
    handleIndividualPrevStudent,
  }
}
