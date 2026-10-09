/**
 * AI 採点（VLM 採点）の IPC（docs/vlm-grading-design.md §10）。
 *
 * プロンプト・画像の測定・実行・採用の口。事業者の同意とキーの口（`aiProvider:*`）は
 * 別のファイルにある。**API キーを返すチャンネルはここにも作らない**（キーは
 * `aiGradingMainServices.ts` の中で復号され、事業者のクライアントへ渡るだけ）。
 *
 * 操作者は認証ストアから決める（renderer から利用者 id を受け取らない）。AI の判定は
 * 実行した教員のもので、採用もその教員自身の採点として書く。
 */

import { getAiGradingServices } from "../lib/aiGrading/aiGradingMainServices"
import type { StartGradingRunInput } from "../lib/aiGrading/gradingJobRunner"
import {
  measureRunImageSizes,
  previewSendingCrop,
} from "../lib/aiGrading/sendingImageInspection"
import {
  adoptAiGradingAttempts,
  type AiGradingAdoption,
} from "../lib/prisma/aiGradingAdoption"
import {
  deleteAiGradingAttempts,
  listAiGradingRunsByCropRegion,
  listAiGradingRunsByExam,
  listAiGradingRunsByUser,
} from "../lib/prisma/aiGradingRun"
import {
  createAiPrompt,
  type CreateAiPromptData,
  getAsbModelAnswerSource,
  listAiPromptsByCropRegion,
} from "../lib/prisma/aiPrompt"
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

  /** 中止する（実行した教員だけ） */
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
} satisfies HandlerMap
