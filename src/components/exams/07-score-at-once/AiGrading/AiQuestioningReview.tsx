"use client"

import { RotateCcw } from "lucide-react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { formatKeyForDisplay } from "@/lib/shortcutCatalog"

import type { QuestioningReviewSummary } from "./utils/questioningReview"

interface AiQuestioningReviewProps {
  summary: QuestioningReviewSummary
  /** 確定できない理由（無ければ null） */
  blockedReason: string | null
  isCommitting: boolean
  onBack: () => void
  onCommit: () => void
}

/**
 * 見直し（docs/vlm-grading-design.md §3-5。左パネルに出す）。「N件の採点を確定します」と、置き換えと
 * 再採点の知らせだけを出す（問いごとの決めたことは上の問いの一覧で見る）。「確定する」で初めて教員の採点に書く。
 * 「戻る」（問いのカードと同じキー）で最後の問いへ
 */
export function AiQuestioningReview({
  summary,
  blockedReason,
  isCommitting,
  onBack,
  onCommit,
}: AiQuestioningReviewProps) {
  const { scoredExamStudentIds, overwrittenExamStudentIds } = summary
  const { keyBindings } = useKeyBindings()
  return (
    <section
      aria-label="見直し"
      className="space-y-2 rounded border border-gray-200 p-2"
    >
      <h3 className="text-xs font-medium text-gray-800">
        {scoredExamStudentIds.length}件の採点を確定します
      </h3>
      {overwrittenExamStudentIds.length > 0 && (
        <p
          role="note"
          className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800"
        >
          このうち {overwrittenExamStudentIds.length}
          件は採点済みの答案です。確定すると、ここで決めた点に置き換わります。
        </p>
      )}
      {summary.instructionCount > 0 && (
        <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
          <RotateCcw className="mt-0.5 h-3 w-3 shrink-0" />
          「再採点を指示」した {summary.instructionCount}
          問の答案は、確定のあとに指示を添えてもう一度 AI に送れます。
        </p>
      )}
      {blockedReason && (
        <p className="text-[11px] text-orange-800">{blockedReason}</p>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={onBack}
        >
          戻る
          <Kbd variant="tiny">
            {formatKeyForDisplay(keyBindings["choice.prevQuestion"], "Alt")}
          </Kbd>
        </Button>
        <Button
          size="sm"
          className="text-xs"
          onClick={onCommit}
          disabled={
            blockedReason !== null || summary.draftCount === 0 || isCommitting
          }
        >
          確定する
        </Button>
      </div>
    </section>
  )
}
