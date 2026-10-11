"use client"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { formatKeyForDisplay } from "@/lib/shortcutCatalog"

import { AiQuestioningOptions } from "./AiQuestioningOptions"
import type { QuestioningFlow } from "./hooks/useQuestioningFlow"
import type { QuestioningStepState } from "./utils/questioningSteps"

interface AiQuestioningCardProps {
  state: QuestioningStepState
  position: number
  total: number
  flow: QuestioningFlow
}

/**
 * いまの問い1つ（docs/vlm-grading-design.md §3-5）。左パネルに、見出し・問い・選択肢・「戻る」「次へ」を
 * 縦に並べる。問いに入る答案は中央の一覧で見る（一覧をこの問いの答案に絞り、付く予定の点を斜線で重ねる）
 */
export function AiQuestioningCard({
  state,
  position,
  total,
  flow,
}: AiQuestioningCardProps) {
  const { step } = state
  const { keyBindings } = useKeyBindings()
  const keyOf = (commandId: string) =>
    formatKeyForDisplay(keyBindings[commandId], "Alt")

  return (
    <section
      aria-label={`問いかけ: ${step.title}`}
      className="space-y-2 rounded border border-gray-200 p-2"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-medium text-gray-800">{step.title}</h3>
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {position} / {total}
        </span>
      </div>
      <p className="text-gray-700">{step.question}</p>
      {step.detail && <p className="text-gray-500">{step.detail}</p>}
      <AiQuestioningOptions state={state} flow={flow} />
      {flow.nextBlockedReason && (
        <p className="text-orange-800">{flow.nextBlockedReason}</p>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={flow.goToPrevious}
          disabled={!flow.canGoToPrevious}
        >
          戻る
          <Kbd variant="tiny">{keyOf("choice.prevQuestion")}</Kbd>
        </Button>
        <Button
          size="sm"
          className="text-xs"
          onClick={flow.goToNext}
          disabled={flow.nextBlockedReason !== null}
        >
          {flow.startsManualOnNext ? "1件ずつ採点を始める" : "次へ"}
          <Kbd variant="tiny" className="bg-white/20">
            {keyOf("choice.nextQuestion")}
          </Kbd>
        </Button>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span>
          <Kbd variant="tiny">{keyOf("choice.prev")}</Kbd>
          <Kbd variant="tiny">{keyOf("choice.next")}</Kbd>
          ・クリックで選ぶ
        </span>
        <span>
          <Kbd variant="tiny">{keyOf("choice.confirm")}</Kbd> でも決めて次へ
        </span>
        <span>
          <Kbd variant="tiny">{keyOf("choice.nextQuestion")}</Kbd>
          <Kbd variant="tiny">{keyOf("choice.prevQuestion")}</Kbd>{" "}
          は欄の中でも効く
        </span>
      </p>
    </section>
  )
}
