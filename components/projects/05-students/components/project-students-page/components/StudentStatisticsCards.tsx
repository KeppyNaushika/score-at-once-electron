"use client"

import type { Student } from "@/components/projects/05-students/components/project-students-page/types/project-students-types"

interface StudentStatisticsCardsProps {
  students: Student[]
}

export function StudentStatisticsCards({
  students,
}: StudentStatisticsCardsProps) {
  const totalStudents = students.length
  const participatingStudents = students.filter(
    (s) => s.status === "participating",
  ).length
  const expectedStudents = students.filter(
    (s) => s.status === "expected",
  ).length
  const absentStudents = students.filter((s) => s.status === "absent").length

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">総生徒数</span>
        <span className="rounded-md bg-white px-3 text-lg font-bold text-gray-900 shadow-sm border">
          {totalStudents}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">受験者</span>
        <span className="rounded-md bg-green-100 px-3 text-lg font-bold text-green-700 border border-green-200">
          {participatingStudents}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">見込受験</span>
        <span className="rounded-md bg-blue-100 px-3 text-lg font-bold text-blue-700 border border-blue-200">
          {expectedStudents}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">欠席者</span>
        <span className="rounded-md bg-red-100 px-3 text-lg font-bold text-red-700 border border-red-200">
          {absentStudents}
        </span>
      </div>
    </div>
  )
}
