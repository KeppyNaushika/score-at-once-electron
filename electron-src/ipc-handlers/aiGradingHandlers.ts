/**
 * AI 採点（VLM 採点）の IPC（docs/vlm-grading-design.md §10）。
 *
 * プロンプト・画像の測定・実行（1段目・2段目）・採用・問いかけ（項目の案と答え）の口。事業者の同意とキーの口（`aiProvider:*`）は
 * 別のファイルにある。**API キーを返すチャンネルはここにも作らない**（キーは
 * `aiGradingMainServices.ts` の中で復号され、事業者のクライアントへ渡るだけ）。
 *
 * 操作者は認証ストアから決める（renderer から利用者 id を受け取らない）。AI の判定は
 * 実行した教員のもので、採用もその教員自身の採点として書く。
 */

import { getAiGradingServices } from "../lib/aiGrading/aiGradingMainServices"
import type { StartGradingRunInput } from "../lib/aiGrading/gradingJobRunner"
import {
  importAiQuestionImage,
  type ImportAiQuestionImageInput,
} from "../lib/aiGrading/questionImageImport"
import {
  measureRunImageSizes,
  previewSendingCrop,
} from "../lib/aiGrading/sendingImageInspection"
import { getSharedFilesDirectory } from "../lib/dataManager"
import {
  type AiAttemptResponseInput,
  recordAiAttemptResponses,
} from "../lib/prisma/aiAttemptResponse"
import {
  adoptAiGradingAttempts,
  type AiGradingAdoption,
} from "../lib/prisma/aiGradingAdoption"
import {
  deleteAiGradingAttempts,
  listAiGradingRunsByCropRegion,
  listAiGradingRunsByExam,
  listAiGradingRunsByUser,
  setAiQuestioningScoringMethod,
} from "../lib/prisma/aiGradingRun"
import {
  createAiPrompt,
  type CreateAiPromptData,
  getAsbModelAnswerSource,
  listAiPromptsByCropRegion,
} from "../lib/prisma/aiPrompt"
import {
  type AiQuestioningScoreWrite,
  markAiQuestioningCommitted,
  writeAiQuestioningScores,
} from "../lib/prisma/aiQuestioningScore"
import {
  commitAiRubricProposalResponse,
  type CommitAiRubricProposalResponseInput,
  listAiRubricProposalRunsByCropRegion,
  recordAiRubricProposalDraft,
  type RecordAiRubricProposalDraftInput,
} from "../lib/prisma/aiRubricProposal"
import { getCurrentActorUserId } from "../lib/prisma/auditActor"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 操作者（ログイン中の教員）。ログインしていなければ投げる */
function requireActorUserId(): string {
  const actorUserId = getCurrentActorUserId()
  if (!actorUserId) throw new Error("ログインしていません")
  return actorUserId
}

