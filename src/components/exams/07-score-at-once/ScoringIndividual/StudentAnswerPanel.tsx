"use client"

import { Users } from "lucide-react"
import { useMemo } from "react"

import { Combobox } from "@/components/common/Combobox"
import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import type { ScoringExamStudent } from "@/components/exams/07-score-at-once/types"
import { Button } from "@/components/ui/button"

interface StudentAnswerPanelProps {
  /** 受験者の一覧（受験者の並び順に並べ済み） */
  examStudents: ScoringExamStudent[]
  currentExamStudentId: string
  onStudentChange: (studentId: string) => void
}

export function StudentAnswerPanel({
  examStudents,
  currentExamStudentId,
  onStudentChange,
}: StudentAnswerPanelProps) {
  // 氏名・番号に加えて、読み（カナ）でも探せるようにする
  const examStudentOptions = useMemo(
    () =>
      examStudents.map(({ id, student }) => ({
        value: id,
        label: `${student.lastName} ${student.firstName} (${student.studentNumber})`,
        keywords: [
          student.studentNumber,
          `${student.lastNameKana} ${student.firstNameKana}`,
        ],
      })),
    [examStudents]
  )

  const handlePrevStudent = () => {
    const currentIndex = examStudents.findIndex(
      (examStudent) => examStudent.id === currentExamStudentId
    )
    if (currentIndex > 0) {
      onStudentChange(examStudents[currentIndex - 1].id)
    }
  }

  const handleNextStudent = () => {
    const currentIndex = examStudents.findIndex(
      (examStudent) => examStudent.id === currentExamStudentId
    )
    if (currentIndex < examStudents.length - 1) {
      onStudentChange(examStudents[currentIndex + 1].id)
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
            examStudents.findIndex(
              (examStudent) => examStudent.id === currentExamStudentId
            ) === 0
          }
        >
          ←
        </Button>
        <Combobox
          options={examStudentOptions}
          value={currentExamStudentId}
          onValueChange={onStudentChange}
          placeholder="生徒を選択"
          searchPlaceholder="氏名・番号で検索"
          emptyText="該当する生徒がいません"
          className="min-w-0 flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextStudent}
          disabled={
            examStudents.findIndex(
              (examStudent) => examStudent.id === currentExamStudentId
            ) ===
            examStudents.length - 1
          }
        >
          →
        </Button>
      </div>

      {/* 現在の位置表示 */}
      <div className="text-center text-xs text-gray-500">
        {examStudents.findIndex(
          (examStudent) => examStudent.id === currentExamStudentId
        ) + 1}{" "}
        / {examStudents.length}
      </div>
    </SidePanelSection>
  )
}
