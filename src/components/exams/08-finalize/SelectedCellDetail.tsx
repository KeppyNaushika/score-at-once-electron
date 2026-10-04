"use client"

import { MessageSquare, NotebookPen } from "lucide-react"
import { useRef, useState } from "react"

import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { getDynamicScoreStatusConfig } from "@/components/exams/07-score-at-once/ScoringGrid/constants/scoreStatusConfig"
import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import type { DecisionGridItem } from "@/components/exams/08-finalize/hooks/useFinalizeData"
import { groupProposalsByResult } from "@/components/exams/08-finalize/utils/proposedResults"
import { Textarea } from "@/components/ui/textarea"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"

interface SelectedCellDetailProps {
  /** 選んでいる答案（1つだけ選んでいるとき） */
  item: DecisionGridItem | null
  /** 選んでいる答案の数 */
  selectedCount: number
  maxScore: number
  comment: string
  onCommentChange: (comment: string) => void
  /** 確定済みの答案の覚え書きを書き直す */
  onCommentCommit: () => void
  editable: boolean
}

const formatDateTime = (isoString: string): string =>
  new Date(isoString).toLocaleString("ja-JP")

/**
 * 選んでいる答案の、採点者ごとの理由と確定の覚え書き。
 *
 * 一覧の答案の下には色と点しか出さないので、**なぜその点なのか**はここで読む
 * （07 は自分の採点だけを見せる画面なので、他の教員の覚え書きが読めるのはここだけ）。
 *
 * 覚え書きの出入りは 07 の覚え書きと同じ: K で入る・Esc で捨てて戻る・
 * ⌘/Ctrl+Enter か欄の外で残して戻る。まだ確定していない答案では、書いた覚え書きは
 * 次に判定キーで確定するときに一緒に書かれる。
 */
export function SelectedCellDetail({
  item,
  selectedCount,
  maxScore,
  comment,
  onCommentChange,
  onCommentCommit,
  editable,
}: SelectedCellDetailProps) {
  const { keyBindings } = useKeyBindings()
  const statusConfig = getDynamicScoreStatusConfig(useScoringStatusColors())
  // ショートカットから欄へ入るので、DOM が生えたことを描画で知る
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null)
  // Esc で出るときは、続く blur で書きかけを保存しない（07 の覚え書きと同じ理由）
  const discardOnBlur = useRef(false)

  const savedComment = item?.cell.decision?.comment ?? ""

  useSceneCommand(
    "scoring.comment",
    () => {
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    },
    {
      condition: "hasSelectedAnswers",
      metadata: { title: "確定の覚え書きを書く", category: "確定" },
    }
  )

  if (!item) {
    return (
      <SidePanelSection icon={MessageSquare} title="採点者の結果">
        <p className="text-xs text-gray-500">
          {selectedCount > 1
            ? `${selectedCount}件を選んでいます。判定キーでまとめて確定します（覚え書きはそれぞれの答案のまま）`
            : "答案を選ぶと、採点者ごとの結果と理由を表示します"}
        </p>
      </SidePanelSection>
    )
  }

  const { cell } = item

  return (
    <>
      <SidePanelSection
        icon={MessageSquare}
        title="採点者の結果"
        rightElement={
          <span className="truncate text-xs font-medium">
            {cell.studentName}
          </span>
        }
      >
        {cell.reason === "stale" && cell.decision && (
          <p className="mb-2 rounded bg-yellow-50 px-2 py-1 text-[11px] text-yellow-800">
            確定（{formatDateTime(cell.decision.decidedAt)}）の後に新しい採点が
            入りました。確かめて、必要なら確定し直してください
          </p>
        )}
        <ul className="space-y-1.5">
          {groupProposalsByResult(cell.proposals).map((result) => {
            const config = statusConfig[result.status]
            const Icon = config.icon
            return (
              <li key={result.key} className="text-xs">
                <div className="flex items-center gap-1">
                  <Icon
                    className="h-3.5 w-3.5 shrink-0"
                    style={config.iconStyle}
                  />
                  <span className="font-medium">
                    {SCORING_STATUS_LABELS[result.status]}{" "}
                    {result.scoreValue ?? "-"}/{maxScore}点
                  </span>
                </div>
                <ul className="mt-0.5 space-y-0.5 pl-4.5">
                  {/* 同じ結果でも、そこに至った理由は人ごとに違う */}
                  {result.proposals.map((proposal) => (
                    <li key={proposal.questionScoreId}>
                      <span className="text-gray-500">{proposal.userName}</span>
                      {proposal.comment !== "" && (
                        <p className="whitespace-pre-wrap text-gray-800">
                          {proposal.comment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
        {cell.decision && (
          <p className="mt-2 text-[10px] text-gray-500">
            確定: {SCORING_STATUS_LABELS[cell.decision.verdict]}（
            {cell.decision.decidedByName}・
            {formatDateTime(cell.decision.decidedAt)}）
          </p>
        )}
      </SidePanelSection>

      <SidePanelSection icon={NotebookPen} title="確定の覚え書き">
        <Textarea
          ref={setTextarea}
          value={comment}
          disabled={!editable}
          onChange={(event) => onCommentChange(event.target.value)}
          onBlur={() => {
            if (discardOnBlur.current) {
              discardOnBlur.current = false
              return
            }
            onCommentCommit()
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              discardOnBlur.current = true
              onCommentChange(savedComment)
              textarea?.blur()
              return
            }
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault()
              textarea?.blur()
            }
          }}
          rows={2}
          className="resize-none text-xs"
          placeholder="裁定の理由など（任意）"
        />
        <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
          {keyBindings["scoring.comment"]?.toUpperCase()} で入る・Esc
          で捨てて戻る・⌘/Ctrl+Enter で残して戻る
        </p>
      </SidePanelSection>
    </>
  )
}
