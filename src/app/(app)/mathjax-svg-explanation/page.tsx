"use client"

import { useState } from "react"

import { buildConversionSteps } from "./components/conversionSteps"
import { ProcessOverview } from "./components/ProcessOverview"
import { StepDetail } from "./components/StepDetail"
import { StepList } from "./components/StepList"
import type { StepResult } from "./components/types"

export default function MathJaxSVGExplanation() {
  const [currentStep, setCurrentStep] = useState(0)
  const [demoText, setDemoText] = useState(
    "$E = mc^2$ とは **アインシュタイン**の有名な公式です。"
  )
  const [stepResults, setStepResults] = useState<Record<number, StepResult>>({})

  const steps = buildConversionSteps(demoText, setStepResults)

  const runStep = async (stepId: number) => {
    const step = steps[stepId]
    if (step && step.action) {
      await step.action()
    }
  }

  const runAllSteps = async () => {
    for (let i = 0; i <= currentStep; i++) {
      const step = steps[i]
      if (step && step.action) {
        await step.action()
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }
  }

  const selectStep = (stepId: number) => {
    setCurrentStep(stepId)
    runStep(stepId)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <h1 className="mb-2 text-3xl font-bold text-gray-800">
            MathJax → SVG → Canvas 変換プロセス解説
          </h1>
          <p className="text-gray-600">
            数式テキストがCanvas上に描画されるまでの全7ステップを詳しく解説します
          </p>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* 左側：ステップリスト */}
          <StepList
            steps={steps}
            currentStep={currentStep}
            demoText={demoText}
            onSelectStep={selectStep}
            onRunAll={runAllSteps}
            onDemoTextChange={setDemoText}
          />

          {/* 右側：詳細説明 */}
          <div className="lg:col-span-2">
            <StepDetail
              steps={steps}
              currentStep={currentStep}
              stepResults={stepResults}
              onRunStep={runStep}
              onSelectStep={selectStep}
            />

            {/* プロセス概要 */}
            <ProcessOverview />
          </div>
        </div>
      </div>
    </div>
  )
}
