import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"
import { rubricItemInvalidations } from "./rubric"
import { questionScoresQuery } from "./scoring"

/**
 * AI 採点（VLM 採点）のプロンプト・測定・実行（1段目・2段目）・採用・問いかけ
 * （docs/vlm-grading-design.md §3・§11）。
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

/** 試験の全設問の、自分の実行と試行（設問一覧の印に使う） */
const aiGradingRunsOfExamScope = (examId: string) =>
  [...scopeKeys.exam(examId), "aiGradingRunsOfExam"] as const

export const aiGradingRunsOfExamQuery = (examId: string) =>
  queryOptions({
    queryKey: aiGradingRunsOfExamScope(examId),
    queryFn: () => window.electronAPI.aiGrading.listRunsByExam(examId),
  })

/**
 * すべての試験の、自分の実行と試行（試験・設問付き。「AI採点」の画面の
 * 使用トークンに使う）。
 * 試験をまたぐので試験のまとまりの外に置き、実行を書く口がそれぞれ取り直す
 */
export const myAiGradingRunsQuery = () =>
  queryOptions({
    queryKey: ["myAiGradingRuns"] as const,
    queryFn: () => window.electronAPI.aiGrading.listMyRuns(),
  })

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

/** 設問の自分の2段目の実行1件（項目の案・選択肢・答案（試行付き）・答えの木） */
export type AiRubricProposalRunRow = Awaited<
  ReturnType<typeof window.electronAPI.aiGrading.listProposals>
>[number]

/**
 * 設問の、自分の2段目の実行と項目の案（古い順）。問いかけは実行した教員にだけ出すので、
 * 自分の分だけを読む。2段目は1段目のあとに自動で続くので、進み具合の通知でも取り直す
 */
export const aiRubricProposalsQuery = (examId: string, cropRegionId: string) =>
  queryOptions({
    queryKey: [
      ...aiGradingRunsScope(examId, cropRegionId),
      "proposals",
    ] as const,
    queryFn: () => window.electronAPI.aiGrading.listProposals(cropRegionId),
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

/**
 * 問題の画像を試験フォルダへ取り込む（DB には書かないので取り直すものは無い）。
 * 返ったパスを、プロンプトを保存するときに渡す
 */
export const importAiQuestionImageMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.aiGrading.importQuestionImage
      >[0]
    ) => window.electronAPI.aiGrading.importQuestionImage(input),
    meta: {
      writesDatabase: false,
      errorMessage: "問題の画像を取り込めませんでした",
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
      invalidates: [
        aiGradingRunsScope(examId, cropRegionId),
        aiGradingRunsOfExamScope(examId),
        myAiGradingRunsQuery().queryKey,
      ],
      errorMessage: "AI 採点を始められませんでした",
    },
  })

/**
 * 1段目の実行から2段目（項目の案）を作り直す（外部へ送る）。自動で続いた2段目が失敗した
 * ときの送り直し。終わるまで待つ
 */
export const startAiGroupingRunMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (gradeRunId: string) =>
      window.electronAPI.aiGrading.startGroupingRun(gradeRunId),
    meta: {
      invalidates: [
        aiGradingRunsScope(examId, cropRegionId),
        aiGradingRunsOfExamScope(examId),
        myAiGradingRunsQuery().queryKey,
      ],
      errorMessage: "項目の案を作れませんでした",
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
      invalidates: [
        aiGradingRunsScope(examId, cropRegionId),
        aiGradingRunsOfExamScope(examId),
        myAiGradingRunsQuery().queryKey,
      ],
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
      invalidates: [
        aiGradingRunsScope(examId, cropRegionId),
        aiGradingRunsOfExamScope(examId),
        myAiGradingRunsQuery().queryKey,
      ],
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
        aiGradingRunsOfExamScope(examId),
        myAiGradingRunsQuery().queryKey,
        questionScoresQuery(examId, cropRegionId).queryKey,
      ],
      errorMessage: "AI の判定を採用できませんでした",
    },
  })

