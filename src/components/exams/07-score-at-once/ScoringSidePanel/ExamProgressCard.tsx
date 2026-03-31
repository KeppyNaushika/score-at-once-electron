"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface ExamProgress {
  totalStudents: number
  totalQuestions: number
  totalItems: number
  scoredItems: number
  finalizedItems: number
  scoredPercentage: number
  finalizedPercentage: number
}

interface ExamProgressCardProps {
  examId: string
  autoRefresh?: boolean
  refreshInterval?: number
  onProgressUpdate?: (progress: ExamProgress) => void
}

export default function ExamProgressCard({
  examId,
  autoRefresh = true,
  refreshInterval = 30000,
  onProgressUpdate,
}: ExamProgressCardProps) {
  const [progress, setProgress] = useState<ExamProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    try {
      setError(null)
      const result = await window.electronAPI.getExamProgress(examId)

      if (result && typeof result.totalItems === "number") {
        const data: ExamProgress = {
          totalStudents: result.totalStudents,
          totalQuestions: result.totalQuestions,
          totalItems: result.totalItems,
          scoredItems: result.scoredItems,
          finalizedItems: result.finalizedItems,
          scoredPercentage: result.scoredPercentage,
          finalizedPercentage: result.finalizedPercentage,
        }
        setProgress(data)
        onProgressUpdate?.(data)
      } else {
        setError("Failed to fetch progress")
      }
    } catch (err) {
      console.error("Failed to fetch exam progress:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [examId, onProgressUpdate])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchProgress, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchProgress])

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-3 rounded bg-gray-200"></div>
        <div className="h-1.5 rounded bg-gray-200"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2 text-center">
        <AlertCircle className="mx-auto h-5 w-5 text-red-400" />
        <p className="text-xs text-red-500">{error}</p>
        <Button size="sm" variant="outline" onClick={fetchProgress}>
          <RefreshCw className="mr-1 h-3 w-3" />
          再試行
        </Button>
      </div>
    )
  }

  if (!progress) {
    return (
      <p className="text-muted-foreground text-xs">進捗データがありません</p>
    )
  }

  const isComplete =
    progress.totalItems > 0 && progress.finalizedItems >= progress.totalItems

  return (
    <div className="space-y-2">
      {/* 基本統計 */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          生徒 {progress.totalStudents} / 設問 {progress.totalQuestions} / 計{" "}
          {progress.totalItems}項目
        </span>
        <div className="flex items-center gap-1">
          {isComplete && (
            <span className="rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-700">
              完了
            </span>
          )}
          <button
            onClick={fetchProgress}
            className="text-gray-400 hover:text-gray-600"
            title="進捗を更新"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* 採点進捗 */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>採点</span>
          <span>
            {progress.scoredItems}/{progress.totalItems} (
            {Math.round(progress.scoredPercentage)}%)
          </span>
        </div>
        <Progress value={progress.scoredPercentage} className="h-1" />
      </div>

      {/* 最終確定進捗 */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>確定</span>
          <span>
            {progress.finalizedItems}/{progress.totalItems} (
            {Math.round(progress.finalizedPercentage)}%)
          </span>
        </div>
        <Progress value={progress.finalizedPercentage} className="h-1" />
      </div>
    </div>
  )
}
