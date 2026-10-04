import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"
import { questionScoresQuery } from "./scoring"

/**
 * AI 採点（VLM 採点）のプロンプト・測定・実行・採用（docs/vlm-grading-design.md §10）。
 *
 * **実行と試行は設問ごとに1本のキーへ載せる。** 採点も採用も「その設問」に書くので、
 * 古くなるのもその設問だけである（採点行と同じ粒度。`scoring.ts`）。
 *
 * 画像の測定（インク率・送る画像の見本・見積もり）は画像と矩形だけで決まり、採点結果に
 * 依存しないので、試験のまとまりの外に置く（白さの測定と同じ。`answerWhitenessQuery`）。
 *
 * 対応する preload は `electron-src/preload-apis/aiGradingApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** 設問のプロンプト（どの教員が作ったものも。作成者付き。古い順） */
export const aiPromptsQuery = (examId: string, cropRegionId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "aiPrompts", cropRegionId] as const,
    queryFn: () => window.electronAPI.aiGrading.listPrompts(cropRegionId),
  })

/** 設問の実行と試行の全部を指す前方一致（自分の分も全員の分も） */
const aiGradingRunsScope = (examId: string, cropRegionId: string) =>
  [...scopeKeys.exam(examId), "aiGradingRuns", cropRegionId] as const

/**
 * 設問の実行と試行（古い順）。
 *
 * 07 は自分の採点だけを見せるので、既定では自分の実行だけを読む
 * （`includeOtherUsers` で全員の分）。
 */
export const aiGradingRunsQuery = (
  examId: string,
  cropRegionId: string,
  includeOtherUsers: boolean
) =>
  queryOptions({
    queryKey: [
      ...aiGradingRunsScope(examId, cropRegionId),
      includeOtherUsers,
    ] as const,
    queryFn: () =>
      window.electronAPI.aiGrading.listRuns(cropRegionId, includeOtherUsers),
  })

/**
 * 模範解答の下書きの元（解答用紙の小問・枝問とテキスト要素の木）。
 * ラベルの照合と `||…||` の抽出は画面で行う
 */
export const asbModelAnswerSourceQuery = (asbDefinitionId: string) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.answerSheetDefinition(asbDefinitionId),
      "aiModelAnswerSource",
    ] as const,
    queryFn: () =>
      window.electronAPI.aiGrading.getAsbModelAnswerSource(asbDefinitionId),
  })

/**
 * 設問のある答案すべてのインク率・はみ出し・占有グリッド（白紙の除外と注釈の配置に使う）。
 *
 * キーの `measurementSignature` は測るもの全部（答案の id と画像パス、設問の矩形）を
 * 表す文字列で、呼び出し側が作る。画像を読み直すので重く、採点を書いても測り直さない
 */
export const aiAnswerInkQuery = (
  cropRegionId: string,
  measurementSignature: string
) =>
  queryOptions({
    queryKey: ["aiAnswerInk", cropRegionId, measurementSignature] as const,
    queryFn: () => window.electronAPI.aiGrading.measureInk(cropRegionId),
  })

/** 答案1件について、送る画像そのもの（PNG の data URL） */
export const aiSendingCropPreviewQuery = (
  input: Parameters<typeof window.electronAPI.aiGrading.previewCrop>[0]
) =>
  queryOptions({
    queryKey: [
      "aiSendingCropPreview",
      input.cropRegionId,
      input.examStudentId,
      input.imageScale,
    ] as const,
    queryFn: () => window.electronAPI.aiGrading.previewCrop(input),
  })

/**
 * 見積もりの材料（送る画像の大きさ）。トークン数と金額は画面が事業者ごとの式で求める。
 * 対象の答案は並びを問わないので、キーには並べ替えた id を入れる
 */
export const aiRunEstimateQuery = (
  input: Parameters<typeof window.electronAPI.aiGrading.estimateRun>[0]
) =>
  queryOptions({
    queryKey: [
      "aiRunEstimate",
      input.promptId,
      input.imageScale,
      [...input.examStudentIds].sort().join(","),
    ] as const,
    queryFn: () => window.electronAPI.aiGrading.estimateRun(input),
  })

