"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  Save,
  Users,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"

// 採点結果の型定義
interface QuestionScore {
  id: string
  score: number
  maxScore: number
  status:
    | "ungraded"
    | "correct"
    | "incorrect"
    | "partial"
    | "pending"
    | "proposed"
    | "final"
  comment: string
  scoredByUserId: string
  scoredByUser: {
    id: string
    name: string
    username: string
  }
  createdAt: string
  updatedAt: string
  scoreVersion: number
}

// 比較データの型定義
interface ScoreComparison {
  finalScore?: QuestionScore
  proposedScores: QuestionScore[]
  hasConflict: boolean
}

interface ScoreComparisonModalProps {
  isOpen: boolean
  onClose: () => void
  answerSheetId: string
  layoutRegionId: string
  questionNumber: string
  maxScore: number
  studentName: string
  onScoreFinalized?: () => void
}

export default function ScoreComparisonModal({
  isOpen,
  onClose,
  answerSheetId,
  layoutRegionId,
  questionNumber,
  maxScore,
  studentName,
  onScoreFinalized,
}: ScoreComparisonModalProps) {
  const [comparison, setComparison] = useState<ScoreComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [finalComment, setFinalComment] = useState("")

  // 採点比較データを取得
  const fetchComparison = async () => {
    if (!answerSheetId || !layoutRegionId) return

    setLoading(true)
    try {
      const result = await window.electronAPI.getQuestionScoreComparison(
        answerSheetId,
        layoutRegionId,
      )

      if (result && typeof result === 'object') {
        setComparison(result as any)

        // 既存の最終結果がある場合はフォームに設定
        if ((result as any).finalScore) {
          setFinalScore((result as any).finalScore.score)
          setFinalComment((result as any).finalScore.comment || "")
        } else if ((result as any).proposedScores?.length === 1) {
          // 採点結果が1つだけの場合は自動で設定
          setFinalScore((result as any).proposedScores[0].score)
          setFinalComment((result as any).proposedScores[0].comment || "")
        }
      } else {
        console.error("Failed to fetch score comparison:", result)
      }
    } catch (error) {
      console.error("Failed to fetch score comparison:", error)
    } finally {
      setLoading(false)
    }
  }

  // モーダルが開かれたときにデータを取得
  useEffect(() => {
    if (isOpen) {
      fetchComparison()
    }
  }, [isOpen, answerSheetId, layoutRegionId])

  // 採点結果を最終決定
  const handleFinalize = async () => {
    if (!answerSheetId || !layoutRegionId) return

    setFinalizing(true)
    try {
      const finalizeData = {
        partialScore: finalScore,
        status: 'finalized',
        comments: finalComment,
      }
      const result = await window.electronAPI.finalizeQuestionScore(
        answerSheetId,
        layoutRegionId,
        "current-user", // TODO: 認証システムと連携
        finalizeData,
      )

      if (result && result.id) {
        onScoreFinalized?.()
        onClose()
      } else {
        console.error("Failed to finalize score:", result)
      }
    } catch (error) {
      console.error("Failed to finalize score:", error)
    } finally {
      setFinalizing(false)
    }
  }

  // 採点結果のスタイルを取得
  const getScoreStyle = (score: QuestionScore) => {
    switch (score.status) {
      case "correct":
        return "border-green-200 bg-green-50"
      case "incorrect":
        return "border-red-200 bg-red-50"
      case "partial":
        return "border-yellow-200 bg-yellow-50"
      case "pending":
        return "border-blue-200 bg-blue-50"
      case "final":
        return "border-purple-200 bg-purple-50"
      default:
        return "border-gray-200 bg-gray-50"
    }
  }

  // ステータスバッジを取得
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "correct":
        return <Badge className="bg-green-600">🔵 正答</Badge>
      case "incorrect":
        return <Badge variant="destructive">❌ 誤答</Badge>
      case "partial":
        return <Badge variant="secondary">🔸 部分点</Badge>
      case "pending":
        return <Badge variant="outline">⏸️ 保留</Badge>
      case "final":
        return (
          <Badge className="bg-purple-600">
            <CheckCircle className="mr-1 h-3 w-3" />
            最終
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            採点結果の比較・最終決定
          </DialogTitle>
          <DialogDescription>
            {studentName} - 設問{questionNumber} ({maxScore}点満点)
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <span className="ml-2">データを読み込み中...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 最終結果が既にある場合 */}
            {comparison?.finalScore && (
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-sm">
                    <CheckCircle className="mr-2 h-4 w-4 text-purple-600" />
                    最終決定済み
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold">
                        {comparison.finalScore.score} /{" "}
                        {comparison.finalScore.maxScore} 点
                      </div>
                      <div className="text-muted-foreground text-sm">
                        決定者: {comparison.finalScore.scoredByUser.name}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        決定日時:{" "}
                        {new Date(
                          comparison.finalScore.updatedAt,
                        ).toLocaleString()}
                      </div>
                    </div>
                    {getStatusBadge(comparison.finalScore.status)}
                  </div>
                  {comparison.finalScore.comment && (
                    <div className="mt-3 rounded border bg-white p-3">
                      <div className="mb-1 text-sm font-medium">コメント:</div>
                      <div className="text-sm">
                        {comparison.finalScore.comment}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 提案された採点結果一覧 */}
            {comparison?.proposedScores &&
              comparison.proposedScores.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center text-lg font-semibold">
                    <MessageSquare className="mr-2 h-5 w-5" />
                    採点結果一覧 ({comparison.proposedScores.length}件)
                  </h3>
                  <div className="grid gap-3">
                    {comparison.proposedScores.map((score, index) => (
                      <Card key={score.id} className={getScoreStyle(score)}>
                        <CardContent className="p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="text-lg font-semibold">
                                {score.score} / {score.maxScore} 点
                              </div>
                              {getStatusBadge(score.status)}
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {score.scoredByUser.name}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {new Date(score.updatedAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {score.comment && (
                            <div className="mt-2 rounded border bg-white p-2">
                              <div className="mb-1 text-xs font-medium">
                                コメント:
                              </div>
                              <div className="text-sm">{score.comment}</div>
                            </div>
                          )}
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setFinalScore(score.score)
                                setFinalComment(score.comment || "")
                              }}
                            >
                              この結果を採用
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

            {/* 競合の警告 */}
            {comparison?.hasConflict && (
              <div className="flex items-center rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <AlertTriangle className="mr-3 h-5 w-5 text-yellow-600" />
                <div>
                  <div className="font-medium text-yellow-800">
                    採点結果に相違があります
                  </div>
                  <div className="text-sm text-yellow-700">
                    複数の教員が異なる採点結果を提案しています。最終結果を決定してください。
                  </div>
                </div>
              </div>
            )}

            {/* 最終結果の入力 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Save className="mr-2 h-5 w-5" />
                  最終結果の決定
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="finalScore">得点</Label>
                    <Input
                      id="finalScore"
                      type="number"
                      min="0"
                      max={maxScore}
                      value={finalScore}
                      onChange={(e) =>
                        setFinalScore(parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div>
                    <Label>満点</Label>
                    <Input value={maxScore} disabled />
                  </div>
                </div>
                <div>
                  <Label htmlFor="finalComment">コメント (任意)</Label>
                  <Textarea
                    id="finalComment"
                    placeholder="採点に関するコメントを入力..."
                    value={finalComment}
                    onChange={(e) => setFinalComment(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={finalizing}>
            <X className="mr-1 h-4 w-4" />
            キャンセル
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={finalizing || loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {finalizing ? (
              <>
                <Clock className="mr-1 h-4 w-4 animate-spin" />
                決定中...
              </>
            ) : (
              <>
                <CheckCircle className="mr-1 h-4 w-4" />
                最終決定
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
