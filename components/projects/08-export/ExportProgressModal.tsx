"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2, Square, CheckSquare } from "lucide-react"
import { useEffect, useState } from "react"

interface ExportProgressModalProps {
  isOpen: boolean
  onClose: () => void
  progress: number
  status: 'processing' | 'completed' | 'error'
  currentStep: string
  totalSteps: number
  currentStepIndex: number
  error?: string
  outputPath?: string
}

// PDF出力の7つのステップを定義
const PDF_EXPORT_STEPS = [
  { id: 1, name: "保存場所選択", progressRange: [0, 5] },
  { id: 2, name: "生徒データ取得", progressRange: [5, 20] },
  { id: 3, name: "答案データ取得", progressRange: [20, 30] },
  { id: 4, name: "採点データ取得", progressRange: [30, 40] },
  { id: 5, name: "答案画像確認", progressRange: [40, 45] },
  { id: 6, name: "PDFページ作成", progressRange: [45, 95] },
  { id: 7, name: "最適化・保存", progressRange: [95, 100] }
]

export default function ExportProgressModal({
  isOpen,
  onClose,
  progress,
  status,
  currentStep,
  totalSteps,
  currentStepIndex,
  error,
  outputPath
}: ExportProgressModalProps) {
  const [isVisible, setIsVisible] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)
  
  // 現在の進捗に基づいてステップの状態を計算
  const getStepStatus = (step: typeof PDF_EXPORT_STEPS[0]) => {
    const [minProgress, maxProgress] = step.progressRange
    if (progress >= maxProgress) {
      return 'completed'
    } else if (progress >= minProgress) {
      return 'processing'
    } else {
      return 'pending'
    }
  }

  // Step6のページ数を抽出する関数
  const getPageProgress = () => {
    // currentStepから「答案 X / Y を処理中...」や「ページ X / Y を作成中...」などの形式を抽出
    const pageMatch = currentStep.match(/(?:答案|ページ)\s*(\d+)\s*\/\s*(\d+)/) || 
                     currentStep.match(/(\d+)\s*\/\s*(\d+)/)
    if (pageMatch) {
      return {
        current: parseInt(pageMatch[1]),
        total: parseInt(pageMatch[2])
      }
    }
    return null
  }

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      setIsClosing(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (status === 'completed' && progress === 100) {
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
    if (status !== 'processing') {
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
        className={`sm:max-w-md transition-opacity duration-300 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'processing' && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
            PDF出力
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {status === 'processing' && (
            <>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>進行状況</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="w-full h-2" />
              </div>
              
              {/* ステップ表示 */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">処理ステップ</h4>
                <div className="space-y-2">
                  {PDF_EXPORT_STEPS.map((step) => {
                    const stepStatus = getStepStatus(step)
                    const pageProgress = getPageProgress()
                    
                    return (
                      <div
                        key={step.id}
                        className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${
                          stepStatus === 'processing' ? 'bg-blue-50 border border-blue-200' : 
                          stepStatus === 'completed' ? 'bg-green-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {stepStatus === 'completed' && (
                            <CheckSquare className="h-4 w-4 text-green-600" />
                          )}
                          {stepStatus === 'processing' && (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          )}
                          {stepStatus === 'pending' && (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <span className={`text-sm ${
                            stepStatus === 'processing' ? 'font-medium text-blue-700' :
                            stepStatus === 'completed' ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            Step {step.id}: {step.name}
                            {stepStatus === 'completed' && '：完了'}
                            {stepStatus === 'processing' && step.id === 6 && pageProgress && (
                              <span className="ml-2 text-blue-600">
                                ({pageProgress.current} / {pageProgress.total})
                              </span>
                            )}
                            {stepStatus === 'processing' && step.id !== 6 && '中...'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
          
          {status === 'completed' && (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                <p className="font-medium">PDF出力が完了しました</p>
                {outputPath && (
                  <p className="text-sm text-muted-foreground mt-1">
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
                      className="flex items-center space-x-3 p-2 rounded-md bg-green-50"
                    >
                      <div className="flex-shrink-0">
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
          
          {status === 'error' && (
            <div className="space-y-4">
              <div className="text-center">
                <XCircle className="h-12 w-12 text-red-600 mx-auto mb-2" />
                <p className="font-medium">PDF出力に失敗しました</p>
                {error && (
                  <p className="text-sm text-muted-foreground mt-1">
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
                        className={`flex items-center space-x-3 p-2 rounded-md ${
                          stepStatus === 'processing' ? 'bg-red-50 border border-red-200' : 
                          stepStatus === 'completed' ? 'bg-green-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {stepStatus === 'completed' && (
                            <CheckSquare className="h-4 w-4 text-green-600" />
                          )}
                          {stepStatus === 'processing' && (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          {stepStatus === 'pending' && (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <span className={`text-sm ${
                            stepStatus === 'processing' ? 'font-medium text-red-700' :
                            stepStatus === 'completed' ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            Step {step.id}: {step.name}
                            {stepStatus === 'completed' && '：完了'}
                            {stepStatus === 'processing' && '：エラー'}
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
            {status === 'processing' ? (
              <Button variant="outline" disabled>
                処理中...
              </Button>
            ) : (
              <Button onClick={handleClose}>
                閉じる
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}