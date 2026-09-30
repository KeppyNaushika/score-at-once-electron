"use client"

import { useMemo } from "react"

import type {
  ScoringBehavior,
  ScoringExamStudent,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"

import { ScoringBehaviorSelector } from "./ScoringBehaviorSelector"
import { StudentAnswerPanel } from "./StudentAnswerPanel"

interface IndividualModePanelProps {
  examStudents: ScoringExamStudent[]
  selectedAnswers?: Set<string> // TODO: selectedPageImageIdsに統一予定
  studentAnswerImages?: StudentAnswerImageWithExamStudents[]
  onStudentChange: (examStudentId: string) => void
  scoringBehavior: ScoringBehavior
  onScoringBehaviorChange: (behavior: ScoringBehavior) => void
}

export function IndividualModePanel({
  examStudents,
  selectedAnswers,
  studentAnswerImages,
  onStudentChange,
  scoringBehavior,
  onScoringBehaviorChange,
}: IndividualModePanelProps) {
  // selectedAnswersから現在の生徒IDを取得
  const currentExamStudentId = useMemo(() => {
    if (selectedAnswers && selectedAnswers.size > 0) {
      const selectedAnswerId = Array.from(selectedAnswers)[0]
      const selectedAnswer = studentAnswerImages?.find(
        (studentAnswerImage) => studentAnswerImage.id === selectedAnswerId
      )
      return selectedAnswer?.examStudentId || ""
    }
    return ""
  }, [selectedAnswers, studentAnswerImages])
  return (
    <>
      <StudentAnswerPanel
        examStudents={examStudents}
        currentExamStudentId={currentExamStudentId}
        onStudentChange={onStudentChange}
      />

      <ScoringBehaviorSelector
        behavior={scoringBehavior}
        onBehaviorChange={onScoringBehaviorChange}
      />
    </>
  )
}
