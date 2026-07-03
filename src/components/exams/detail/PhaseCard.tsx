"use client"

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

import type { WorkflowPhase } from "@/components/exams/detail/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PhaseCardProps {
  phase: WorkflowPhase
  examId: string
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

export default function PhaseCard({ phase, examId }: PhaseCardProps) {
  const getStepIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName]
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null
  }

  const getStatusColor = (step: (typeof phase.steps)[0]) => {
    if (step.isCompleted) return "text-green-600"
    if (step.canStart) return "text-blue-600"
    return "text-gray-400"
  }

  const getStepRowClass = (step: (typeof phase.steps)[0]) => {
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
              <p className="text-sm font-normal text-gray-600">
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
              href={`/exams/${examId}${step.path}`}
              className={`block cursor-pointer rounded-lg p-3 transition-all hover:shadow-sm ${getStepRowClass(
                step
              )}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <div className={getStatusColor(step)}>
                    {step.isCompleted ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                        <span className="text-xs text-white">✓</span>
                      </div>
                    ) : (
                      getStepIcon(step.icon)
                    )}
                  </div>
                  <div className="flex-1">
                    <h4
                      className={`text-sm font-medium ${getStatusColor(step)}`}
                    >
                      {step.title}
                    </h4>
                    <p className="mt-1 text-xs text-gray-600">
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
          <div className="mt-4 border-t pt-4">
            {(() => {
              const nextStep = phase.steps.find(
                (step) => step.id === phase.nextStepId
              )
              return nextStep ? (
                <Link href={`/exams/${examId}${nextStep.path}`}>
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
          <div className="mt-4 border-t pt-4">
            <div className="text-center text-sm font-medium text-green-600">
              ✓ Phase {phase.id} 完了
            </div>
          </div>
        )}

        {/* Phase Waiting */}
        {!phase.isActive && !phase.isCompleted && !phase.canStart && (
          <div className="mt-4 border-t pt-4">
            <div className="text-center text-sm font-medium text-gray-500">
              前のPhaseの完了を待機中
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
