"use client"

import { AlertCircle, RefreshCw, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

// 試験進捗の型定義
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
  refreshInterval?: number // ミリ秒
  onProgressUpdate?: (progress: ExamProgress) => void
}

export default function ExamProgressCard({
  examId,
  autoRefresh = true,
  refreshInterval = 30000, // 30秒
  onProgressUpdate,
}: ExamProgressCardProps) {
  const [progress, setProgress] = useState<ExamProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 進捗データを取得する関数
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

  // 初回読み込み
  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  // 自動リフレッシュの設定
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchProgress, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchProgress])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm font-medium">
            <Users className="mr-2 h-4 w-4" />
            試験進捗
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 rounded bg-gray-200"></div>
            <div className="h-2 rounded bg-gray-200"></div>
            <div className="h-2 rounded bg-gray-200"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm font-medium">
            <Users className="mr-2 h-4 w-4" />
            試験進捗
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchProgress}>
              <RefreshCw className="mr-1 h-4 w-4" />
              再試行
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!progress) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-sm font-medium">
            <Users className="mr-2 h-4 w-4" />
            試験進捗
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            進捗データがありません
          </p>
        </CardContent>
      </Card>
    )
  }

  const isComplete =
    progress.totalItems > 0 && progress.finalizedItems >= progress.totalItems

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-xs font-medium">
            <Users className="mr-1 h-3 w-3" />
            試験進捗
            {isComplete && (
              <span className="ml-1.5 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                完了
              </span>
            )}
          </CardTitle>
          <div className="flex items-center space-x-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchProgress}
              className="h-4 w-4 p-0"
              title="進捗を更新"
            >
              <RefreshCw className="h-2 w-2" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* 基本統計 */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-sm font-semibold">
              {progress.totalStudents}
            </div>
            <div className="text-muted-foreground text-xs">生徒</div>
          </div>
          <div>
            <div className="text-sm font-semibold">
              {progress.totalQuestions}
            </div>
            <div className="text-muted-foreground text-xs">設問</div>
          </div>
          <div>
            <div className="text-sm font-semibold">{progress.totalItems}</div>
            <div className="text-muted-foreground text-xs">採点項目</div>
          </div>
        </div>

        {/* 採点進捗 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">採点進捗</span>
            <span className="text-muted-foreground text-xs">
              {progress.scoredItems}/{progress.totalItems}
            </span>
          </div>
          <Progress value={progress.scoredPercentage} className="h-1.5" />
          <div className="text-right">
            <span className="text-muted-foreground text-xs">
              {Math.round(progress.scoredPercentage)}%
            </span>
          </div>
        </div>

        {/* 最終確定進捗 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">最終確定</span>
            <span className="text-muted-foreground text-xs">
              {progress.finalizedItems}/{progress.totalItems}
            </span>
          </div>
          <Progress value={progress.finalizedPercentage} className="h-1.5" />
          <div className="text-right">
            <span className="text-muted-foreground text-xs">
              {Math.round(progress.finalizedPercentage)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
