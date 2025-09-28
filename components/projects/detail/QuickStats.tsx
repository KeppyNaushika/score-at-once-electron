"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WorkflowStats } from "@/types/workflow.types"
import { Edit, FileImage, Settings, Upload, Users } from "lucide-react"

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

  const statItems = [
    {
      title: "模範解答",
      value: masterImageCount,
      unit: "ページ",
      icon: FileImage,
      color: "blue",
      description: masterImageCount > 0 ? "アップロード済み" : "未アップロード",
    },
    {
      title: "採点領域",
      value: cropRegionCount,
      unit: "領域",
      icon: Settings,
      color: "green",
      description: cropRegionCount > 0 ? "定義済み" : "未設定",
    },
    {
      title: "設問領域",
      value: questionRegionCount,
      unit: "設問",
      icon: Edit,
      color: "indigo",
      description: questionRegionCount > 0 ? "設定済み" : "未設定",
    },
    {
      title: "受験生徒",
      value: studentCount,
      unit: "名",
      icon: Users,
      color: "purple",
      description: studentCount > 0 ? "登録済み" : "未登録",
    },
    {
      title: "答案",
      value: answerSheetCount,
      unit: "件",
      icon: Upload,
      color: "orange",
      description: answerSheetCount > 0 ? "アップロード済み" : "未アップロード",
    },
  ]

  const getColorClasses = (color: string) => {
    const colors: Record<string, { icon: string; text: string }> = {
      blue: { icon: "text-blue-500", text: "text-blue-600" },
      green: { icon: "text-green-500", text: "text-green-600" },
      indigo: { icon: "text-indigo-500", text: "text-indigo-600" },
      purple: { icon: "text-purple-500", text: "text-purple-600" },
      orange: { icon: "text-orange-500", text: "text-orange-600" },
    }
    return colors[color] || colors.blue
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {statItems.map((item) => {
        const colorClasses = getColorClasses(item.color)
        const IconComponent = item.icon

        return (
          <Card key={item.title} className="transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-sm">
                <IconComponent className={`mr-2 h-4 w-4 ${colorClasses.icon}`} />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${colorClasses.text}`}>
                  {item.value}
                </span>
                <span className="text-sm text-gray-500">{item.unit}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{item.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}