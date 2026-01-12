/**
 * 生徒・答案管理ロジックフック
 *
 * ScoringMainViewから抽出された生徒データ管理と
 * 個別表示用のナビゲーション関数を提供
 */

import { useCallback, useEffect, useMemo } from "react"

import type {
  CropRegionWithProjectPage,
  GradingMode,
  StudentAnswerImageWithProjectStudents,
} from "@/components/projects/07-score-at-once/types"

/**
 * 生徒データの型定義（UIコンポーネント用）
 */
export interface StudentData {
  /** 生徒ID (UUID) */
  id: string
  /** 学籍番号 */
  studentNumber: string
  /** 姓 */
  lastName: string
  /** 名 */
  firstName: string
  /** カスタム順序 */
  customOrder: number
}

/**
 * useStudentAnswerManagementの入力パラメータ
 */
interface UseStudentAnswerManagementParams {
  /** ページ画像一覧 */
  studentAnswerImages: StudentAnswerImageWithProjectStudents[]
  /** 選択中のページ画像ID集合 */
  selectedStudentAnswerImageIds: Set<string>
  /** 現在の採点モード */
  gradingMode: GradingMode
  /** 現在の採点領域（ナビゲーション用） */
  currentCropRegion: CropRegionWithProjectPage | undefined
  /** 選択ページ画像IDを設定する関数 */
  setSelectedPageImageIds: (ids: Set<string>) => void
  /** 現在の生徒インデックスを設定する関数 */
  setCurrentStudentIndex: (index: number) => void
}

/**
 * useStudentAnswerManagementの戻り値
 */
interface UseStudentAnswerManagementReturn {
  /** 生徒一覧（ソート済み） */
  students: StudentData[]
  /** 生徒変更ハンドラー */
  handleStudentChange: (studentId: string) => void
  /** 次の生徒へ移動（個別表示用） */
  handleIndividualNextStudent: () => void
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
    setCurrentStudentIndex,
  } = params

  /**
   * 個別表示用の生徒データ（studentAnswerImagesから抽出、useMemoで安定化）
   */
  const students = useMemo(() => {
    if (!studentAnswerImages || studentAnswerImages.length === 0) return []

    const uniqueStudents = new Map<string, StudentData>()

    studentAnswerImages.forEach((sheet) => {
      if (sheet.student && !uniqueStudents.has(sheet.student.id)) {
        const studentData: StudentData = {
          id: sheet.student.id,
          studentNumber: sheet.student.studentNumber,
          lastName: sheet.student.lastName,
          firstName: sheet.student.firstName,
          customOrder: sheet.student.projectStudents?.[0]?.customOrder || 0,
        }
        uniqueStudents.set(sheet.student.id, studentData)
      }
    })

    const sortedStudents = Array.from(uniqueStudents.values()).sort(
      (a, b) => a.customOrder - b.customOrder
    )
    return sortedStudents
  }, [studentAnswerImages])

  /**
   * 個別表示用のナビゲーション関数
   */
  const handleStudentChange = useCallback(
    (studentId: string) => {
      const studentSheets = studentAnswerImages.filter(
        (sheet) => sheet.student?.id === studentId
      )
      if (studentSheets.length > 0) {
        // 現在の設問ページに対応するpageImageを優先選択
        // currentCropRegionのprojectPageIdと一致するものを探す
        const currentPageSheet = currentCropRegion
          ? studentSheets.find(
              (sheet) => sheet.projectPageId === currentCropRegion.projectPageId
            )
          : null

        const targetSheet = currentPageSheet || studentSheets[0]
        setSelectedPageImageIds(new Set([targetSheet.id]))

        const studentIndex = studentAnswerImages.findIndex(
          (sheet) => sheet.id === targetSheet.id
        )
        if (studentIndex !== -1) {
          setCurrentStudentIndex(studentIndex)
        }
      }
    },
    [
      studentAnswerImages,
      setSelectedPageImageIds,
      setCurrentStudentIndex,
      currentCropRegion,
    ]
  )

  /**
   * 個別モードで最初の生徒を自動選択
   */
  useEffect(() => {
    if (
      gradingMode === "individual" &&
      students.length > 0 &&
      selectedStudentAnswerImageIds.size === 0
    ) {
      const sortedStudents = [...students].sort(
        (a, b) => a.customOrder - b.customOrder
      )
      handleStudentChange(sortedStudents[0].id)
    }
  }, [
    gradingMode,
    students,
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
      (a) => a.id === currentAnswerId
    )
    if (!currentAnswer) return

    const sortedStudents = [...students].sort(
      (a, b) => a.customOrder - b.customOrder
    )
    const currentIndex = sortedStudents.findIndex(
      (s) => s.id === currentAnswer.student?.id
    )
    if (currentIndex < sortedStudents.length - 1) {
      const nextStudent = sortedStudents[currentIndex + 1]
      // 現在の設問ページに対応するpageImageを優先選択
      const nextStudentSheets = studentAnswerImages.filter(
        (a) => a.student?.id === nextStudent.id
      )
      const nextStudentAnswer = currentCropRegion
        ? nextStudentSheets.find(
            (a) => a.projectPageId === currentCropRegion.projectPageId
          ) || nextStudentSheets[0]
        : nextStudentSheets[0]
      if (nextStudentAnswer) {
        setSelectedPageImageIds(new Set([nextStudentAnswer.id]))
      }
    }
  }, [
    students,
    selectedStudentAnswerImageIds,
    studentAnswerImages,
    setSelectedPageImageIds,
    currentCropRegion,
  ])

  return {
    students,
    handleStudentChange,
    handleIndividualNextStudent,
  }
}
