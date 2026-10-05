"use client"

import { ScanSearch } from "lucide-react"

import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"

import { AiAnswerHeading } from "./AiAnswerHeading"
import { AiAttemptDetail } from "./AiAttemptDetail"
import { AiAttemptNavigator } from "./AiAttemptNavigator"
import type { AiGridItem } from "./types"

interface AiSelectedJudgementSectionProps {
  /** 1つだけ選んでいる答案。0件・複数なら null */
  singleSelectedItem: AiGridItem | null
  /** プロンプトの id → 版の番号（古い順に 1 から） */
  promptNumberById: ReadonlyMap<string, number>
  /** 古い判定へ（`<`） */
  onPrevAttempt: () => void
  /** 新しい判定へ（`>`） */
  onNextAttempt: () => void
}

/**
 * 「選んだ答案の判定」の節（左パネルの採点反映のタブに置く）。
 * 答案を1つだけ選んでいるとき、点を採用するかを決めるために AI の判定・読み取り・理由を見せる。
 * 表示する試行はアノテーション反映のタブの詳細と同じ（`review.displayedAttempt`）。
 * 朱書きを直すのはアノテーション反映のタブの役目で、ここでは見せるだけ
 */
export function AiSelectedJudgementSection({
  singleSelectedItem,
  promptNumberById,
  onPrevAttempt,
  onNextAttempt,
}: AiSelectedJudgementSectionProps) {
  return (
    <SidePanelSection icon={ScanSearch} title="選んだ答案の判定">
      {singleSelectedItem ? (
        <div className="space-y-3 py-2" aria-label="選んだ答案の AI の判定">
          <AiAnswerHeading gridItem={singleSelectedItem} />
          <SelectedJudgementBody
            gridItem={singleSelectedItem}
            promptNumberById={promptNumberById}
            onPrevAttempt={onPrevAttempt}
            onNextAttempt={onNextAttempt}
          />
        </div>
      ) : (
        <p className="py-2 text-xs text-muted-foreground">
          答案を1つだけ選ぶと、AI の判定と理由が見られます
        </p>
      )}
    </SidePanelSection>
  )
}

type SelectedJudgementBodyProps = Omit<
  AiSelectedJudgementSectionProps,
  "singleSelectedItem"
> & {
  gridItem: AiGridItem
}

/** 表示中の試行の見比べと中身。試行が無ければその旨 */
function SelectedJudgementBody({
  gridItem,
  promptNumberById,
  onPrevAttempt,
  onNextAttempt,
}: SelectedJudgementBodyProps) {
  const { answer, review } = gridItem.reviewedAnswer
  const displayedAttempt = review.displayedAttempt
  if (!displayedAttempt) {
    return (
      <p className="text-sm text-muted-foreground">
        この答案にはまだ AI の判定がありません
      </p>
    )
  }
  return (
    <>
      <AiAttemptNavigator
        attempts={answer.attempts}
        displayedAttempt={displayedAttempt}
        onPrevAttempt={onPrevAttempt}
        onNextAttempt={onNextAttempt}
      />
      <AiAttemptDetail
        attemptWithRun={displayedAttempt}
        promptNumber={
          promptNumberById.get(displayedAttempt.run.promptId) ?? null
        }
        isFromOtherPrompt={review.isFromOtherPrompt}
      />
    </>
  )
}