/** AI 採点のプロンプト・測定・実行・採用の IPC チャンネル */
export const aiGradingHandlers = {
  // ── プロンプト（書き換え・削除の口は作らない） ──────────────────
  /** 設問のプロンプトを全部（どの教員が作ったものも）。作成者付き */
  "aiGrading:listPrompts": async (cropRegionId: string) =>
    listAiPromptsByCropRegion(cropRegionId),

  /** プロンプトを1行作る（直すときは parentPromptId に元の行を指定する） */
  "aiGrading:createPrompt": async (data: CreateAiPromptData) =>
    createAiPrompt(data, requireActorUserId()),

  /**
   * 問題の画像を試験フォルダへ取り込み、data ディレクトリからの相対パスを返す（DB には書かない。
   * 行はプロンプトを保存するときに作る）。切り出し・PDF のページの画像化は画面で済ませてある
   */
  "aiGrading:importQuestionImage": async (
    input: ImportAiQuestionImageInput
  ) => {
    requireActorUserId()
    return importAiQuestionImage(input, getSharedFilesDirectory())
  },

  /** 模範解答の下書きの元（ASB の小問・枝問とテキスト要素の木）。照合は renderer */
  "aiGrading:getAsbModelAnswerSource": async (asbDefinitionId: string) =>
    getAsbModelAnswerSource(asbDefinitionId),

  // ── 画像（外部へは送らない） ─────────────────────────────────
  /** 答案1件について、送る画像そのもの（PNG の data URL） */
  "aiGrading:previewCrop": async (input: {
    cropRegionId: string
    examStudentId: string
    imageScale: number
  }) =>
    previewSendingCrop(
      input,
      getAiGradingServices().dependencies.resolveDataPath
    ),

  // ── 実行 ───────────────────────────────────────────────────
  /** 見積もりの材料（送る画像の大きさ）。金額は renderer が計算する */
  "aiGrading:estimateRun": async (input: {
    promptId: string
    examStudentIds: string[]
    imageScale: number
  }) =>
    measureRunImageSizes(
      input,
      getAiGradingServices().dependencies.resolveDataPath
    ),

  /**
   * 採点を始める（外部へ送る）。run と試行を作って返し、その場の採点は裏で続く
   * （進み具合は `aiGrading:run-progress` で届く）。バッチは預け終えてから返る
   */
  "aiGrading:startRun": async (input: StartGradingRunInput) => {
    const { run } = await getAiGradingServices().jobRunner.startGradingRun(
      input,
      requireActorUserId()
    )
    return run
  },

  /**
   * 1段目の実行から2段目（項目の案）を作り直す（外部へ送る）。1段目のあとは自動で続くので、
   * これは自動の2段目が失敗したときの送り直し。終わるまで待って2段目の run を返す
   */
  "aiGrading:startGroupingRun": async (gradeRunId: string) =>
    getAiGradingServices().jobRunner.startGroupingRun(
      gradeRunId,
      requireActorUserId()
    ),

  /** 中止する（実行した教員だけ。2段目も止められる） */
  "aiGrading:cancelRun": async (runId: string) =>
    getAiGradingServices().jobRunner.cancelRun(runId, requireActorUserId()),

  /**
   * 設問の実行と試行。既定は自分の実行だけ（07 は自分の採点だけを見せる）。
   * `includeOtherUsers` で全員の実行を返す
   */
  "aiGrading:listRuns": async (
    cropRegionId: string,
    includeOtherUsers: boolean
  ) =>
    listAiGradingRunsByCropRegion(
      cropRegionId,
      includeOtherUsers ? null : requireActorUserId()
    ),

  /** 試験の全設問の、自分の実行と試行（設問一覧の印に使う） */
  "aiGrading:listRunsByExam": async (examId: string) =>
    listAiGradingRunsByExam(examId, requireActorUserId()),

  /** すべての試験の、自分の実行と試行（試験・設問付き。使用トークンの集計に使う） */
  "aiGrading:listMyRuns": async () =>
    listAiGradingRunsByUser(requireActorUserId()),

  /** 古い試行を消す（採用済み・結果待ち・他の教員の試行は消さない）。消した件数を返す */
  "aiGrading:deleteAttempts": async (attemptIds: string[]) =>
    deleteAiGradingAttempts(attemptIds, requireActorUserId()),

  // ── 採用 ───────────────────────────────────────────────────
  /**
   * 選んだ試行を自分の採点として書く。点と朱書きは `parts` で別に確定できる（省略は両方）。
   * 採点済みのマス・反映済みの朱書きは overwrite でなければ飛ばす
   */
  "aiGrading:adoptAttempts": async (input: {
    adoptions: AiGradingAdoption[]
    overwrite: boolean
  }) => adoptAiGradingAttempts(input, requireActorUserId()),

  // ── 問いかけ（§3-5） ────────────────────────────────────────
  /**
   * 設問の、自分の2段目の実行と項目の案（選択肢・答案（試行付き）・答えの木）。
   * 問いかけは実行した教員にだけ出すので、自分の分だけを返す
   */
  "aiGrading:listProposals": async (cropRegionId: string) =>
    listAiRubricProposalRunsByCropRegion(cropRegionId, requireActorUserId()),

  /**
   * 問いかけ（案）に答える（下書き）。答えの行を書くだけで、教員の採点には触らない
   */
  "aiGrading:recordProposalDraft": async (
    input: RecordAiRubricProposalDraftInput
  ) => recordAiRubricProposalDraft(input, requireActorUserId()),

  /**
   * 案の外の問いかけ（採点チェック・どの案にも入らない答案）に答える（下書き）。答案ごとの行を書くだけ
   */
  "aiGrading:recordAttemptResponses": async (input: {
    responses: AiAttemptResponseInput[]
  }) => recordAiAttemptResponses(input, requireActorUserId()),

  /** 問いかけの前に決めた採点方式の下書きを書く（設問の採点方式は確定のときに変える） */
  "aiGrading:setQuestioningScoringMethod": async (input: {
    runId: string
    scoringMethod: string
  }) => setAiQuestioningScoringMethod(input, requireActorUserId()),

  /**
   * 案への答え（下書き）を確定する。選択肢なら項目を作り（既存の項目に当たる案なら作らない）、
   * 渡した答案の自分の採点行に当てる。当て外ししたマスの採点行を返すので、点の計算と朱書きの
   * 合わせは renderer が続けて行う
   */
  "aiGrading:commitProposalResponse": async (
    input: CommitAiRubricProposalResponseInput
  ) => commitAiRubricProposalResponse(input, requireActorUserId()),

  /** 問いかけで教員が直接決めた点（1件ずつ採点・採点チェックで直す点）を自分の採点として書く */
  "aiGrading:writeQuestioningScores": async (input: {
    cropRegionId: string
    scores: AiQuestioningScoreWrite[]
  }) => writeAiQuestioningScores(input, requireActorUserId()),

  /** 教員の層へ書き終えた答えを確定済みにする */
  "aiGrading:markQuestioningCommitted": async (input: {
    proposalResponseIds: string[]
    attemptResponseIds: string[]
  }) => markAiQuestioningCommitted(input, requireActorUserId()),
} satisfies HandlerMap
