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
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"
import { finalizeQuestionScoreMutation } from "@/queries/scoring"
import type {
  ScoreDecisionCell,
  ScoreProposal,
} from "@/types/scoreDecision.types"
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

/**
 * 同じ結果を出した採点者を1つにまとめたもの。
 *
 * 確定は「結果を選ぶ」操作であって「人を選ぶ」操作ではない。2人が同じ「正答」を
 * 付けていたら、どちらを採用したのかは決められないし、決める意味も無い。
 * よって選択の単位は判定＋点で、その結果を出した人は横に並ぶだけにする。
 */
interface ProposedResult {
  status: ScoringStatus
  partialScore: number | null
  /** status と partialScore から算出した実得点（束の中では全員同じ） */
  scoreValue: number | null
  /** この結果を出した採点者（表示のみ。選択の対象にしない） */
  proposals: ScoreProposal[]
}

/** 判定と点が同じ提案は1つの結果として扱う（束ねるのは renderer 側の計算） */
function groupProposalsByResult(proposals: ScoreProposal[]): ProposedResult[] {
  const resultByKey = new Map<string, ProposedResult>()
  for (const proposal of proposals) {
    const key = `${proposal.status}:${proposal.partialScore ?? ""}`
    const result = resultByKey.get(key)
    if (result) {
      result.proposals.push(proposal)
    } else {
      resultByKey.set(key, {
        status: proposal.status,
        partialScore: proposal.partialScore,
        scoreValue: proposal.scoreValue,
        proposals: [proposal],
      })
    }
  }
  return [...resultByKey.values()]
}

/** 結果を表す文字列（判定＋点）。行の同一性そのものなので React の key に使う */
const resultKey = (result: ProposedResult): string =>
  `${result.status}:${result.partialScore ?? ""}`

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
  const currentUser = useCurrentUser()
  const finalizeQuestionScore = useMutation(
    finalizeQuestionScoreMutation(examId)
  )

  // 呼び出し側（ScoreDecisionPanel）がセルごとの key でこのフォームを作り直すため、
  // 既存の確定（あれば）を初期値としてそのまま state に置ける。
  const initial = toInitialFormValues(cell)
  const [verdict, setVerdict] = useState<ScoringStatus>(initial.verdict)
  const [score, setScore] = useState(initial.score)
  const [comment, setComment] = useState(initial.comment)
  const deciding = finalizeQuestionScore.isPending

  const needsScore = NEEDS_SCORE.includes(verdict)
  const parsedScore = score === "" ? null : Number(score)
  const proposedResults = groupProposalsByResult(cell.proposals)
  const scoreIsInvalid =
    needsScore &&
    (parsedScore === null ||
      Number.isNaN(parsedScore) ||
      parsedScore < 0 ||
      parsedScore > maxScore)

  const handleDecide = async () => {
    try {
      await finalizeQuestionScore.mutateAsync({
        examStudentId: cell.examStudentId,
        cropRegionId: cell.cropRegionId,
        decidedByUserId: currentUser.id,
        verdict,
        // 点を持たない判定と、コメント無しは null を明示する
        // （省略で消える形にしない）
        score: needsScore ? (parsedScore ?? 0) : null,
        comment: comment === "" ? null : comment,
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

        {/* 出そろった結果（同じ結果を出した採点者は1行に束ねる） */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">
            出そろった結果（{proposedResults.length}通り・採点者
            {cell.proposals.length}人）
          </div>
          {proposedResults.map((result) => (
            <div
              key={resultKey(result)}
              className="rounded-lg border border-gray-200 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {SCORING_STATUS_LABELS[result.status]}
                  </Badge>
                  <span className="font-semibold">
                    {result.scoreValue ?? "-"} / {maxScore} 点
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canDecide}
                  onClick={() => {
                    setVerdict(result.status)
                    setScore(
                      result.partialScore !== null
                        ? String(result.partialScore)
                        : ""
                    )
                  }}
                >
                  この結果にする
                </Button>
              </div>
              <ul className="mt-2 space-y-1">
                {result.proposals.map((proposal) => (
                  <li key={proposal.questionScoreId} className="text-xs">
                    <div className="truncate text-gray-500">
                      {proposal.userName} ・{" "}
                      {formatDateTime(proposal.updatedAt)}
                    </div>
                    {/* 同じ結果でも、そこに至った理由は人ごとに違う。
                        束ねた見出しではなく採点者ごとに出す */}
                    {proposal.comment !== "" && (
                      <p className="mt-0.5 whitespace-pre-wrap text-gray-700">
                        {proposal.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
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
                onClick={() => setVerdict(candidate)}
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
                onChange={(event) => setScore(event.target.value)}
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
