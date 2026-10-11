/**
 * AI 採点（VLM 採点）の、DB に String で保存する列の値の集合の唯一の定義源。
 *
 * SQLite(Prisma) は enum を持たないので、`AiGradingRun` / `AiGradingAttempt` の文字列の列が
 * 取りうる値はここにしか無い（docs/vlm-grading-design.md §4-2）。境界（lib の返り値）で
 * `to*` を通して union へ倒し、renderer は union として扱う。
 *
 * AI の判定そのもの（`AiGradingAttempt.status`）は QuestionScore と同じ `ScoringStatus`
 * （`scoringStatus.types.ts`）なので、ここには置かない。
 */

import { defineStringUnion } from "./stringUnion"

/**
 * 実行の目的。grade は1段目（答案ごとの判定）、group は2段目（1段目の結果から項目の案を作る）。
 * check は採点チェック（採点済みの答案を1段目だけで判定し、教員の採点と手元で比べる。
 * 2段目は続けない。教員の点は送らない）。
 * revise は廃止したプロンプトの改訂で、過去の行（費用の集計に残る）を読むためだけに残す
 */
export const AI_GRADING_RUN_PURPOSES = [
  "grade",
  "group",
  "check",
  "revise",
] as const
export type AiGradingRunPurpose = (typeof AI_GRADING_RUN_PURPOSES)[number]
export const { is: isAiGradingRunPurpose, to: toAiGradingRunPurpose } =
  defineStringUnion(AI_GRADING_RUN_PURPOSES, "grade")

/** 答案ごとに画像を送って判定させる（1段目の）実行の目的。採点（grade）と採点チェック（check） */
export const AI_GRADING_STAGE1_PURPOSES = ["grade", "check"] as const
export type AiGradingStage1Purpose = (typeof AI_GRADING_STAGE1_PURPOSES)[number]

/** 答案ごとの判定（試行）を持つ実行か（採点・採点チェック） */
export function isStage1RunPurpose(
  purpose: string
): purpose is AiGradingStage1Purpose {
  return AI_GRADING_STAGE1_PURPOSES.some((stage1) => stage1 === purpose)
}

/**
 * 案の外の問いかけ（採点チェック・どの案にも入らない答案）への答えの種類（`AiAttemptResponse.choice`）。
 * rescore はその判定に直す、keep はこのままにする、manual は1件ずつ自分で採点する。
 * 外れ値は keep に倒す（教員の採点を勝手に変えない側）
 */
export const AI_ATTEMPT_RESPONSE_CHOICES = [
  "rescore",
  "keep",
  "manual",
] as const
export type AiAttemptResponseChoice =
  (typeof AI_ATTEMPT_RESPONSE_CHOICES)[number]
export const { is: isAiAttemptResponseChoice, to: toAiAttemptResponseChoice } =
  defineStringUnion(AI_ATTEMPT_RESPONSE_CHOICES, "keep")

/** 送り方。1件ずつすぐ返るか、事業者のバッチに預けるか */
export const AI_GRADING_RUN_MODES = ["realtime", "batch"] as const
export type AiGradingRunMode = (typeof AI_GRADING_RUN_MODES)[number]
export const { is: isAiGradingRunMode, to: toAiGradingRunMode } =
  defineStringUnion(AI_GRADING_RUN_MODES, "realtime")

/**
 * 送る画像の拡大率。常に原寸（1）で送り、利用者には選ばせない。
 * 拡大しても画像の情報は増えない。縮小は読み取りへの影響を目で確かめてから入れる。
 * run の `imageScale` 列と main の切り出しの引数は、そのときのために残している
 */
export const AI_GRADING_SENDING_IMAGE_SCALE = 1

/**
 * 実行の状態。queued → submitting → in_progress → ended が正常の流れで、
 * canceled / failed / expired は途中で終わったもの。
 * 外れ値は failed に倒す（知らない状態の実行を「まだ動いている」と見せないため）
 */
export const AI_GRADING_RUN_STATUSES = [
  "queued",
  "submitting",
  "in_progress",
  "ended",
  "canceled",
  "failed",
  "expired",
] as const
export type AiGradingRunStatus = (typeof AI_GRADING_RUN_STATUSES)[number]
export const { is: isAiGradingRunStatus, to: toAiGradingRunStatus } =
  defineStringUnion(AI_GRADING_RUN_STATUSES, "failed")

/**
 * 試行（答案1件への1回の判定）の送信の成否。採点の判定（ScoringStatus）とは別のもの。
 * 外れ値は errored に倒す（要確認に回す側）
 */
export const AI_GRADING_ATTEMPT_STATES = [
  "pending",
  "succeeded",
  "errored",
  "refused",
  "expired",
] as const
export type AiGradingAttemptState = (typeof AI_GRADING_ATTEMPT_STATES)[number]
export const { is: isAiGradingAttemptState, to: toAiGradingAttemptState } =
  defineStringUnion(AI_GRADING_ATTEMPT_STATES, "errored")

/** AI が自分の判定に付ける確信度。外れ値は low に倒す（要確認を優先表示する側） */
export const AI_GRADING_CONFIDENCES = ["high", "medium", "low"] as const
export type AiGradingConfidence = (typeof AI_GRADING_CONFIDENCES)[number]
export const { is: isAiGradingConfidence, to: toAiGradingConfidence } =
  defineStringUnion(AI_GRADING_CONFIDENCES, "low")

/** 事業者。openai_compatible はローカル LLM を含む OpenAI 互換の接続先 */
export const AI_GRADING_PROVIDERS = [
  "anthropic",
  "openai",
  "gemini",
  "openai_compatible",
] as const
export type AiGradingProvider = (typeof AI_GRADING_PROVIDERS)[number]
export const { is: isAiGradingProvider, to: toAiGradingProvider } =
  defineStringUnion(AI_GRADING_PROVIDERS, "anthropic")

/**
 * 実行の進み具合。main が試行を1件書くたびに `aiGrading:run-progress` で全ウィンドウへ
 * 押し出す（OMR の一括認識と同じ形）。件数は進捗の表示のためだけのもので、結果そのものは
 * 実行の一覧（試行の行）を取り直して読む
 */
export interface AiGradingRunProgress {
  runId: string
  cropRegionId: string
  status: AiGradingRunStatus
  /** 試行の数 */
  total: number
  /** 結果を書いた試行の数（成否を問わない） */
  completed: number
  /** 判定が出た試行の数 */
  succeeded: number
  /** 失敗・拒否・期限切れの試行の数 */
  failed: number
}
