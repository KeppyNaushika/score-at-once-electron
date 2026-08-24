import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { examForDetailQuery } from "./exam"
import { scopeKeys } from "./keys"

/**
 * 採点（QuestionScore）と、設問ごとの採点担当（CropRegionAssignment）の読み書き。
 *
 * **採点行は設問ごとに1本のキーへ載せる。** 採点は「その設問のそのマス」に書くので、
 * 書き込みで古くなるのもその設問だけである。試験ぶんを1本にまとめていた頃は、
 * 1マス採点するたびに**試験ぜんぶの採点行**を取り直していた
 * ——**画面に出ているのは1設問ぶんなのに**。
 *
 * 取り直しはキーより細かくできない（`queryFn` を呼び直す＝その値を丸ごと作り直す）
 * ので、**キーの粒度が取り直しの下限**になる。細かく持てば狭くも広くも選べるが、
 * 太いまま持つと広くしか選べない。
 *
 * かつては採点領域（`CropRegion`）の木に子として載せていた。二重キャッシュを避ける
 * ためだったが、木から抜いたので二重にはならない（載っている場所は1つだけ）。
 *
 * 対応する preload は `electron-src/preload-apis/scoringApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/**
 * 採点行の全部を指す前方一致。設問ごとのキーはこの下に並ぶ。
 *
 * まとめて取り直すのは、書いた先を設問1つに絞れないとき（OMR の一括取り込み）だけ。
 */
export const questionScoresScope = (examId: string) =>
  [...scopeKeys.exam(examId), "questionScores"] as const

/** その設問の採点行1件（採点者を問わない。誰の採点かで絞るのは画面の仕事） */
export type QuestionScoreRow = Awaited<
  ReturnType<typeof window.electronAPI.getQuestionScoresByCropRegionId>
>[number]

/**
 * その設問の採点行。
 *
 * 採点画面は設問の数だけこれを読む（進捗は全設問ぶんの行を数えるので、取る量は
 * 変わらない。変わるのは**書いたあとに取り直す量**だけ）。
 */
export const questionScoresQuery = (examId: string, cropRegionId: string) =>
  queryOptions({
    queryKey: [...questionScoresScope(examId), cropRegionId] as const,
    queryFn: () =>
      window.electronAPI.getQuestionScoresByCropRegionId(cropRegionId),
  })

/**
 * 裁定サマリ（競合・確定後の新提案）。
 *
 * 試験全体の採点行を走査するので、単独利用（メンバー1人）では呼び出し側が
 * 走らせない。競合はメンバーが1人なら構造的にゼロで、結果は常に空になる。
 */
export const examDecisionSummaryQuery = (examId: string, userId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "decisionSummary", userId] as const,
    queryFn: () => window.electronAPI.getExamDecisionSummary(examId, userId),
  })

/** 設問ごとの採点担当（採点画面の設問絞り込みが読む） */
export const cropRegionAssignmentsQuery = (examId: string, userId: string) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.exam(examId),
      "cropRegionAssignments",
      userId,
    ] as const,
    queryFn: () => window.electronAPI.getCropRegionAssignments(examId, userId),
  })

/**
 * 答案1ページ分の「白さ」（空欄らしさ）。
 *
 * 並び順を白さ順にするために、そのページの全答案 × 全採点領域をまとめて測る。
 * 画像1枚のデコードが支配的なので、領域を増やす費用はほぼ無い。
 *
 * キーの `measurementSignature` は**測るもの全部**（答案の id と画像パス、採点領域の
 * id と矩形）。答案が増減しても、02 で解答欄を動かしても測り直す。設問を切り替えた
 * だけなら測り直さない。
 *
 * **この鍵は `scopeKeys.exam` の外にある。** 白さは画像と矩形だけで決まり採点結果に
 * 依存しないので、試験への書き込みで測り直す必要が無い（画像を読み直すので重い）。
 * そのぶん**入力を鍵で表しきる**責任がこちらにある。
 */
export const answerWhitenessQuery = (
  examPageId: string,
  measurementSignature: string,
  input: Parameters<typeof window.electronAPI.measureAnswerWhiteness>[0]
) =>
  queryOptions({
    queryKey: ["answerWhiteness", examPageId, measurementSignature] as const,
    queryFn: () => window.electronAPI.measureAnswerWhiteness(input),
  })

// =====================================================================
// 書き込み
// =====================================================================

/**
 * 採点する。**行が無ければ作り、有れば上書きする。**
 *
 * `QuestionScore` は「受験者×設問×採点者」で1行。上書きが正しいのは**利用者が
 * 採点したとき**だけなので、renderer から採点行を用意する口は持たない。手書き注釈の
 * 置き場所は、注釈を保存するときに main が用意する（`queries/drawing.ts`）。
 *
 * **設問を受け取るのは、取り直す先を1本に絞るため。** 書き込みの引数にも
 * `cropRegionId` は入っているが、`meta.invalidates` は書き込みを定義するときに
 * 決まるので、渡す値からは引けない。
 */
