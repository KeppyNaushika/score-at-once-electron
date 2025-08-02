"use client"

import { StudentAnswerPanel } from "./StudentAnswerPanel"
import { ScoringBehaviorSelector, type ScoringBehavior } from "./ScoringBehaviorSelector"

interface Student {
  id: string
  studentId: string
  lastName: string
  firstName: string
  customOrder: number
}

interface IndividualModePanelProps {
  students: Student[]
  currentStudentId: string
  onStudentChange: (studentId: string) => void
  scoringBehavior: ScoringBehavior
  onScoringBehaviorChange: (behavior: ScoringBehavior) => void
}

export function IndividualModePanel({
  students,
  currentStudentId,
  onStudentChange,
  scoringBehavior,
  onScoringBehaviorChange,
}: IndividualModePanelProps) {
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