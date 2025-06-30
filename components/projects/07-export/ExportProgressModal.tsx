"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
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

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      setIsClosing(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (status === 'completed' && progress === 100) {
      // 完了時に2秒後にフェードアウト開始
      const timer = setTimeout(() => {
        setIsClosing(true)
        // フェードアウトアニメーション完了後に閉じる
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
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>進行状況</span>
                  <span>{currentStepIndex + 1} / {totalSteps}</span>
                </div>
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground">{currentStep}</p>
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