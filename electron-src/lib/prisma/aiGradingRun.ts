/**
 * AI 採点の実行（AiGradingRun）と試行（AiGradingAttempt）の読み書き。
 *
 * 試行は書き換えない（結果を受け取って state を決めるまでと、採用の記録を除く）。
 * やり直しは新しい run の新しい行（docs/vlm-grading-design.md §5-3）。採用は
 * `aiGradingAdoption.ts`、2段目の項目の案と教員の答えは `aiRubricProposal.ts` にある。
 *
 * `points` / `partialScore` は Decimal なので、ここから返した行を IPC へ渡すときは
 * 境界の serializePrisma が number へ倒す。文字列の列は `narrowAiGradingRun` で union へ
 * 絞る（境界で1回だけ）。
 */

import type { AiGradingAttempt, AiGradingRun } from "@prisma/client"
import { Prisma } from "@prisma/client"

import {
  type AiGradingAttemptState,
  type AiGradingProvider,
  type AiGradingRunMode,
  type AiGradingRunPurpose,
  type AiGradingRunStatus,
  toAiGradingAttemptState,
  toAiGradingProvider,
  toAiGradingRunMode,
  toAiGradingRunPurpose,
  toAiGradingRunStatus,
} from "@/types/aiGrading.types"
import {
  type ScoringStatus,
  toScoringStatus,
} from "@/types/scoringStatus.types"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import prisma from "./client"
import { PUBLIC_USER_OMIT } from "./publicUser"

/** 試行の文字列の列を union へ絞る（行のほかの列はそのまま） */
export function narrowAiGradingAttempt<Attempt extends AiGradingAttempt>(
  attempt: Attempt
) {
  return {
    ...attempt,
    state: toAiGradingAttemptState(attempt.state),
    status: toScoringStatus(attempt.status),
  }
}

/** 実行の文字列の列（と、試行の列）を union へ絞る。試行に同梱したもの（当てはまり等）は保つ */
export function narrowAiGradingRun<
  Run extends AiGradingRun,
  Attempt extends AiGradingAttempt,
>(run: Run & { attempts: Attempt[] }) {
  return {
    ...run,
    purpose: toAiGradingRunPurpose(run.purpose),
    provider: toAiGradingProvider(run.provider),
    mode: toAiGradingRunMode(run.mode),
    status: toAiGradingRunStatus(run.status),
    attempts: run.attempts.map((attempt) => narrowAiGradingAttempt(attempt)),
  }
}

/** 実行を作るときの列。id・時刻・後から決まる列は DB と後の書き込みが決める */
export interface CreateAiGradingRunData {
  userId: string
  promptId: string
  purpose: AiGradingRunPurpose
  templateVersion: string
  provider: AiGradingProvider
  model: string
  effort: string
  mode: AiGradingRunMode
  status: AiGradingRunStatus
  submittedClientId: string
  imageScale: number
  /** 送ったときの配点（CropRegion.points の写し） */
  points: number | null
}

/**
 * 実行と、対象の答案ごとの試行（state: pending）を1回の書き込みで作る。
 */
export async function createAiGradingRun(
  data: CreateAiGradingRunData,
  examStudentIds: readonly string[]
) {
  const created = await prisma.aiGradingRun.create({
    data: {
      ...data,
      points: data.points === null ? null : new Prisma.Decimal(data.points),
      attempts: {
        create: examStudentIds.map((examStudentId) => ({ examStudentId })),
      },
    },
    include: { attempts: true, prompt: true },
  })

  const scope = await resolveExamScopeByCropRegion(created.prompt.cropRegionId)
  await recordAuditLog({
    action: "exam.ai_grading.run",
    userId: data.userId,
    entityType: "AiGradingRun",
    entityId: created.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    // 送り先は記録する（どの事業者へ答案を送ったかは後から辿れるべき）。キーは持たない
    extra: {
      purpose: data.purpose,
      provider: data.provider,
      model: data.model,
      mode: data.mode,
      attemptCount: examStudentIds.length,
    },
  })

  return created
}

/** 実行の状態などを書き換える（バッチの id・終わった日時・使用量） */
export async function updateAiGradingRun(
  runId: string,
  update: {
    status?: AiGradingRunStatus
    externalBatchId?: string
    endedAt?: Date
    /** 2段目の気づいた点 */
    notes?: string
    inputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
  }
) {
  return prisma.aiGradingRun.update({ where: { id: runId }, data: update })
}

/**
 * 実行1件（プロンプトと設問・ページの木、試行と1段目の当てはまり付き）。無ければ null。
 * 試行は作った順（2段目へ送る並び）
 */
