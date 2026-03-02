"use client"

import type { WorkflowPhase } from "@/components/exams/detail/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

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
          <span>試験進捗</span>
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
              className={`rounded-lg p-3 text-center transition-all ${
                phase.id === currentPhase
                  ? "border-2 border-blue-200 bg-blue-50"
                  : phase.isCompleted
                    ? "border-2 border-green-200 bg-green-50"
                    : "border-2 border-gray-200 bg-gray-50"
              }`}
            >
              <div className="mb-1 text-2xl">{phase.emoji}</div>
              <h3 className="mb-1 text-sm font-medium">{phase.title}</h3>
              <div className="text-xs text-gray-600">
                {phase.id === 3
                  ? "利用可能"
                  : `${phase.completedSteps}/${phase.totalSteps} 完了`}
              </div>
              <div
                className={`mt-1 text-xs font-medium ${
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
