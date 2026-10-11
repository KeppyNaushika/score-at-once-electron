"use client"

import { RotateCcwClock } from "lucide-react"
import { useMemo } from "react"

import {
  effortLabelOf,
  RUN_MODE_LABELS,
} from "@/components/common/AiRunOptionToggles"
import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import { cn } from "@/lib/utils"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { AiGradingStage1Purpose } from "@/types/aiGrading.types"

import type { AiGradingRunRow } from "./types"
import {
  numberRunsByPurpose,
  RUN_PURPOSE_LABELS,
  summarizeRunHistory,
} from "./utils/runHistory"

interface AiRunHistorySectionProps {
  /** 出す実行の目的（AI 採点のタブは grade、AI チェックのタブは check） */
  purpose: AiGradingStage1Purpose
  runs: AiGradingRunRow[]
  questionScores: QuestionScoreRow[]
  cropRegionId: string
  currentUserId: string
  points: number | null
  /** 採点指示の id → 採点指示の番号 */
  promptNumberById: ReadonlyMap<string, number>
  /** 一覧に出している実行（null は最新。ほかの目的の実行は選んでいないものとして渡す） */
  chosenRunId: string | null
  onChooseRun: (runId: string | null) => void
}

function formatRate(count: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((count / total) * 100)}%`
}

function formatRunTime(createdAt: Date): string {
  return new Date(createdAt).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** 見出し（「採点の履歴」「チェックの履歴」） */
const HISTORY_TITLES: Record<AiGradingStage1Purpose, string> = {
  grade: "採点の履歴",
  check: "チェックの履歴",
}

/**
 * 設問の実行の履歴（設計 §3-3・§10）。AI 採点・AI チェックのタブの下に、そのタブの目的の
 * 自分の実行を新しい順に並べ（番号は目的ごとに古い順に 1 から）、押した実行の判定を
 * 一覧に出す（その実行に判定の無い答案は、いつもどおり最新の判定）。一致率は自分の採点と
 * 同じ判定だった割合で、設定の良し悪しを見比べるのに使う
 */
export function AiRunHistorySection({
  purpose,
  runs,
  questionScores,
  cropRegionId,
  currentUserId,
  points,
  promptNumberById,
  chosenRunId,
  onChooseRun,
}: AiRunHistorySectionProps) {
  const runHistory = useMemo(
    () =>
      summarizeRunHistory({
        runs,
        questionScores,
        cropRegionId,
        currentUserId,
        points,
      }),
    [runs, questionScores, cropRegionId, currentUserId, points]
  )
  const runNumberById = useMemo(
    () => numberRunsByPurpose(runHistory),
    [runHistory]
  )
  const purposeHistory = runHistory.filter(
    (entry) => entry.run.purpose === purpose
  )
  if (purposeHistory.length === 0) return null

  const rowClassName = (isChosen: boolean) =>
    cn(
      "w-full rounded border px-2 py-1 text-left text-xs",
      isChosen
        ? "border-primary bg-primary/10"
        : "border-transparent hover:bg-muted"
    )

  return (
    <SidePanelSection icon={RotateCcwClock} title={HISTORY_TITLES[purpose]}>
      <p className="mb-1 text-[10px] text-muted-foreground">
        押すと、その判定を一覧に出します。一致は自分の採点との一致率です
      </p>
      <div className="space-y-0.5" role="group" aria-label="一覧に出す実行">
        <button
          type="button"
          aria-pressed={chosenRunId === null}
          className={rowClassName(chosenRunId === null)}
          onClick={() => onChooseRun(null)}
        >
          答案ごとに最新の判定
        </button>
        {purposeHistory.map((entry) => {
          const { run } = entry
          const isChosen = run.id === chosenRunId
          const promptNumber = promptNumberById.get(run.promptId)
          return (
            <button
              key={run.id}
              type="button"
              aria-pressed={isChosen}
              className={rowClassName(isChosen)}
              onClick={() => onChooseRun(run.id)}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="tabular-nums">
                  <span className="font-medium">
                    {RUN_PURPOSE_LABELS[purpose]} {runNumberById.get(run.id)}
                  </span>
                  {promptNumber !== undefined && `・指示 ${promptNumber}`}
                  <span className="ml-1 text-muted-foreground">
                    {formatRunTime(run.createdAt)}
                  </span>
                </span>
                <span className="tabular-nums">
                  一致 {formatRate(entry.exactMatchCount, entry.comparedCount)}
                </span>
              </span>
              <span className="flex items-baseline justify-between gap-2 text-muted-foreground">
                <span className="truncate font-mono">
                  {run.model}
                  {run.effort !== "" && ` / ${effortLabelOf(run.effort)}`}
                  {` / ${RUN_MODE_LABELS[run.mode]}`}
                </span>
                <span className="shrink-0 tabular-nums">
                  判定 {entry.succeededCount}/{entry.attemptCount}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </SidePanelSection>
  )
}
