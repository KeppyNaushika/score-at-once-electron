"use client"

import type { StudentAnswerImageWithProjectStudents } from "@/components/projects/07-score-at-once/types"
import { useMemo } from "react"
import {
  ScoringBehaviorSelector,
  type ScoringBehavior,
} from "./ScoringBehaviorSelector"
import { StudentAnswerPanel } from "./StudentAnswerPanel"

interface Student {
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  customOrder: number
}

interface IndividualModePanelProps {
  students: Student[]
  selectedAnswers?: Set<string> // TODO: selectedPageImageIdsに統一予定
  studentAnswerImages?: StudentAnswerImageWithProjectStudents[]
  onStudentChange: (studentId: string) => void
  scoringBehavior: ScoringBehavior
  onScoringBehaviorChange: (behavior: ScoringBehavior) => void
}

export function IndividualModePanel({
  students,
  selectedAnswers,
  studentAnswerImages,
  onStudentChange,
  scoringBehavior,
  onScoringBehaviorChange,
}: IndividualModePanelProps) {
  // selectedAnswersから現在の生徒IDを取得
  const currentStudentId = useMemo(() => {
    if (selectedAnswers && selectedAnswers.size > 0) {
      const selectedAnswerId = Array.from(selectedAnswers)[0]
      const selectedAnswer = studentAnswerImages?.find(
        (a) => a.id === selectedAnswerId
      )
      return selectedAnswer?.student?.id || ""
    }
    return ""
  }, [selectedAnswers, studentAnswerImages])
  return (
    <>
      <StudentAnswerPanel
        students={students}
        currentStudentId={currentStudentId}
        onStudentChange={onStudentChange}
      />

      <ScoringBehaviorSelector
        behavior={scoringBehavior}
        onBehaviorChange={onScoringBehaviorChange}
      />
    </>
  )
}
