"use client"

import type { WorkflowStats } from "@/components/projects/detail/types"

interface QuickStatsProps {
  stats: WorkflowStats
}

export default function QuickStats({ stats }: QuickStatsProps) {
  const {
    masterImageCount,
    cropRegionCount,
    questionRegionCount,
    studentCount,
    answerSheetCount,
  } = stats

  const getStatusBg = (value: number, type: string) => {
    const colorMap = {
      master: value > 0 ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200",
      crop: value > 0 ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200",
      question: value > 0 ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-gray-100 text-gray-600 border-gray-200",
      student: value > 0 ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-gray-100 text-gray-600 border-gray-200",
      answer: value > 0 ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-gray-100 text-gray-600 border-gray-200",
    }
    return colorMap[type as keyof typeof colorMap] || colorMap.master
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">模範解答</span>
        <span className={`rounded-md px-3 text-lg font-bold border ${getStatusBg(masterImageCount, 'master')}`}>
          {masterImageCount}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">採点領域</span>
        <span className={`rounded-md px-3 text-lg font-bold border ${getStatusBg(cropRegionCount, 'crop')}`}>
          {cropRegionCount}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">設問領域</span>
        <span className={`rounded-md px-3 text-lg font-bold border ${getStatusBg(questionRegionCount, 'question')}`}>
          {questionRegionCount}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">受験生徒</span>
        <span className={`rounded-md px-3 text-lg font-bold border ${getStatusBg(studentCount, 'student')}`}>
          {studentCount}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">答案</span>
        <span className={`rounded-md px-3 text-lg font-bold border ${getStatusBg(answerSheetCount, 'answer')}`}>
          {answerSheetCount}
        </span>
      </div>
    </div>
  )
}