"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { WorkflowPhase } from "@/types/workflow.types"

interface OverallProgressProps {
  phases: WorkflowPhase[]
  currentPhase: 1 | 2 | 3
  overallProgress: number
}

export default function OverallProgress({
  phases,
  currentPhase,
  overallProgress,
}: OverallProgressProps) {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span>プロジェクト進捗</span>
          <span className="text-2xl font-bold text-blue-600">
            {Math.round(overallProgress)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={overallProgress} className="mb-4 h-3" />
        
        <div className="grid grid-cols-3 gap-4">
          {phases.map((phase) => (
            <div
              key={phase.id}
              className={`text-center p-3 rounded-lg transition-all ${
                phase.id === currentPhase
                  ? "bg-blue-50 border-2 border-blue-200"
                  : phase.isCompleted
                  ? "bg-green-50 border-2 border-green-200"
                  : "bg-gray-50 border-2 border-gray-200"
              }`}
            >
              <div className="text-2xl mb-1">{phase.emoji}</div>
              <h3 className="font-medium text-sm mb-1">{phase.title}</h3>
              <div className="text-xs text-gray-600">
                {phase.id === 3 ? "利用可能" : `${phase.completedSteps}/${phase.totalSteps} 完了`}
              </div>
              <div
                className={`text-xs font-medium mt-1 ${
                  phase.id === currentPhase
                    ? "text-blue-600"
                    : phase.isCompleted
                    ? "text-green-600"
                    : "text-gray-500"
                }`}
              >
                {phase.isCompleted
                  ? "✓ 完了"
                  : phase.id === currentPhase
                  ? "実行中"
                  : "待機中"}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}