export async function getAiGradingRunForProcessing(runId: string) {
  return prisma.aiGradingRun.findUnique({
    where: { id: runId },
    include: {
      attempts: {
        include: { rubricMatches: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      prompt: { include: { cropRegion: { include: { examPage: true } } } },
    },
  })
}

/**
 * 試行に書く結果（送信の成否・1段目の判定・使用量）。
 *
 * 1段目は教員向けのコメントと朱書きの文案を返さない（§3-3）ので、`comment`・
 * `annotationText` の列は書かない（既定の "" のまま。過去の行の値は残る）
 */
export interface AiGradingAttemptResult {
  state: Exclude<AiGradingAttemptState, "pending">
  status: ScoringStatus
  partialScore: number | null
  transcription: string
  observation: string
  /** 1段目が当てはまると返した項目（送った項目の id だけ。検証済み） */
  matchedRubricItemIds: readonly string[]
  confidence: string
  errorMessage: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/**
 * 試行に結果を書く。**まだ pending の行にだけ書く**（同じバッチの結果を2度取り込んでも、
 * 先に書いた結果を上書きしない）。
 *
 * 当てはまる項目は `AiAttemptRubricMatch` に書く。送ったあとに消された項目は、記録できる
 * 行が無いので飛ばす（送った一覧は `AiPrompt.renderedRubricItems` に残っている）。
 *
 * @returns 書いたら true
 */
export async function recordAiGradingAttemptResult(
  attemptId: string,
  result: AiGradingAttemptResult
): Promise<boolean> {
  const { matchedRubricItemIds, ...columns } = result
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.aiGradingAttempt.updateMany({
      where: { id: attemptId, state: "pending" },
      data: {
        ...columns,
        partialScore:
          columns.partialScore === null
            ? null
            : new Prisma.Decimal(columns.partialScore),
      },
    })
    if (count === 0) return false
    if (matchedRubricItemIds.length > 0) {
      const livingItems = await tx.rubricItem.findMany({
        where: { id: { in: [...matchedRubricItemIds] } },
      })
      const livingIds = new Set(livingItems.map((rubricItem) => rubricItem.id))
      await tx.aiAttemptRubricMatch.createMany({
        data: matchedRubricItemIds
          .filter((rubricItemId) => livingIds.has(rubricItemId))
          .map((rubricItemId) => ({ attemptId, rubricItemId })),
      })
    }
    return true
  })
}

/** 実行のうち、まだ pending の試行をまとめて終わらせる（中止・失敗・期限切れ） */
export async function closePendingAiGradingAttempts(
  runId: string,
  state: "errored" | "expired",
  errorMessage: string
) {
  return prisma.aiGradingAttempt.updateMany({
    where: { runId, state: "pending" },
    data: { state, errorMessage },
  })
}

/** 一覧で返す木。実行者は秘密を落として連れてくる。試行には1段目の当てはまりを同梱する */
const aiGradingRunListInclude = {
  attempts: {
    include: { rubricMatches: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  prompt: true,
  user: { omit: PUBLIC_USER_OMIT },
} satisfies Prisma.AiGradingRunInclude

/**
 * 設問の実行（試行付き）を古い順に。
 *
 * 07 は自分の採点だけを見せるので、既定では実行者で絞る（`userId`）。null を渡すと
 * 全員の実行を返す（他の教員の判定を見比べたいとき）。
 */
export async function listAiGradingRunsByCropRegion(
  cropRegionId: string,
  userId: string | null
) {
  const runs = await prisma.aiGradingRun.findMany({
    where: {
      prompt: { cropRegionId },
      ...(userId === null ? {} : { userId }),
    },
    include: aiGradingRunListInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
  return runs.map(narrowAiGradingRun)
}

/**
 * 試験の全設問について、その教員の実行（試行とプロンプト付き）。設問一覧で
 * 「AI の判定があるのに自分がまだ採点していない答案」のある設問を示すのに使う
 * （数えるのは画面側）
 */
export async function listAiGradingRunsByExam(examId: string, userId: string) {
  return prisma.aiGradingRun.findMany({
    where: { userId, prompt: { cropRegion: { examPage: { examId } } } },
    include: { attempts: true, prompt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
}

/**
 * その教員の実行（試行と、どの試験のどの設問か）を、すべての試験について。
 * 「AI採点」の画面の使用トークンに使う
 * （使用量は group・revise なら実行の列、grade なら試行の列にある。足し算・金額・集計は画面側）
 */
export async function listAiGradingRunsByUser(userId: string) {
  return prisma.aiGradingRun.findMany({
    where: { userId },
    include: {
      attempts: true,
      prompt: {
        include: {
          cropRegion: { include: { examPage: { include: { exam: true } } } },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
}

/** この端末が投入して、まだ結果を取り込んでいないバッチの実行 */
export async function listBatchRunsToCollect(submittedClientId: string) {
  return prisma.aiGradingRun.findMany({
    where: {
      mode: "batch",
      status: "in_progress",
      submittedClientId,
      externalBatchId: { not: null },
    },
    orderBy: { createdAt: "asc" },
  })
}

/**
 * 古い試行を消す（設計 §4-4）。
 *
 * 「最新でない」の判定は renderer の計算なので、消す試行は id で受け取る。ここで守るのは
 * 消してはいけないもの —— **採用した試行・結果待ちの試行・他の教員の試行** —— を
 * 消さないことだけで、条件に合わないものは黙って残す。
 *
 * @returns 実際に消した件数
 */
export async function deleteAiGradingAttempts(
  attemptIds: readonly string[],
  actorUserId: string
): Promise<number> {
  if (attemptIds.length === 0) return 0
  const deletableAttempts = await prisma.aiGradingAttempt.findMany({
    where: {
      id: { in: [...attemptIds] },
      adoptedAt: null,
      adoptedQuestionScoreId: null,
      adoptedDrawingAnnotationId: null,
      state: { not: "pending" },
      run: { userId: actorUserId },
    },
    include: { run: { include: { prompt: true } } },
  })
  if (deletableAttempts.length === 0) return 0

  const { count } = await prisma.aiGradingAttempt.deleteMany({
    where: {
      id: { in: deletableAttempts.map((attempt) => attempt.id) },
      adoptedAt: null,
    },
  })

  const cropRegionId = deletableAttempts[0].run.prompt.cropRegionId
  const scope = await resolveExamScopeByCropRegion(cropRegionId)
  await recordAuditLog({
    action: "exam.ai_grading.delete_attempts",
    userId: actorUserId,
    entityType: "CropRegion",
    entityId: cropRegionId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: `AI の古い判定を${count}件消しました`,
  })

  return count
}
