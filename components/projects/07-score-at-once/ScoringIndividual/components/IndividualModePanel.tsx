"use client"

import { StudentAnswerPanel } from "./StudentAnswerPanel"
import { ScoringBehaviorSelector, type ScoringBehavior } from "./ScoringBehaviorSelector"
import { useMemo } from "react"

interface Student {
  id: string
  studentId: string
  lastName: string
  firstName: string
  customOrder: number
}

interface IndividualModePanelProps {
  students: Student[]
  selectedAnswers?: Set<string>
  allAnswerSheets?: any[]
  onStudentChange: (studentId: string) => void
  scoringBehavior: ScoringBehavior
  onScoringBehaviorChange: (behavior: ScoringBehavior) => void
}

export function IndividualModePanel({
  students,
  selectedAnswers,
  allAnswerSheets,
  onStudentChange,
  scoringBehavior,
  onScoringBehaviorChange,
}: IndividualModePanelProps) {
  // selectedAnswersから現在の生徒IDを取得
  const currentStudentId = useMemo(() => {
    if (selectedAnswers && selectedAnswers.size > 0) {
      const selectedAnswerId = Array.from(selectedAnswers)[0]
      const selectedAnswer = allAnswerSheets?.find((a: any) => a.id === selectedAnswerId)
      return selectedAnswer?.student?.id || ""
    }
    return ""
  }, [selectedAnswers, allAnswerSheets])
  return (
    <div className="w-80 bg-gray-50 border-l p-4 space-y-4">
      <StudentAnswerPanel
        students={students}
        currentStudentId={currentStudentId}
        onStudentChange={onStudentChange}
      />
      
      <ScoringBehaviorSelector
        behavior={scoringBehavior}
        onBehaviorChange={onScoringBehaviorChange}
      />
    </div>
  )
}