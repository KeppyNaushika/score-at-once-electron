"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  BarChart3,
  ChevronRight,
  Info,
} from "lucide-react"
import Link from "next/link"

interface AdditionalActionsProps {
  projectId: string
  masterImageCount: number
  layoutRegionCount: number
  questionRegionCount: number
  studentCount: number
  answerSheetCount: number
}

export default function AdditionalActions({
  projectId,
  masterImageCount,
  layoutRegionCount,
  questionRegionCount,
  studentCount,
  answerSheetCount,
}: AdditionalActionsProps) {
  const getNextStepMessage = () => {
    if (masterImageCount === 0) return "まず模範解答をアップロードしてください"
    if (masterImageCount > 0 && layoutRegionCount === 0) return "採点領域を作成してください"
    if (layoutRegionCount > 0 && questionRegionCount === 0) return "領域情報を編集してください"
    if (questionRegionCount > 0 && studentCount === 0) return "受験生徒を登録してください"
    if (studentCount > 0 && answerSheetCount === 0) return "答案をアップロードしてください"
    if (answerSheetCount > 0 && questionRegionCount > 0) return "採点を開始できます"
    return ""
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>追加機能</CardTitle>
        <CardDescription>結果出力とプロジェクト管理</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 結果出力（未実装） */}
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled={true}
        >
          <span className="flex items-center opacity-50">
            <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
              7
            </span>
            <BarChart3 className="mr-2 h-4 w-4" />
            結果分析・出力
          </span>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* 設定アクセス */}
        <Link href={`/projects/${projectId}/01-upload`}>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center">
              <Info className="mr-2 h-4 w-4" />
              プロジェクト設定を開く
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>

        {/* 次のステップガイド */}
        <div className="mt-4 rounded-lg bg-muted/50 p-4">
          <h4 className="font-medium text-sm mb-2">次に進むべきステップ</h4>
          <p className="text-muted-foreground text-xs">
            {getNextStepMessage()}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}