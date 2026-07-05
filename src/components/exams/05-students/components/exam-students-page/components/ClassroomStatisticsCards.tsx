"use client"

import type { ExamClassroomWithMemberships } from "@/types/electron/examClassroomApi"

interface ClassroomStatisticsCardsProps {
  examClassrooms: ExamClassroomWithMemberships[]
}

export function ClassroomStatisticsCards({
  examClassrooms,
}: ClassroomStatisticsCardsProps) {
  const totalClasses = examClassrooms.length
  const administeredClasses = examClassrooms.filter(
    (examClassroom) => examClassroom.administered
  ).length
  const teacherStatisticsClasses = examClassrooms.filter(
    (examClassroom) => examClassroom.teacherStatistics
  ).length

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">総学級数</span>
        <span className="rounded-md border bg-white px-3 text-lg font-bold text-gray-900 shadow-sm">
          {totalClasses}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">再採番</span>
        <span className="rounded-md border border-green-200 bg-green-100 px-3 text-lg font-bold text-green-700">
          {administeredClasses}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">教員集計</span>
        <span className="rounded-md border border-blue-200 bg-blue-100 px-3 text-lg font-bold text-blue-700">
          {teacherStatisticsClasses}
        </span>
      </div>
    </div>
  )
}
