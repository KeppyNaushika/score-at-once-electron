"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Refresh,
  TrendingUp,
} from "lucide-react"

// プロジェクト進捗の型定義
interface ProjectProgress {
  totalAnswerSheets: number
  totalQuestions: number
  totalItems: number
  gradedItems: number
  finalizedItems: number
  progressPercentage: number
  finalizedPercentage: number
}

interface ProjectProgressCardProps {
  projectId: string
  autoRefresh?: boolean
  refreshInterval?: number // ミリ秒
  onProgressUpdate?: (progress: ProjectProgress) => void
}

export default function ProjectProgressCard({
  projectId,
  autoRefresh = true,
  refreshInterval = 30000, // 30秒
  onProgressUpdate,
}: ProjectProgressCardProps) {
  const [progress, setProgress] = useState<ProjectProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // 進捗データを取得する関数
  const fetchProgress = async () => {
    try {
      setError(null)
      const result = await window.electronAPI.getProjectProgress(projectId)
      
      if (result.success && result.progress) {
        setProgress(result.progress)
        setLastUpdated(new Date())
        onProgressUpdate?.(result.progress)
      } else {
        setError(result.error || 'Failed to fetch progress')
      }
    } catch (err) {
      console.error('Failed to fetch project progress:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // 初回読み込み
  useEffect(() => {
    fetchProgress()
  }, [projectId])

  // 自動リフレッシュの設定
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchProgress, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, projectId])

  // 進捗率の計算
  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  // ステータスバッジの決定
  const getStatusBadge = () => {
    if (!progress) return null
    
    const { finalizedPercentage, progressPercentage } = progress
    
    if (finalizedPercentage === 100) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          完了
        </Badge>
      )
    } else if (progressPercentage >= 80) {
      return (
        <Badge variant="default" className="bg-blue-600">
          <TrendingUp className="h-3 w-3 mr-1" />
          順調
        </Badge>
      )
    } else if (progressPercentage >= 50) {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          進行中
        </Badge>
      )
    } else {
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          開始前
        </Badge>
      )
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <Users className="h-4 w-4 mr-2" />
            プロジェクト進捗
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <Users className="h-4 w-4 mr-2" />
            プロジェクト進捗
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-sm text-red-600">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchProgress}>
              <Refresh className="h-4 w-4 mr-1" />
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
          <CardTitle className="text-sm font-medium flex items-center">
            <Users className="h-4 w-4 mr-2" />
            プロジェクト進捗
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">進捗データがありません</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center">
            <Users className="h-4 w-4 mr-2" />
            プロジェクト進捗
          </CardTitle>
          <div className="flex items-center space-x-2">
            {getStatusBadge()}
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchProgress}
              className="h-6 w-6 p-0"
            >
              <Refresh className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 基本統計 */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold">{progress.totalAnswerSheets}</div>
            <div className="text-xs text-muted-foreground">答案数</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{progress.totalQuestions}</div>
            <div className="text-xs text-muted-foreground">設問数</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{progress.totalItems}</div>
            <div className="text-xs text-muted-foreground">総採点項目</div>
          </div>
        </div>

        {/* 採点進捗 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">採点進捗</span>
            <span className="text-sm text-muted-foreground">
              {progress.gradedItems} / {progress.totalItems}
            </span>
          </div>
          <Progress 
            value={progress.progressPercentage} 
            className="h-2"
          />
          <div className="text-right">
            <span className="text-xs text-muted-foreground">
              {Math.round(progress.progressPercentage)}%
            </span>
          </div>
        </div>

        {/* 最終確定進捗 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">最終確定</span>
            <span className="text-sm text-muted-foreground">
              {progress.finalizedItems} / {progress.totalItems}
            </span>
          </div>
          <Progress 
            value={progress.finalizedPercentage} 
            className="h-2"
          />
          <div className="text-right">
            <span className="text-xs text-muted-foreground">
              {Math.round(progress.finalizedPercentage)}%
            </span>
          </div>
        </div>

        {/* 最終更新時刻 */}
        {lastUpdated && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            最終更新: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}