import { useCallback, useMemo } from "react"

import type {
  GradingMode,
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"

import { findNextAnswerIdAfterScoring } from "../utils/nextAnswerAfterScoring"

interface UseRubricAnswerFlowOptions {
  gradingMode: GradingMode
  studentAnswerImages: readonly StudentAnswerImageWithExamStudents[]
  selectedStudentAnswerImageIds: ReadonlySet<string>
  setSelectedPageImageIds: (answerIds: Set<string>) => void
  setRecentlyScoredAnswers: (update: (prev: Set<string>) => Set<string>) => void
  /** 一覧の今の並び（書き込む前のもの） */
  getGridAnswerData: () => readonly Pick<ScoringData, "id">[]
  handleIndividualNextStudent: () => void
}

/**
 * ルーブリック項目のパネル（`RubricPanel`）と採点画面の選択をつなぐ。
 *
 * - 選んでいる答案を受験者で渡す（項目は受験者×設問の採点行に当たる）
 * - 項目を当てた答案を「いま採点した」にする（絞り込みから急に消えないように。採点キーと同じ）
 * - 選択の場面の Enter で次の答案へ進む（一覧表示は採点した後と同じ規則、個別表示は次の生徒）
 */
export function useRubricAnswerFlow({
  gradingMode,
  studentAnswerImages,
  selectedStudentAnswerImageIds,
  setSelectedPageImageIds,
  setRecentlyScoredAnswers,
  getGridAnswerData,
  handleIndividualNextStudent,
}: UseRubricAnswerFlowOptions) {
  const selectedExamStudentIds = useMemo(
    () =>
      studentAnswerImages
        .filter((answerImage) =>
          selectedStudentAnswerImageIds.has(answerImage.id)
        )
        .map((answerImage) => answerImage.examStudentId),
    [studentAnswerImages, selectedStudentAnswerImageIds]
  )

  const markExamStudentsScored = useCallback(
    (examStudentIds: string[]) => {
      const scoredExamStudentIds = new Set(examStudentIds)
      const answerIds = studentAnswerImages
        .filter((answerImage) =>
          scoredExamStudentIds.has(answerImage.examStudentId)
        )
        .map((answerImage) => answerImage.id)
      setRecentlyScoredAnswers((prev) => new Set([...prev, ...answerIds]))
    },
    [studentAnswerImages, setRecentlyScoredAnswers]
  )

  const advanceToNextAnswer = useCallback(() => {
    if (gradingMode === "individual") {
      handleIndividualNextStudent()
      return
    }
    const nextAnswerId = findNextAnswerIdAfterScoring(
      getGridAnswerData().map((answer) => answer.id),
      selectedStudentAnswerImageIds
    )
    if (nextAnswerId) setSelectedPageImageIds(new Set([nextAnswerId]))
  }, [
    gradingMode,
    handleIndividualNextStudent,
    getGridAnswerData,
    selectedStudentAnswerImageIds,
    setSelectedPageImageIds,
  ])

  return { selectedExamStudentIds, markExamStudentsScored, advanceToNextAnswer }
}
