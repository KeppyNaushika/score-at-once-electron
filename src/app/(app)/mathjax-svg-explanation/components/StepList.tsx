import { Info, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

import type { ConversionStep } from "./types"

/** 左側：ステップの一覧と全ステップ実行、サンプルテキストの入力 */
export function StepList({
  steps,
  currentStep,
  demoText,
  onSelectStep,
  onRunAll,
  onDemoTextChange,
}: {
  steps: ConversionStep[]
  currentStep: number
  demoText: string
  onSelectStep: (stepId: number) => void
  onRunAll: () => void
  onDemoTextChange: (demoText: string) => void
}) {
  return (
    <div className="lg:col-span-1">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info size={20} />
            変換ステップ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <Button
                key={step.id}
                variant={currentStep === index ? "default" : "outline"}
                className="w-full justify-start text-left"
                onClick={() => onSelectStep(index)}
              >
                <span className="flex items-center gap-2">
                  <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm">
                    {step.title.replace(/^\d+\.\s*/, "")}
                  </span>
                </span>
              </Button>
            ))}
          </div>

          <div className="mt-4 border-t pt-4">
            <Button onClick={onRunAll} className="w-full" variant="secondary">
              <Play size={16} className="mr-2" />
              全ステップ実行
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 入力テキスト設定 */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">サンプルテキスト</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={demoText}
            onChange={(e) => onDemoTextChange(e.target.value)}
            placeholder="MathJax記法を含むテキストを入力"
            rows={3}
            className="text-sm"
          />
          <p className="mt-2 text-xs text-gray-500">
            $...$ や $$...$$ で数式を記述できます
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