// =====================================================================
// 書き込み
// =====================================================================

/** プロンプトを1行作る（直すときも新しい行。書き換え・削除の口は無い） */
export const createAiPromptMutation = (examId: string, cropRegionId: string) =>
  defineMutation({
    mutationFn: (
      data: Parameters<typeof window.electronAPI.aiGrading.createPrompt>[0]
    ) => window.electronAPI.aiGrading.createPrompt(data),
    scope: { id: `exam:${examId}:aiPrompts:${cropRegionId}` },
    meta: {
      invalidates: [aiPromptsQuery(examId, cropRegionId).queryKey],
      errorMessage: "プロンプトを保存できませんでした",
    },
  })

/** VLM にプロンプトを改訂させる（外部へ送る）。できたプロンプトの行が返る */
export const reviseAiPromptMutation = (examId: string, cropRegionId: string) =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.aiGrading.revisePrompt>[0]
    ) => window.electronAPI.aiGrading.revisePrompt(input),
    scope: { id: `exam:${examId}:aiPrompts:${cropRegionId}` },
    meta: {
      invalidates: [
        aiPromptsQuery(examId, cropRegionId).queryKey,
        aiGradingRunsScope(examId, cropRegionId),
      ],
      errorMessage: "プロンプトを改訂できませんでした",
    },
  })

/**
 * 採点を始める（外部へ送る）。run と試行が返り、その場の採点は裏で続く。
 * 進み具合は `subscribeAiGradingRunProgress` で届くので、届いたら実行の一覧を取り直す
 */
export const startAiGradingRunMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.aiGrading.startRun>[0]
    ) => window.electronAPI.aiGrading.startRun(input),
    meta: {
      invalidates: [aiGradingRunsScope(examId, cropRegionId)],
      errorMessage: "AI 採点を始められませんでした",
    },
  })

/** 実行を中止する（実行した教員だけ） */
export const cancelAiGradingRunMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (runId: string) =>
      window.electronAPI.aiGrading.cancelRun(runId),
    meta: {
      invalidates: [aiGradingRunsScope(examId, cropRegionId)],
      errorMessage: "AI 採点を中止できませんでした",
    },
  })

/** 古い試行を消す（採用済み・結果待ち・他の教員の試行は main が残す）。消した件数が返る */
export const deleteAiGradingAttemptsMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (attemptIds: string[]) =>
      window.electronAPI.aiGrading.deleteAttempts(attemptIds),
    scope: { id: `exam:${examId}:aiGradingRuns:${cropRegionId}` },
    meta: {
      invalidates: [aiGradingRunsScope(examId, cropRegionId)],
      errorMessage: "AI の判定を消せませんでした",
    },
  })

/**
 * 選んだ試行を自分の採点として書く（判定・理由・朱書き）。
 * 採点行と注釈も変わるので、その設問の採点行と注釈も取り直す
 */
export const adoptAiGradingAttemptsMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.aiGrading.adoptAttempts>[0]
    ) => window.electronAPI.aiGrading.adoptAttempts(input),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [
        aiGradingRunsScope(examId, cropRegionId),
        questionScoresQuery(examId, cropRegionId).queryKey,
        scopeKeys.annotation(),
      ],
      errorMessage: "AI の判定を採用できませんでした",
    },
  })

/** 白紙の答案を無答として書く（白紙の判断は画面のインク率） */
export const adoptBlankAnswersMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.aiGrading.adoptBlankAnswers
      >[0]
    ) => window.electronAPI.aiGrading.adoptBlankAnswers(input),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [questionScoresQuery(examId, cropRegionId).queryKey],
      errorMessage: "白紙の答案を無答にできませんでした",
    },
  })

// =====================================================================
// フックの外から呼ぶもの
// =====================================================================

/**
 * 実行の進み具合を購読する（main から押し出される通知なのでキャッシュには載せない）。
 * 戻り値は購読を解く関数
 */
export const subscribeAiGradingRunProgress = (
  onProgress: Parameters<typeof window.electronAPI.aiGrading.onRunProgress>[0]
) => window.electronAPI.aiGrading.onRunProgress(onProgress)
