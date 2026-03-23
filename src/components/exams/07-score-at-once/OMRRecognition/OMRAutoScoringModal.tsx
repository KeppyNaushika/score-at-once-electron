"use client"

import { CheckCircle, Loader2, ScanLine, Sparkles, XCircle } from "lucide-react"
import { useCallback } from "react"

import { useOmrAutoScoring } from "@/components/exams/07-score-at-once/OMRRecognition/hooks/useOmrAutoScoring"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"

interface OMRAutoScoringModalProps {
  examId: string
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onScoresApplied: () => void
}

export function OMRAutoScoringModal({
  examId,
  userId,
  open,
  onOpenChange,
  onScoresApplied,
}: OMRAutoScoringModalProps) {
  const {
    isRecognizing,
    isApplying,
    progress,
    summary,
    error,
    hasOmrConfigs,
    areaThreshold,
    confidenceThreshold,
    recommendedAreaThreshold,
    runRecognition,
    applyScores,
    updateAreaThreshold,
    updateConfidenceThreshold,
    applyRecommendedThreshold,
  } = useOmrAutoScoring(examId)

  const handleApply = useCallback(async () => {
    const success = await applyScores(userId)
    if (success) {
      onScoresApplied()
      onOpenChange(false)
    }
  }, [applyScores, userId, onScoresApplied, onOpenChange])

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            OMR自動採点
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* エラー表示 */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* 認識処理中 */}
          {isRecognizing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>OMR認識実行中...</span>
              </div>
              {progress && (
                <>
                  <Progress value={progressPercent} />
                  <div className="text-muted-foreground text-xs">
                    {progress.processed} / {progress.total} 枚処理済
                    {progress.currentStudentName &&
                      ` (${progress.currentStudentName})`}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 結果サマリー */}
          {summary && !isRecognizing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle className="h-4 w-4 text-green-600" />
                認識完了
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between rounded border p-2">
                  <span>正解</span>
                  <span className="font-bold text-green-600">
                    {summary.correct}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border p-2">
                  <span>不正解</span>
                  <span className="font-bold text-red-600">
                    {summary.incorrect}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border p-2">
                  <span>無回答</span>
                  <span className="text-muted-foreground font-bold">
                    {summary.noAnswer}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border border-orange-200 bg-orange-50 p-2">
                  <span>Wマーク</span>
                  <span className="font-bold text-orange-600">
                    {summary.doubleMark}
                  </span>
                </div>
                {summary.pending > 0 && (
                  <div className="flex items-center justify-between rounded border border-orange-200 bg-orange-50 p-2">
                    <span>保留（低信頼）</span>
                    <span className="font-bold text-orange-600">
                      {summary.pending}
                    </span>
                  </div>
                )}
                {summary.partial > 0 && (
                  <div className="col-span-2 flex items-center justify-between rounded border p-2">
                    <span>部分正解</span>
                    <span className="font-bold text-blue-600">
                      {summary.partial}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-muted-foreground text-xs">
                合計 {summary.total} 件（低信頼は保留として反映）
              </div>

              {/* 閾値調整 */}
              <div className="space-y-3 border-t pt-3">
                <div className="text-sm font-medium">閾値調整</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>塗りつぶし判定閾値</span>
                    <span className="font-medium tabular-nums">
                      {Math.round(areaThreshold * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={5}
                    max={90}
                    step={1}
                    value={[Math.round(areaThreshold * 100)]}
                    onValueChange={([v]) => updateAreaThreshold(v / 100)}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>信頼度閾値（保留判定）</span>
                    <span className="font-medium tabular-nums">
                      {Math.round(confidenceThreshold * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[Math.round(confidenceThreshold * 100)]}
                    onValueChange={([v]) => updateConfidenceThreshold(v / 100)}
                  />
                </div>
                {recommendedAreaThreshold != null && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={applyRecommendedThreshold}
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    推奨塗りつぶし閾値を適用（
                    {Math.round(recommendedAreaThreshold * 100)}%）
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 初期状態 */}
          {!isRecognizing && !summary && !error && (
            <p className="text-muted-foreground text-sm">
              OMR設定に基づいて全答案のマーク認識を実行し、採点結果を一括反映します。
            </p>
          )}

          {/* 反映中 */}
          {isApplying && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              採点データを反映中...
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRecognizing || isApplying}
          >
            閉じる
          </Button>

          {!summary ? (
            <Button
              onClick={runRecognition}
              disabled={isRecognizing || !hasOmrConfigs}
            >
              {isRecognizing ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  認識中...
                </>
              ) : (
                "OMR認識実行"
              )}
            </Button>
          ) : (
            <Button
              onClick={handleApply}
              disabled={isApplying || summary.total === 0}
            >
              {isApplying ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  反映中...
                </>
              ) : (
                "採点結果を反映"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