export const setQuestionScoreMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      data: Parameters<typeof window.electronAPI.setQuestionScore>[0]
    ) => window.electronAPI.setQuestionScore(data),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [questionScoresQuery(examId, cropRegionId).queryKey],
      errorMessage: "採点を保存できませんでした",
    },
  })

/**
 * 採点を1件書き換える。
 *
 * 他の教員が答案ごと消していた場合は `status: "target-deleted"` が返る（例外に
 * しないのは、それが失敗ではなく**結果**だから）。呼び出し側が知らせる。
 */
export const updateQuestionScoreMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (input: {
      questionScoreId: string
      data: Parameters<typeof window.electronAPI.updateQuestionScore>[1]
    }) =>
      window.electronAPI.updateQuestionScore(input.questionScoreId, input.data),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [questionScoresQuery(examId, cropRegionId).queryKey],
      errorMessage: "採点を保存できませんでした",
    },
  })

/**
 * その採点者が、その点にした理由の覚え書きを書く。
 *
 * **採点そのものとは別の口。** 判定・部分点はキー1打で確定する操作、覚え書きは
 * 文字を打ち終えてから残す操作で、同じ口に混ぜると送らなかった側が黙って
 * 初期値へ戻る。行が無ければ main が用意する（空の覚え書きでは作らない）。
 */
export const setQuestionScoreCommentMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      data: Parameters<typeof window.electronAPI.setQuestionScoreComment>[0]
    ) => window.electronAPI.setQuestionScoreComment(data),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [questionScoresQuery(examId, cropRegionId).queryKey],
      errorMessage: "覚え書きを保存できませんでした",
    },
  })

/**
 * 競合した採点に裁定を下す。
 *
 * **書くのは `ScoreDecision` だけで、採点行（`QuestionScore`）は触らない**
 * （確定は採点者ごとの提案とは別の行として残る）。だから採点行のキーは取り直さない。
 *
 * 古くなるのは裁定サマリと、概要の進捗（「まだ裁定が要るマス」を数えるのに確定を
 * 読んでいる）の2つ。
 */
export const finalizeQuestionScoreMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      decisionData: Parameters<
        typeof window.electronAPI.finalizeQuestionScore
      >[0]
    ) => window.electronAPI.finalizeQuestionScore(decisionData),
    scope: { id: `exam:${examId}:scoreDecisions` },
    meta: {
      invalidates: [
        [...scopeKeys.exam(examId), "decisionSummary"],
        examForDetailQuery(examId).queryKey,
      ],
      errorMessage: "採点を確定できませんでした",
    },
  })

/**
 * OMR の自動採点結果をまとめて反映する（1操作＝1回の取り込み）。
 *
 * 書く先が設問1つに絞れない（1回の取り込みが複数の設問にまたがる）ので、
 * ここだけは採点行の全部を前方一致で取り直す。
 */
export const batchUpdateQuestionScoresMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      entries: Parameters<
        typeof window.electronAPI.batchUpdateQuestionScores
      >[0]
    ) => window.electronAPI.batchUpdateQuestionScores(entries),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [questionScoresScope(examId)],
      errorMessage: "自動採点の結果を保存できませんでした",
    },
  })

const assignmentsScope = (examId: string) =>
  [...scopeKeys.exam(examId), "cropRegionAssignments"] as const

/**
 * 担当を変えたときに古くなる行き先。
 *
 * 担当を直すのは「3. 領域情報」だが、裁定サマリ（08 が読む）も設問ごとの担当を
 * 運んでいる。書いた画面のキーだけ取り直すと、08 が古い担当を出したままになる。
 */
const assignmentInvalidations = (examId: string) =>
  [
    assignmentsScope(examId),
    [...scopeKeys.exam(examId), "decisionSummary"],
  ] as const

export const assignCropRegionMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      cropRegionId: string
      userId: string
      assignedByUserId: string
    }) =>
      window.electronAPI.assignCropRegion(
        input.cropRegionId,
        input.userId,
        input.assignedByUserId
      ),
    scope: { id: `exam:${examId}:cropRegionAssignments` },
    meta: {
      invalidates: assignmentInvalidations(examId),
      errorMessage: "採点担当を割り当てられませんでした",
    },
  })

export const unassignCropRegionMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      cropRegionId: string
      userId: string
      requestedByUserId: string
    }) =>
      window.electronAPI.unassignCropRegion(
        input.cropRegionId,
        input.userId,
        input.requestedByUserId
      ),
    scope: { id: `exam:${examId}:cropRegionAssignments` },
    meta: {
      invalidates: assignmentInvalidations(examId),
      errorMessage: "採点担当を外せませんでした",
    },
  })
