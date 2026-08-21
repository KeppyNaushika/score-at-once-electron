"use client"

import { useMutation } from "@tanstack/react-query"
import { CheckCircle, Clock, Info } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"
import { finalizeQuestionScoreMutation } from "@/queries/scoring"
import type { ScoreDecisionCell } from "@/types/scoreDecision.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/** 確定できる判定（未採点は確定の対象にならない） */
const VERDICTS: ScoringStatus[] = [
  "correct",
  "partial",
  "pending",
  "incorrect",
  "no_answer",
  "double_mark",
]

/** 点数の手入力が必要な判定（他は判定自体が点数を決める） */
const NEEDS_SCORE: ScoringStatus[] = ["partial", "pending"]

const formatDateTime = (isoString: string): string =>
  new Date(isoString).toLocaleString("ja-JP")

interface ScoreDecisionFormProps {
  examId: string
  cell: ScoreDecisionCell
  questionLabel: string
  maxScore: number
  canDecide: boolean
  onDecided: () => void
}

/** 既存の確定があればそれを、無ければ先頭の提案をフォームの初期値にする */
function toInitialFormValues(cell: ScoreDecisionFormProps["cell"]) {
  if (cell.decision) {
    return {
      verdict: cell.decision.verdict,
      score: cell.decision.score !== null ? String(cell.decision.score) : "",
      comment: cell.decision.comment ?? "",
      sourceQuestionScoreId: cell.decision.sourceQuestionScoreId,
    }
  }

  const firstProposal = cell.proposals[0]
  return {
    verdict: firstProposal?.status ?? "correct",
    score:
      firstProposal?.partialScore !== null &&
      firstProposal?.partialScore !== undefined
        ? String(firstProposal.partialScore)
        : "",
    comment: "",
    sourceQuestionScoreId: firstProposal?.questionScoreId ?? null,
  }
}

/**
 * 1セル分の比較・確定フォーム（裁定パネルの右ペイン）。
 *
 * 表示に必要な提案・既存確定はサマリに同梱されているため、ここでは再取得しない。
 */
export function ScoreDecisionForm({
  examId,
  cell,
  questionLabel,
  maxScore,
  canDecide,
  onDecided,
}: ScoreDecisionFormProps) {
  const { user } = useAuth()
  const finalizeQuestionScore = useMutation(
    finalizeQuestionScoreMutation(examId)
  )

  // 呼び出し側（ScoreDecisionPanel）がセルごとの key でこのフォームを作り直すため、
  // 既存の確定（あれば）を初期値としてそのまま state に置ける。
  const initial = toInitialFormValues(cell)
  const [verdict, setVerdict] = useState<ScoringStatus>(initial.verdict)
  const [score, setScore] = useState(initial.score)
  const [comment, setComment] = useState(initial.comment)
  const [sourceQuestionScoreId, setSourceQuestionScoreId] = useState<
    string | null
  >(initial.sourceQuestionScoreId)
  const deciding = finalizeQuestionScore.isPending

  const needsScore = NEEDS_SCORE.includes(verdict)
  const parsedScore = score === "" ? null : Number(score)
  const scoreIsInvalid =
    needsScore &&
    (parsedScore === null ||
      Number.isNaN(parsedScore) ||
      parsedScore < 0 ||
      parsedScore > maxScore)

  const handleDecide = async () => {
    if (!user) return
    try {
      await finalizeQuestionScore.mutateAsync({
        examStudentId: cell.examStudentId,
        cropRegionId: cell.cropRegionId,
        decidedByUserId: user.id,
        verdict,
        // 点を持たない判定と、コメント無し・採用元なしは null を明示する
        // （省略で消える形にしない）
        score: needsScore ? (parsedScore ?? 0) : null,
        comment: comment === "" ? null : comment,
        sourceQuestionScoreId,
      })
      toast.success("採点結果を確定しました")
      onDecided()
    } catch {
      // 失敗の通知は MutationCache の後始末が出す
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="text-base font-semibold">{cell.studentName}</div>
        <div className="text-sm text-gray-500">
          {questionLabel}（{maxScore}点）
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {cell.reason === "stale" && cell.decision && (
          <div className="flex gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
            <div className="text-yellow-800">
              <div className="font-medium">確定後に新しい採点が入りました</div>
              <div className="text-yellow-700">
                現在は {formatDateTime(cell.decision.decidedAt)} の確定値が出力
                されます。内容を確認し、必要なら再確定してください。
              </div>
            </div>
          </div>
        )}

        {cell.reason === "conflict" && (
          <div className="flex gap-2 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
            <div className="text-purple-800">
              採点者間で結果が食い違っているため、このセルは
              <span className="font-medium">未採点として出力されます</span>
              （合計点が最大 {cell.scoreImpact} 点低く出ます）。
            </div>
          </div>
        )}

        {/* 採点者ごとの提案 */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">
            採点者ごとの結果（{cell.proposals.length}件）
          </div>
          {cell.proposals.map((proposal) => (
            <div
              key={proposal.questionScoreId}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                sourceQuestionScoreId === proposal.questionScoreId
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-200"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {SCORING_STATUS_LABELS[proposal.status]}
                  </Badge>
                  <span className="font-semibold">
                    {proposal.scoreValue ?? "-"} / {maxScore} 点
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-gray-500">
                  {proposal.userName} ・ {formatDateTime(proposal.updatedAt)}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!canDecide}
                onClick={() => {
                  setVerdict(proposal.status)
                  setScore(
                    proposal.partialScore !== null
                      ? String(proposal.partialScore)
                      : ""
                  )
                  setSourceQuestionScoreId(proposal.questionScoreId)
                }}
              >
                採用
              </Button>
            </div>
          ))}
        </div>

        {/* 確定内容 */}
        <div className="space-y-3 rounded-lg border border-gray-200 p-3">
          <div className="text-sm font-medium text-gray-700">確定する判定</div>
          <div className="grid grid-cols-3 gap-2">
            {VERDICTS.map((candidate) => (
              <Button
                key={candidate}
                size="sm"
                variant={verdict === candidate ? "default" : "outline"}
                disabled={!canDecide}
                onClick={() => {
                  setVerdict(candidate)
                  // 手動で判定を変えたら採用元の紐付けを解除する
                  setSourceQuestionScoreId(null)
                }}
              >
                {SCORING_STATUS_LABELS[candidate]}
              </Button>
            ))}
          </div>

          {needsScore && (
            <div>
              <Label htmlFor="decisionScore">得点（0〜{maxScore}）</Label>
              <Input
                id="decisionScore"
                type="number"
                min={0}
                max={maxScore}
                value={score}
                disabled={!canDecide}
                onChange={(event) => {
                  setScore(event.target.value)
                  setSourceQuestionScoreId(null)
                }}
              />
            </div>
          )}

          <div>
            <Label htmlFor="decisionComment">コメント（任意）</Label>
            <Textarea
              id="decisionComment"
              rows={2}
              value={comment}
              disabled={!canDecide}
              placeholder="裁定の理由など"
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 py-3">
        {canDecide ? (
          <Button
            className="w-full"
            onClick={handleDecide}
            disabled={deciding || scoreIsInvalid}
          >
            {deciding ? (
              <>
                <Clock className="mr-1 h-4 w-4 animate-spin" />
                確定中...
              </>
            ) : (
              <>
                <CheckCircle className="mr-1 h-4 w-4" />
                この内容で確定する
              </>
            )}
          </Button>
        ) : (
          <p className="text-center text-sm text-gray-500">
            採点結果の確定は試験の所有者（OWNER）のみが行えます
          </p>
        )}
      </div>
    </div>
  )
}
