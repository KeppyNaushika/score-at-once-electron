"use client"

import type { Student } from "@/components/exams/05-students/components/exam-students-page/types/examStudentsTypes"

interface StudentStatisticsCardsProps {
  students: Student[]
}

export function StudentStatisticsCards({
  students,
}: StudentStatisticsCardsProps) {
  const totalStudents = students.length
  const participatingStudents = students.filter(
    (s) => s.status === "participating"
  ).length
  const expectedStudents = students.filter(
    (s) => s.status === "expected"
  ).length
  const absentStudents = students.filter((s) => s.status === "absent").length

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">総生徒数</span>
        <span className="rounded-md border bg-white px-3 text-lg font-bold text-gray-900 shadow-sm">
          {totalStudents}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">受験者</span>
        <span className="rounded-md border border-green-200 bg-green-100 px-3 text-lg font-bold text-green-700">
          {participatingStudents}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">見込受験</span>
        <span className="rounded-md border border-blue-200 bg-blue-100 px-3 text-lg font-bold text-blue-700">
          {expectedStudents}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">欠席者</span>
        <span className="rounded-md border border-red-200 bg-red-100 px-3 text-lg font-bold text-red-700">
          {absentStudents}
        </span>
      </div>
    </div>
  )
}
