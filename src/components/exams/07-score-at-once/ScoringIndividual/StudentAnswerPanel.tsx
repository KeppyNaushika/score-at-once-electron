"use client"

import { Users } from "lucide-react"

import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Student {
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  customOrder: number
}

interface StudentAnswerPanelProps {
  students: Student[]
  currentExamStudentId: string
  onStudentChange: (studentId: string) => void
}

export function StudentAnswerPanel({
  students,
  currentExamStudentId,
  onStudentChange,
}: StudentAnswerPanelProps) {
  // 受験生徒順にソート
  const sortedStudents = [...students].sort(
    (studentA, studentB) => studentA.customOrder - studentB.customOrder
  )
  const currentStudent = sortedStudents.find(
    (student) => student.id === currentExamStudentId
  )

  const handlePrevStudent = () => {
    const currentIndex = sortedStudents.findIndex(
      (student) => student.id === currentExamStudentId
    )
    if (currentIndex > 0) {
      onStudentChange(sortedStudents[currentIndex - 1].id)
    }
  }

  const handleNextStudent = () => {
    const currentIndex = sortedStudents.findIndex(
      (student) => student.id === currentExamStudentId
    )
    if (currentIndex < sortedStudents.length - 1) {
      onStudentChange(sortedStudents[currentIndex + 1].id)
    }
  }

  return (
    <SidePanelSection icon={Users} title="生徒答案">
      {/* ナビゲーションコントロール */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevStudent}
          disabled={
            sortedStudents.findIndex(
              (student) => student.id === currentExamStudentId
            ) === 0
          }
        >
          ←
        </Button>
        <Select value={currentExamStudentId} onValueChange={onStudentChange}>
          <SelectTrigger className="flex-1">
            <SelectValue>
              {currentStudent
                ? `${currentStudent.lastName} ${currentStudent.firstName} (${currentStudent.studentNumber})`
                : "生徒を選択"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sortedStudents.map((student) => (
              <SelectItem key={student.id} value={student.id}>
                {student.lastName} {student.firstName} ({student.studentNumber})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextStudent}
          disabled={
            sortedStudents.findIndex(
              (student) => student.id === currentExamStudentId
            ) ===
            sortedStudents.length - 1
          }
        >
          →
        </Button>
      </div>

      {/* 現在の位置表示 */}
      <div className="text-center text-xs text-gray-500">
        {sortedStudents.findIndex(
          (student) => student.id === currentExamStudentId
        ) + 1}{" "}
        / {sortedStudents.length}
      </div>
    </SidePanelSection>
  )
}
