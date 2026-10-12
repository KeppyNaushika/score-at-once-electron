import { useMemo, useState } from "react"

import { useScoringAnonymity } from "@/components/exams/07-score-at-once/anonymity/ScoringAnonymityContext"
import { useAssignedCropRegions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAssignedCropRegions"
import type { AssignmentScope } from "@/components/exams/07-score-at-once/ScoringSidePanel/AssignmentScopeNotice"
import { useAssignedExamStudents } from "@/components/exams/shared/useAssignedExamStudents"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { StudentAnswerImageWithExamPageAndStudent } from "@/types/prismaExtensions"

interface UseScoringScopeOptions {
  examId: string
  userId: string
  /** 読み込んだままの答案（担当でも匿名でもまだ手を入れていない） */
  loadedStudentAnswerImages: StudentAnswerImageWithExamPageAndStudent[]
  cropRegions: QuestionAnswerRegionRow[]
}

/**
 * 採点画面（07）が扱う範囲を決める。採点担当による答案・設問の絞り込みと、
 * 匿名採点による名前・並びの置き換えをここで済ませ、絞った答案と選べる設問を返す。
 */
export function useScoringScope({
  examId,
  userId,
  loadedStudentAnswerImages,
  cropRegions,
}: UseScoringScopeOptions) {
  /** 採点担当の「すべて表示」。画面にいる間だけの切り替えで、憶えない */
  const [showAllAssignments, setShowAllAssignments] = useState(false)

  /**
   * 受験生徒の担当による答案の絞り込み。**ここから先は絞った答案だけを扱う**
   * （一覧・個別・選択・前後移動・進み具合のどれも、自分の担当の生徒の答案になる）。
   */
  const { isVisibleExamStudent, isAssignedToMe } = useAssignedExamStudents({
    examId,
    userId,
    showAll: showAllAssignments,
  })
  /**
   * 匿名採点（docs/scoring-scope-and-permissions-design.md §3-5）。名前を仮の名前に、
   * 並び（customOrder）を名簿と関係ない順に置き換えた答案を、ここから先へ渡す。
   * 一覧・個別・AI採点のどれも名前と並びをこの行から取るので、ここ1か所で効く。
   * 書き込みは id で行うので、置き換えた名前や並びが DB へ戻ることはない
   */
  const { isAnonymous, isEnforcedForMe, pseudonymOf, anonymousOrderOf } =
    useScoringAnonymity()
  const studentAnswerImages = useMemo(() => {
    const assignedAnswerImages = loadedStudentAnswerImages.filter(
      (answerImage) => isVisibleExamStudent(answerImage.examStudentId)
    )
    if (!isAnonymous) return assignedAnswerImages
    return assignedAnswerImages.map((answerImage) => ({
      ...answerImage,
      examStudent: {
        ...answerImage.examStudent,
        customOrder: anonymousOrderOf(answerImage.examStudentId),
        student: {
          ...answerImage.examStudent.student,
          studentNumber: "",
          lastName: pseudonymOf(answerImage.examStudentId),
          firstName: "",
          lastNameKana: "",
          firstNameKana: "",
        },
      },
    }))
  }, [
    loadedStudentAnswerImages,
    isVisibleExamStudent,
    isAnonymous,
    pseudonymOf,
    anonymousOrderOf,
  ])

  /**
   * 採点担当による設問の絞り込み。
   * 自動選択・前後移動・設問ナビゲーターの選択肢だけをこの集合に置き換える
   * （描画やスコア引き当ては全設問を見る必要があるため差し替えない）。
   */
  const {
    selectableCropRegions,
    memberCount,
    canDecideScores,
    isFiltered: isQuestionSetFiltered,
    assignedCropRegionCount,
  } = useAssignedCropRegions({
    examId,
    userId,
    cropRegions,
    showAll: showAllAssignments,
  })

  /** 担当の範囲と「すべて表示」（サイドパネルが知らせる） */
  const assignmentScope = useMemo<AssignmentScope>(() => {
    const examStudentIds = new Set(
      loadedStudentAnswerImages.map((answerImage) => answerImage.examStudentId)
    )
    return {
      showAll: showAllAssignments,
      onShowAllChange: setShowAllAssignments,
      questions: {
        assigned: assignedCropRegionCount,
        total: cropRegions.length,
      },
      students: {
        assigned: [...examStudentIds].filter(isAssignedToMe).length,
        total: examStudentIds.size,
      },
    }
  }, [
    loadedStudentAnswerImages,
    showAllAssignments,
    assignedCropRegionCount,
    cropRegions.length,
    isAssignedToMe,
  ])

  return {
    studentAnswerImages,
    isEnforcedForMe,
    selectableCropRegions,
    memberCount,
    canDecideScores,
    isQuestionSetFiltered,
    assignmentScope,
  }
}
