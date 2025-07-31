"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface WorkflowProgressProps {
  masterImageCount: number
  cropRegionCount: number
  questionRegionCount: number
  studentCount: number
  answerSheetCount: number
}

export default function WorkflowProgress({
  masterImageCount,
  cropRegionCount,
  questionRegionCount,
  studentCount,
  answerSheetCount,
}: WorkflowProgressProps) {
  const steps = [
    {
      title: "模範解答のアップロード",
      description: "試験問題の模範解答画像をアップロードします",
      completed: masterImageCount > 0,
      canStart: true,
      count: masterImageCount,
      countLabel: "ページ完了",
    },
    {
      title: "採点領域の作成",
      description: "各設問の採点範囲を設定します",
      completed: cropRegionCount > 0,
      canStart: masterImageCount > 0,
      count: cropRegionCount,
      countLabel: "領域作成済み",
    },
    {
      title: "領域情報の編集",
      description: "各領域の種類、配点、ラベルを設定します",
      completed: questionRegionCount > 0,
      canStart: cropRegionCount > 0,
      count: questionRegionCount,
      countLabel: "設問定義済み",
    },
    {
      title: "受験生徒の管理",
      description: "プロジェクトに参加する生徒を管理します",
      completed: studentCount > 0,
      canStart: questionRegionCount > 0,
      count: studentCount,
      countLabel: "名登録済み",
    },
    {
      title: "答案のアップロード",
      description: "スキャンした生徒の答案画像をアップロードします",
      completed: answerSheetCount > 0,
      canStart: studentCount > 0,
      count: answerSheetCount,
      countLabel: "件アップロード済み",
    },
    {
      title: "採点実行",
      description: "準備が完了したら採点を開始できます",
      completed: false,
      canStart: answerSheetCount > 0 && questionRegionCount > 0,
      count: 0,
      countLabel: "実行可能",
    },
  ]

  const getStepCircleClass = (step: (typeof steps)[0], index: number) => {
    if (step.completed) {
      return "bg-green-500 text-white"
    }
    if (step.canStart) {
      const colors = [
        "bg-blue-100 text-blue-600",
        "bg-green-100 text-green-600",
        "bg-indigo-100 text-indigo-600",
        "bg-purple-100 text-purple-600",
        "bg-orange-100 text-orange-600",
        "bg-red-100 text-red-600",
      ]
      return colors[index] || "bg-gray-100 text-gray-600"
    }
    return "bg-gray-300 text-gray-600"
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>ワークフロー進捗</CardTitle>
        <CardDescription>6段階の採点準備プロセス</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${getStepCircleClass(step, index)}`}
              >
                {index + 1}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="text-muted-foreground text-sm">
                  {step.description}
                  {step.count > 0 && ` (${step.count}${step.countLabel})`}
                  {step.canStart &&
                    !step.completed &&
                    step.title === "採点実行" &&
                    " (実行可能)"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