/** 案への答え（下書き）の引数（main の口の形） */
export type RecordAiRubricProposalDraftInput = Parameters<
  typeof window.electronAPI.aiGrading.recordProposalDraft
>[0]

/**
 * 問いかけ（案）に答える（下書き。§3-5）。AI の層の答えの行だけを書き、教員の採点は変えない。
 * 実行のまとまり（案も入っている）を取り直す
 */
export const recordAiRubricProposalDraftMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (input: RecordAiRubricProposalDraftInput) =>
      window.electronAPI.aiGrading.recordProposalDraft(input),
    scope: { id: `exam:${examId}:aiQuestioning:${cropRegionId}` },
    meta: {
      invalidates: [aiGradingRunsScope(examId, cropRegionId)],
      errorMessage: "問いかけへの答えを保存できませんでした",
    },
  })

/** 案の外の問いかけへの答え（下書き）の引数 */
export type RecordAiAttemptResponsesInput = Parameters<
  typeof window.electronAPI.aiGrading.recordAttemptResponses
>[0]

/**
 * 案の外の問いかけ（採点チェック・どの案にも入らない答案）に答える（下書き）。答案ごとの行を書く。
 * 答えは実行の一覧の試行に同梱されているので、実行のまとまりを取り直す
 */
export const recordAiAttemptResponsesMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (input: RecordAiAttemptResponsesInput) =>
      window.electronAPI.aiGrading.recordAttemptResponses(input),
    scope: { id: `exam:${examId}:aiQuestioning:${cropRegionId}` },
    meta: {
      invalidates: [aiGradingRunsScope(examId, cropRegionId)],
      errorMessage: "問いかけへの答えを保存できませんでした",
    },
  })

/** 問いかけの前に決めた採点方式の下書きを書く（設問の採点方式は確定のときに変える） */
export const setAiQuestioningScoringMethodMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.aiGrading.setQuestioningScoringMethod
      >[0]
    ) => window.electronAPI.aiGrading.setQuestioningScoringMethod(input),
    scope: { id: `exam:${examId}:aiQuestioning:${cropRegionId}` },
    meta: {
      invalidates: [aiGradingRunsScope(examId, cropRegionId)],
      errorMessage: "採点方式の答えを保存できませんでした",
    },
  })

/**
 * 案への答え（下書き）を確定する（§3-5）。選択肢なら項目を作り（既存の項目に当たる案なら作らない）、
 * 渡した答案の自分の採点行に当てる。当て外ししたマスの採点行（適用付き）が返るので、続けて点を
 * 計算して `writeRubricScoresMutation` で書き、朱書きを合わせる。項目・適用・採点行が変わるので取り直す
 */
export const commitAiRubricProposalResponseMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.aiGrading.commitProposalResponse
      >[0]
    ) => window.electronAPI.aiGrading.commitProposalResponse(input),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [
        aiGradingRunsScope(examId, cropRegionId),
        ...rubricItemInvalidations(examId, cropRegionId),
        questionScoresQuery(examId, cropRegionId).queryKey,
      ],
      errorMessage: "AI の項目の案への答えを確定できませんでした",
    },
  })

/** 問いかけで教員が直接決めた点（1件ずつ採点・採点チェックで直す点）を自分の採点として書く */
export const writeAiQuestioningScoresMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.aiGrading.writeQuestioningScores
      >[0]
    ) => window.electronAPI.aiGrading.writeQuestioningScores(input),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [
        questionScoresQuery(examId, cropRegionId).queryKey,
        ...rubricItemInvalidations(examId, cropRegionId),
      ],
      errorMessage: "問いかけで決めた点を書けませんでした",
    },
  })

/** 教員の層へ書き終えた答えを確定済みにする */
export const markAiQuestioningCommittedMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.aiGrading.markQuestioningCommitted
      >[0]
    ) => window.electronAPI.aiGrading.markQuestioningCommitted(input),
    scope: { id: `exam:${examId}:aiQuestioning:${cropRegionId}` },
    meta: {
      invalidates: [aiGradingRunsScope(examId, cropRegionId)],
      errorMessage: "問いかけの答えを確定済みにできませんでした",
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
