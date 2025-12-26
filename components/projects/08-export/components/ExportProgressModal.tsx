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
  Circle,
  Loader2,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

interface ExportProgressModalProps {
  isOpen: boolean
  onClose: () => void
  progress: number
  status: "processing" | "completed" | "error"
  currentStep: string
  error?: string
  outputPath?: string
  // ストリーミング処理の詳細進捗
  embeddedPagesCount?: number
  totalPagesCount?: number
  canvasRenderingComplete?: boolean
}

// PDF出力のフェーズ定義
type ExportPhase = "initializing" | "rendering" | "saving" | "complete"

// フェーズ定義
const PHASES: { id: ExportPhase; label: string }[] = [
  { id: "initializing", label: "初期化" },
  { id: "rendering", label: "描画・埋め込み" },
  { id: "saving", label: "保存" },
  { id: "complete", label: "完了" },
]

export default function ExportProgressModal({
  isOpen,
  onClose,
  progress,
  status,
  currentStep,
  error,
  outputPath,
  embeddedPagesCount = 0,
  totalPagesCount = 0,
  canvasRenderingComplete = false,
}: ExportProgressModalProps) {
  const [isVisible, setIsVisible] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)

  // 現在のフェーズを計算
  const currentPhase = useMemo((): ExportPhase => {
    if (status === "completed") return "complete"
    if (progress < 10) return "initializing"
    // Canvas描画完了でも埋め込み未完了なら描画フェーズのまま
    if (canvasRenderingComplete && totalPagesCount > 0 && embeddedPagesCount < totalPagesCount) {
      return "rendering"
    }
    if (progress < 95) return "rendering"
    return "saving"
  }, [progress, status, canvasRenderingComplete, totalPagesCount, embeddedPagesCount])

  // currentStepからCanvas/PDF進捗を抽出
  const progressDetails = useMemo(() => {
    // 「Canvas: X/Yページ (N並列) | PDF: M/Yページ埋め込み済み」形式を解析
    const canvasMatch = currentStep.match(/Canvas:\s*(\d+)\/(\d+)ページ/)
    const parallelMatch = currentStep.match(/\((\d+)並列\)/)
    const pdfMatch = currentStep.match(/PDF:\s*(\d+)\/(\d+)ページ/)

    return {
      canvasCompleted: canvasMatch ? parseInt(canvasMatch[1]) : 0,
      canvasTotal: canvasMatch ? parseInt(canvasMatch[2]) : 0,
      parallelCount: parallelMatch ? parseInt(parallelMatch[1]) : 0,
      pdfEmbedded: pdfMatch ? parseInt(pdfMatch[1]) : 0,
      pdfTotal: pdfMatch ? parseInt(pdfMatch[2]) : 0,
    }
  }, [currentStep])

  // 保存先選択待ちかどうか
  const isWaitingForSavePath = useMemo(() => {
    return currentStep.includes("保存先を選択") || currentStep.includes("保存先の選択を待っています")
  }, [currentStep])

  // フェーズインデックスを取得
  const currentPhaseIndex = useMemo(() => {
    return PHASES.findIndex(p => p.id === currentPhase)
  }, [currentPhase])

  // ページ完了グリッド用の計算値（propsから直接取得）
  const gridInfo = useMemo(() => {
    // propsのtotalPagesCountを優先、なければcurrentStepから抽出
    const total = totalPagesCount > 0 ? totalPagesCount : progressDetails.canvasTotal
    const embedded = embeddedPagesCount

    if (total === 0) return null

    const displayCount = Math.min(total, 40)
    const groupSize = total > 40 ? Math.ceil(total / 40) : 1

    return { displayCount, groupSize, canvasTotal: total, pdfEmbedded: embedded }
  }, [totalPagesCount, embeddedPagesCount, progressDetails.canvasTotal])

  useEffect(() => {
    if (!isOpen) {
      // isOpenがfalseになったらモーダルを閉じる
      setIsVisible(false)
      setIsClosing(false)
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
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
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
              {/* 全体プログレス */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>全体の進行状況</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3 w-full" />
              </div>

              {/* フェーズインジケーター */}
              <div className="flex items-center justify-center gap-1 text-xs">
                {PHASES.map((phase, index) => {
                  const isCompleted = index < currentPhaseIndex
                  const isCurrent = index === currentPhaseIndex
                  const isPending = index > currentPhaseIndex

                  return (
                    <div key={phase.id} className="flex items-center">
                      <div className={`flex items-center gap-1 rounded-full px-2 py-1 ${
                        isCurrent
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : isCompleted
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-400"
                      }`}>
                        {isCompleted && <CheckCircle className="h-3 w-3" />}
                        {isCurrent && <Loader2 className="h-3 w-3 animate-spin" />}
                        {isPending && <Circle className="h-3 w-3" />}
                        <span>{phase.label}</span>
                      </div>
                      {index < PHASES.length - 1 && (
                        <div className={`mx-1 h-0.5 w-4 ${
                          index < currentPhaseIndex ? "bg-green-400" : "bg-gray-200"
                        }`} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 保存先選択待ち + 埋め込み進行中でない場合の特別表示 */}
              {isWaitingForSavePath && !(canvasRenderingComplete && totalPagesCount > 0 && embeddedPagesCount < totalPagesCount) && (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-start space-x-3">
                    <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-amber-600" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-800">
                        保存先を選択してください
                      </p>
                      <p className="mt-1 text-xs text-amber-700">
                        バックグラウンドで処理を進めています
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 描画フェーズの詳細表示（Canvas完了後の埋め込み中も表示） */}
              {(currentPhase === "rendering" || (canvasRenderingComplete && totalPagesCount > 0 && embeddedPagesCount < totalPagesCount)) && (
                <div className="space-y-4 rounded-lg bg-gray-50 p-3">
                  {/* Canvas描画完了・埋め込み待機中の表示 */}
                  {canvasRenderingComplete && totalPagesCount > 0 && embeddedPagesCount < totalPagesCount && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Canvas描画完了</span>
                        <span className="text-blue-500">→</span>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>PDF埋め込み中...</span>
                      </div>
                    </div>
                  )}

                  {/* 並列処理状況 */}
                  {progressDetails.canvasTotal > 0 && !canvasRenderingComplete && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Canvas描画</span>
                        <span className="font-medium">
                          {progressDetails.canvasCompleted}/{progressDetails.canvasTotal}ページ
                        </span>
                      </div>
                      <Progress
                        value={(progressDetails.canvasCompleted / progressDetails.canvasTotal) * 100}
                        className="h-2"
                      />
                      {progressDetails.parallelCount > 0 && (
                        <div className="flex items-center gap-2 text-xs text-blue-600">
                          <div className="flex gap-1">
                            {Array.from({ length: progressDetails.parallelCount }).map((_, i) => (
                              <div key={i} className="h-3 w-3 animate-pulse rounded bg-blue-400" />
                            ))}
                          </div>
                          <span>{progressDetails.parallelCount}並列描画中</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ページ完了グリッド */}
                  {gridInfo && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">PDF埋め込み進捗</span>
                        <span className="font-medium">
                          {gridInfo.pdfEmbedded}/{gridInfo.canvasTotal}ページ
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {Array.from({ length: gridInfo.displayCount }).map((_, i) => {
                          const pageIndex = i * gridInfo.groupSize
                          // 全ページ埋め込み完了時は全て緑に
                          const isEmbedded = gridInfo.pdfEmbedded >= gridInfo.canvasTotal || pageIndex < gridInfo.pdfEmbedded
                          return (
                            <div
                              key={i}
                              className={`h-2 w-2 rounded-sm ${
                                isEmbedded ? "bg-green-500" : "bg-gray-200"
                              }`}
                              title={
                                gridInfo.groupSize > 1
                                  ? `ページ ${pageIndex + 1}-${Math.min((i + 1) * gridInfo.groupSize, gridInfo.canvasTotal)}`
                                  : `ページ ${i + 1}`
                              }
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 保存フェーズ */}
              {currentPhase === "saving" && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-800">PDFを保存中...</p>
                      <p className="text-xs text-blue-600">しばらくお待ちください</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {status === "completed" && (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="mx-auto mb-2 h-12 w-12 text-green-600" />
                <p className="font-medium">PDF出力が完了しました</p>
                {outputPath && (
                  <p className="text-muted-foreground mt-1 text-sm break-all">
                    保存先: {outputPath}
                  </p>
                )}
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="text-center">
                <XCircle className="mx-auto mb-2 h-12 w-12 text-red-600" />
                <p className="font-medium">PDF出力に失敗しました</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-sm text-red-700">{currentStep}</p>
                {error && (
                  <p className="mt-1 text-xs text-red-600">{error}</p>
                )}
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
