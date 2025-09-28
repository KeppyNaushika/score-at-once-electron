"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectWorkflowData } from "@/types/workflow.types"
import { ArrowRight, CheckCircle } from "lucide-react"
import Link from "next/link"

interface NextStepsProps {
  workflowData: ProjectWorkflowData
  projectId: string
}

export default function NextSteps({ workflowData, projectId }: NextStepsProps) {
  const { nextAction, phases, currentPhase } = workflowData

  // 全て完了している場合
  const allPhasesCompleted = phases.every((phase) => phase.isCompleted)

  if (allPhasesCompleted) {
    return (
      <Card className="border-green-300 bg-green-50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            プロジェクト完了
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-700 mb-4">
            すべてのフェーズが完了しました。採点結果を確認・出力できます。
          </p>
          <div className="flex gap-3">
            <Link href={`/projects/${projectId}/07-score-at-once`}>
              <Button variant="outline" size="sm">
                採点結果を確認
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/08-export`}>
              <Button size="sm">結果を出力</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 次のアクションがある場合
  if (nextAction) {
    return (
      <Card className="border-blue-300 bg-blue-50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <ArrowRight className="h-5 w-5" />
            次のステップ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              {nextAction.title}
            </h3>
            <p className="text-blue-700 text-sm">{nextAction.description}</p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-xs text-blue-600">
              現在: Phase {currentPhase} 実行中
            </div>
            <Link href={`/projects/${projectId}${nextAction.path}`}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                {nextAction.buttonText}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // フォールバック: 次のアクションが不明な場合
  return (
    <Card className="border-gray-300 bg-gray-50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-gray-700">
          <ArrowRight className="h-5 w-5" />
          ステータス
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700 text-sm mb-4">
          Phase {currentPhase} の作業を継続してください。
        </p>
        <div className="text-xs text-gray-600">
          進捗: {Math.round(workflowData.overallProgress)}% 完了
        </div>
      </CardContent>
    </Card>
  )
}