"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WorkflowPhase } from "@/components/projects/detail/types"
import {
  BarChart3,
  Calculator,
  ChevronRight,
  Edit,
  FileImage,
  FileOutput,
  type LucideIcon,
  Settings,
  Upload,
  Users,
} from "lucide-react"
import Link from "next/link"

interface PhaseCardProps {
  phase: WorkflowPhase
  projectId: string
}

const iconMap: Record<string, LucideIcon> = {
  FileImage,
  Settings,
  Edit,
  Calculator,
  Users,
  Upload,
  BarChart3,
  FileOutput,
}

export default function PhaseCard({ phase, projectId }: PhaseCardProps) {
  const getStepIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName]
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null
  }

  const getStatusColor = (step: typeof phase.steps[0]) => {
    if (step.isCompleted) return "text-green-600"
    if (step.canStart) return "text-blue-600"
    return "text-gray-400"
  }

  const getStepRowClass = (step: typeof phase.steps[0]) => {
    if (step.isCompleted) return "bg-green-50"
    if (step.canStart) return "bg-blue-50"
    return "bg-gray-50"
  }

  return (
    <Card
      className={`h-full transition-all ${
        phase.isActive
          ? "border-blue-300 shadow-lg"
          : phase.isCompleted
          ? "border-green-300"
          : "border-gray-200"
      }`}
    >
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{phase.emoji}</span>
            <div>
              <h3 className="text-lg font-semibold">{phase.title}</h3>
              <p className="text-sm text-gray-600 font-normal">
                {phase.description}
              </p>
            </div>
          </div>
          {phase.id !== 3 && (
            <div className="text-right">
              <div className="text-lg font-bold">
                {phase.completedSteps}/{phase.totalSteps}
              </div>
              <div className="text-xs text-gray-600">完了</div>
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {phase.steps.map((step) => (
            <Link
              key={step.id}
              href={`/projects/${projectId}${step.path}`}
              className={`block p-3 rounded-lg transition-all hover:shadow-sm cursor-pointer ${getStepRowClass(
                step
              )}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={getStatusColor(step)}>
                    {step.isCompleted ? (
                      <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    ) : (
                      getStepIcon(step.icon)
                    )}
                  </div>
                  <div className="flex-1">
                    <h4
                      className={`font-medium text-sm ${getStatusColor(step)}`}
                    >
                      {step.title}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="ml-2">
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Next Action Button */}
        {phase.isActive && phase.nextStepId && (
          <div className="mt-4 pt-4 border-t">
            {(() => {
              const nextStep = phase.steps.find((s) => s.id === phase.nextStepId)
              return nextStep ? (
                <Link href={`/projects/${projectId}${nextStep.path}`}>
                  <Button className="w-full" size="sm">
                    次へ: {nextStep.title}
                  </Button>
                </Link>
              ) : null
            })()}
          </div>
        )}

        {/* Phase Completed */}
        {phase.isCompleted && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-center text-green-600 font-medium text-sm">
              ✓ Phase {phase.id} 完了
            </div>
          </div>
        )}

        {/* Phase Waiting */}
        {!phase.isActive && !phase.isCompleted && !phase.canStart && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-center text-gray-500 font-medium text-sm">
              前のPhaseの完了を待機中
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}