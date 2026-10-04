import { ArrowRight, Code, Info, Play } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { StepResultView } from "./StepResultView"
import type { ConversionStep, StepResult } from "./types"

/** 右側：選択中のステップの説明・実装コード・実行ボタンと実行結果 */
export function StepDetail({
  steps,
  currentStep,
  stepResults,
  onRunStep,
  onSelectStep,
}: {
  steps: ConversionStep[]
  currentStep: number
  stepResults: Record<number, StepResult>
  onRunStep: (stepId: number) => void
  onSelectStep: (stepId: number) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code size={20} />
          {steps[currentStep]?.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 説明 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {steps[currentStep]?.description}
            </AlertDescription>
          </Alert>

          {/* コード例 */}
          <div>
            <h4 className="mb-2 flex items-center gap-2 font-semibold">
              <Code size={16} />
              実装コード
            </h4>
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
              <code>{steps[currentStep]?.code}</code>
            </pre>
          </div>

          {/* 実行ボタン */}
          <div className="flex gap-2">
            <Button
              onClick={() => onRunStep(currentStep)}
              className="flex items-center gap-2"
            >
              <Play size={16} />
              このステップを実行
            </Button>
            {currentStep < steps.length - 1 && (
              <Button
                variant="outline"
                onClick={() => onSelectStep(currentStep + 1)}
              >
                次のステップ
                <ArrowRight size={16} className="ml-2" />
              </Button>
            )}
          </div>

          {/* 実行結果 */}
          {stepResults[currentStep] && (
            <StepResultView
              currentStep={currentStep}
              stepResults={stepResults}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
