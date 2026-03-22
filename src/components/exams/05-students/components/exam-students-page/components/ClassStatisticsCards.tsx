"use client"

import type { ExamClassWithClass } from "@/types/electron.d"

interface ClassStatisticsCardsProps {
  examClasses: ExamClassWithClass[]
}

export function ClassStatisticsCards({
  examClasses,
}: ClassStatisticsCardsProps) {
  const totalClasses = examClasses.length
  const administeredClasses = examClasses.filter((pc) => pc.administered).length
  const statisticsClasses = examClasses.filter((pc) => pc.statistics).length

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">総学級数</span>
        <span className="rounded-md border bg-white px-3 text-lg font-bold text-gray-900 shadow-sm">
          {totalClasses}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">学級表示</span>
        <span className="rounded-md border border-green-200 bg-green-100 px-3 text-lg font-bold text-green-700">
          {administeredClasses}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">統計集計</span>
        <span className="rounded-md border border-blue-200 bg-blue-100 px-3 text-lg font-bold text-blue-700">
          {statisticsClasses}
        </span>
      </div>
    </div>
  )
}
