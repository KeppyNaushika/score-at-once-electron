"use client"

import type { AttemptWithRun } from "./types"
import {
  ATTEMPT_STATE_LABELS,
  confidenceLabel,
  describeJudgement,
  formatShortDateTime,
} from "./utils/answerDisplay"

interface AiAttemptDetailProps {
  attemptWithRun: AttemptWithRun
  /** 選んでいるプロンプトの何番目か（表示用）。無ければ null */
  promptNumber: number | null
  isFromOtherPrompt: boolean
}

/** 表示中の試行の中身（判定・読み取り・所見と、出した実行の設定） */
export function AiAttemptDetail({
  attemptWithRun,
  promptNumber,
  isFromOtherPrompt,
}: AiAttemptDetailProps) {
  const { attempt, run } = attemptWithRun
  return (
    <dl className="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1 text-sm">
      <dt className="text-muted-foreground">判定</dt>
      <dd data-testid="ai-attempt-judgement">
        {attempt.state === "succeeded"
          ? `${describeJudgement(attempt.status, attempt.partialScore)}（確信度 ${confidenceLabel(attempt.confidence)}）`
          : ATTEMPT_STATE_LABELS[attempt.state]}
      </dd>
      {attempt.errorMessage !== "" && (
        <>
          <dt className="text-muted-foreground">エラー</dt>
          <dd className="text-red-700">{attempt.errorMessage}</dd>
        </>
      )}
      <dt className="text-muted-foreground">読み取り</dt>
      <dd className="whitespace-pre-wrap">{attempt.transcription || "—"}</dd>
      {/* 1段目は所見を返す。理由（comment）は所見の無い過去の試行のときだけ出す */}
      <dt className="text-muted-foreground">
        {attempt.observation === "" && attempt.comment !== "" ? "理由" : "所見"}
      </dt>
      <dd className="whitespace-pre-wrap">
        {attempt.observation || attempt.comment || "—"}
      </dd>
      <dt className="text-muted-foreground">プロンプト</dt>
      <dd>
        {promptNumber === null ? "（不明）" : `版 ${promptNumber}`}
        {isFromOtherPrompt && (
          <span className="ml-1 text-xs text-amber-700">
            （選んでいるプロンプトとは別）
          </span>
        )}
      </dd>
      <dt className="text-muted-foreground">実行</dt>
      <dd className="font-mono text-xs">
        {run.model} / {run.effort} / ×{run.imageScale} /{" "}
        {run.mode === "batch" ? "バッチ" : "すぐ"} /{" "}
        {formatShortDateTime(run.createdAt)}
      </dd>
    </dl>
  )
}
