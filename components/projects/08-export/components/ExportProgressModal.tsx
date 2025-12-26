"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle,
  CheckSquare,
  Loader2,
  Square,
  XCircle,
} from "lucide-react"
import { useEffect, useState } from "react"

interface ExportProgressModalProps {
  isOpen: boolean
  onClose: () => void
  progress: number
  status: "processing" | "completed" | "error"
  currentStep: string
  error?: string
  outputPath?: string
}

// PDF出力のステップを定義（並行処理対応）
const PDF_EXPORT_STEPS = [
  { id: 1, name: "保存先選択・データ取得", progressRange: [0, 10], isParallel: true },
  { id: 2, name: "Canvas描画", progressRange: [10, 85] },
  { id: 3, name: "PDF生成・保存", progressRange: [85, 100] },
]

export default function ExportProgressModal({
  isOpen,
  onClose,
  progress,
  status,
  currentStep,
  error,
  outputPath,
}: ExportProgressModalProps) {
  const [isVisible, setIsVisible] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)

  // 現在の進捗に基づいてステップの状態を計算
  const getStepStatus = (step: (typeof PDF_EXPORT_STEPS)[0]) => {
    const [minProgress, maxProgress] = step.progressRange
    if (progress >= maxProgress) {
      return "completed"
    } else if (progress >= minProgress) {
      return "processing"
    } else {
      return "pending"
    }
  }

  // Canvas描画のページ数を抽出する関数
  const getPageProgress = () => {
    // currentStepから「答案 X / Y を処理中...」や「ページ X / Y を作成中...」などの形式を抽出
    const pageMatch =
      currentStep.match(/(?:答案|ページ)\s*(\d+)\s*\/\s*(\d+)/) ||
      currentStep.match(/(\d+)\s*\/\s*(\d+)/)
    if (pageMatch) {
      return {
        current: parseInt(pageMatch[1]),
        total: parseInt(pageMatch[2]),
      }
    }
    return null
  }

  // 並行処理ステップかどうかを判定
  const isParallelStep = () => {
    return currentStep.includes("保存先を選択") || currentStep.includes("バックグラウンド")
  }

  // Canvas描画完了後、保存先待ちの状態かどうか
  const isWaitingForSavePath = () => {
    return currentStep.includes("保存先の選択を待っています")
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const frame = requestAnimationFrame(() => {
      setIsVisible(true)
      setIsClosing(false)
    })

    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  useEffect(() => {
    if (status === "completed" && progress === 100) {
      const timer = setTimeout(() => {
        setIsClosing(true)
        setTimeout(() => {
          setIsVisible(false)
          onClose()
        }, 300)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [status, progress, onClose])

  const handleClose = () => {
    if (status !== "processing") {
      setIsClosing(true)
      setTimeout(() => {
        setIsVisible(false)
        onClose()
      }, 300)
    }
  }

  return (
    <Dialog open={isVisible} onOpenChange={handleClose}>
      <DialogContent
        className={`transition-opacity duration-300 sm:max-w-md ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === "processing" && (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
            {status === "completed" && (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            {status === "error" && <XCircle className="h-5 w-5 text-red-600" />}
            PDF出力
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {status === "processing" && (
            <>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>進行状況</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2 w-full" />
              </div>

              {/* 並行処理時の特別な表示 */}
              {(isParallelStep() || isWaitingForSavePath()) && (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5 shrink-0">
                      <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-amber-800">
                        保存先を選択してください
                      </p>
                      <p className="mt-1 text-sm text-amber-700">
                        {isWaitingForSavePath()
                          ? "Canvas描画が完了しました。保存先を選択するとPDF生成を開始します。"
                          : "ダイアログで保存先を選んでいる間、バックグラウンドで処理を進めています。"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ステップ表示 */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">処理ステップ</h4>
                <div className="space-y-2">
                  {PDF_EXPORT_STEPS.map((step) => {
                    const stepStatus = getStepStatus(step)
                    const pageProgress = getPageProgress()
                    const isCurrentParallel = step.id === 1 && isParallelStep()

                    return (
                      <div
                        key={step.id}
                        className={`flex items-center space-x-3 rounded-md p-2 transition-colors ${
                          stepStatus === "processing"
                            ? isCurrentParallel
                              ? "border border-amber-300 bg-amber-50"
                              : "border border-blue-200 bg-blue-50"
                            : stepStatus === "completed"
                              ? "bg-green-50"
                              : "bg-gray-50"
                        }`}
                      >
                        <div className="shrink-0">
                          {stepStatus === "completed" && (
                            <CheckSquare className="h-4 w-4 text-green-600" />
                          )}
                          {stepStatus === "processing" && (
                            <Loader2 className={`h-4 w-4 animate-spin ${isCurrentParallel ? "text-amber-600" : "text-blue-600"}`} />
                          )}
                          {stepStatus === "pending" && (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <span
                            className={`text-sm ${
                              stepStatus === "processing"
                                ? isCurrentParallel
                                  ? "font-medium text-amber-700"
                                  : "font-medium text-blue-700"
                                : stepStatus === "completed"
                                  ? "text-green-700"
                                  : "text-gray-500"
                            }`}
                          >
                            Step {step.id}: {step.name}
                            {stepStatus === "completed" && "：完了"}
                            {stepStatus === "processing" &&
                              step.id === 2 &&
                              pageProgress && (
                                <span className="ml-2 text-blue-600">
                                  ({pageProgress.current} / {pageProgress.total})
                                </span>
                              )}
                            {stepStatus === "processing" &&
                              step.id === 1 &&
                              isCurrentParallel &&
                              "（並行処理中）"}
                            {stepStatus === "processing" &&
                              !isCurrentParallel &&
                              step.id !== 2 &&
                              "中..."}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {status === "completed" && (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="mx-auto mb-2 h-12 w-12 text-green-600" />
                <p className="font-medium">PDF出力が完了しました</p>
                {outputPath && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    保存先: {outputPath}
                  </p>
                )}
              </div>

              {/* 完了したステップの一覧 */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">完了したステップ</h4>
                <div className="space-y-2">
                  {PDF_EXPORT_STEPS.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-center space-x-3 rounded-md bg-green-50 p-2"
                    >
                      <div className="shrink-0">
                        <CheckSquare className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm text-green-700">
                          Step {step.id}: {step.name}：完了
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="text-center">
                <XCircle className="mx-auto mb-2 h-12 w-12 text-red-600" />
                <p className="font-medium">PDF出力に失敗しました</p>
                {error && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    エラー: {error}
                  </p>
                )}
              </div>

              {/* エラー時のステップ状況 */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">処理状況</h4>
                <div className="space-y-2">
                  {PDF_EXPORT_STEPS.map((step) => {
                    const stepStatus = getStepStatus(step)
                    return (
                      <div
                        key={step.id}
                        className={`flex items-center space-x-3 rounded-md p-2 ${
                          stepStatus === "processing"
                            ? "border border-red-200 bg-red-50"
                            : stepStatus === "completed"
                              ? "bg-green-50"
                              : "bg-gray-50"
                        }`}
                      >
                        <div className="shrink-0">
                          {stepStatus === "completed" && (
                            <CheckSquare className="h-4 w-4 text-green-600" />
                          )}
                          {stepStatus === "processing" && (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          {stepStatus === "pending" && (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <span
                            className={`text-sm ${
                              stepStatus === "processing"
                                ? "font-medium text-red-700"
                                : stepStatus === "completed"
                                  ? "text-green-700"
                                  : "text-gray-500"
                            }`}
                          >
                            Step {step.id}: {step.name}
                            {stepStatus === "completed" && "：完了"}
                            {stepStatus === "processing" && "：エラー"}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            {status === "processing" ? (
              <Button variant="outline" disabled>
                処理中...
              </Button>
            ) : (
              <Button onClick={handleClose}>閉じる</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
