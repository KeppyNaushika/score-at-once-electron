/**
 * AI の判定の採用（docs/vlm-grading-design.md §1・§8・§10）。
 *
 * 採用は「実行した教員が、AI の判定を自分の判定として書き込む」こと。書く先は既存の
 * 採点の書き込み口だけで、新しい書き方は作らない。
 *
 * - 判定と部分点 → `setQuestionScore`（受験者×設問×採点者の1行）
 * - 教員向けの理由 → `setQuestionScoreComment`
 * - 生徒向けの朱書き → `createDrawingAnnotation`（置き場所は renderer が求めた座標）
 *
 * **採点済みのマスは既定で飛ばす**（`overwrite: true` のときだけ上書きする）。
 * 採用できるのは実行した教員だけ（run の userId）。他の教員の判定は見比べられても、
 * その教員の名義では書けない。
 */

import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"
import { newDrawingAnnotation } from "@/types/drawingAnnotation.types"
import { toScoringStatus } from "@/types/scoringStatus.types"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import prisma from "./client"
import {
  createDrawingAnnotation,
  deleteDrawingAnnotation,
} from "./drawingAnnotationWrite"
import { setQuestionScoreComment } from "./questionScoreComment"
import { setQuestionScore } from "./questionScoreWrite"

/** AI の注釈の色（朱書き） */
const AI_ANNOTATION_COLOR = "#ef4444"

/** 1件の採用。注釈の置き場所は renderer が占有グリッドから求める（`annotationPlacement.ts`） */
export interface AiGradingAdoption {
  attemptId: string
  /** 注釈の位置（左上）・改行を入れた文・文字の大きさ（mm）。注釈を書かないなら null */
  annotation: Pick<DrawingAnnotation, "x" | "y" | "text" | "fontSize"> | null
}

/** 1件ごとに何が起きたか */
export type AiGradingAdoptionOutcome =
  | "adopted"
  /** 自分の採点が既にある（overwrite でないので飛ばした） */
  | "skipped_already_scored"
  /** 実行した教員ではない */
  | "skipped_not_executor"
  /** 判定が出ていない（失敗・拒否・結果待ち） */
  | "skipped_not_succeeded"
  /** 試行が無い（消された） */
  | "skipped_not_found"

export interface AiGradingAdoptionResult {
  /** 採用なら attempt の id、白紙の採用なら examStudentId */
  targetId: string
  outcome: AiGradingAdoptionOutcome
}

/** そのマスに自分の採点が既にあり、未採点ではないか */
async function hasOwnScore(
  examStudentId: string,
  cropRegionId: string,
  userId: string
): Promise<boolean> {
  const existing = await prisma.questionScore.findFirst({
    where: { examStudentId, cropRegionId, userId },
  })
  return existing !== null && existing.status !== "unscored"
}

/**
 * 上書きで採用し直すとき、同じマスに前に採用した AI の注釈を消す
 * （採用し直すたびに朱書きが重なっていかないように）
 */
async function removePreviouslyAdoptedAnnotations(
  examStudentId: string,
  cropRegionId: string,
  userId: string
): Promise<void> {
  const previousAttempts = await prisma.aiGradingAttempt.findMany({
    where: {
      examStudentId,
      adoptedDrawingAnnotationId: { not: null },
      run: { userId, prompt: { cropRegionId } },
    },
  })
  for (const previousAttempt of previousAttempts) {
    if (previousAttempt.adoptedDrawingAnnotationId) {
      await deleteDrawingAnnotation(previousAttempt.adoptedDrawingAnnotationId)
    }
  }
}

/** 採用1件。結果を返す（例外は呼び出し側へ） */
async function adoptOne(
  adoption: AiGradingAdoption,
  actorUserId: string,
  overwrite: boolean
): Promise<{ outcome: AiGradingAdoptionOutcome; cropRegionId: string | null }> {
  const attempt = await prisma.aiGradingAttempt.findUnique({
    where: { id: adoption.attemptId },
    include: { run: { include: { prompt: true } } },
  })
  if (!attempt) return { outcome: "skipped_not_found", cropRegionId: null }
  const cropRegionId = attempt.run.prompt.cropRegionId
  if (attempt.run.userId !== actorUserId) {
    return { outcome: "skipped_not_executor", cropRegionId }
  }
  if (attempt.state !== "succeeded") {
    return { outcome: "skipped_not_succeeded", cropRegionId }
  }
  const { examStudentId } = attempt
  if (
    !overwrite &&
    (await hasOwnScore(examStudentId, cropRegionId, actorUserId))
  ) {
    return { outcome: "skipped_already_scored", cropRegionId }
  }

  const target = { examStudentId, cropRegionId, userId: actorUserId }
  const questionScore = await setQuestionScore({
    ...target,
    status: toScoringStatus(attempt.status),
    partialScore:
      attempt.partialScore === null ? null : attempt.partialScore.toNumber(),
  })
  await setQuestionScoreComment({ ...target, comment: attempt.comment })

  let drawingAnnotationId: string | null = null
  if (adoption.annotation && adoption.annotation.text.trim() !== "") {
    if (overwrite) {
      await removePreviouslyAdoptedAnnotations(
        examStudentId,
        cropRegionId,
        actorUserId
      )
    }
    const drawingAnnotation = await createDrawingAnnotation(
      target,
      newDrawingAnnotation({
        type: "text",
        x: adoption.annotation.x,
        y: adoption.annotation.y,
        text: adoption.annotation.text,
        fontSize: adoption.annotation.fontSize,
        color: AI_ANNOTATION_COLOR,
        strokeWidth: 1,
        anchorDirection: "top-left",
      })
    )
    drawingAnnotationId = drawingAnnotation.id
  }

  await prisma.aiGradingAttempt.update({
    where: { id: attempt.id },
    data: {
      adoptedQuestionScoreId: questionScore.id,
      adoptedDrawingAnnotationId: drawingAnnotationId,
      adoptedAt: new Date(),
    },
  })
  return { outcome: "adopted", cropRegionId }
}

/** 採用した件数を、設問ごとに1行の監査ログにまとめる */
async function recordAdoptionAudit(
  action: "exam.ai_grading.adopt" | "exam.ai_grading.adopt_blank",
  actorUserId: string,
  adoptedCountByCropRegion: Map<string, number>
): Promise<void> {
  for (const [cropRegionId, adoptedCount] of adoptedCountByCropRegion) {
    const scope = await resolveExamScopeByCropRegion(cropRegionId)
    await recordAuditLog({
      action,
      userId: actorUserId,
      entityType: "CropRegion",
      entityId: cropRegionId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary:
        action === "exam.ai_grading.adopt"
          ? `AI の判定を${adoptedCount}件、採点に採用しました`
          : `白紙の答案${adoptedCount}件を無答にしました`,
    })
  }
}

/**
 * 選んだ試行を、実行した教員自身の採点として書き込む。
 *
 * 1件ずつ既存の書き込み口を順に呼ぶ（1件の中で途中まで書けて失敗したら、その件は
 * そこで止まり、例外が呼び出し側へ上がる。それまでの件は書けている）。
 */
export async function adoptAiGradingAttempts(
  input: { adoptions: readonly AiGradingAdoption[]; overwrite: boolean },
  actorUserId: string
): Promise<AiGradingAdoptionResult[]> {
  const results: AiGradingAdoptionResult[] = []
  const adoptedCountByCropRegion = new Map<string, number>()
  try {
    for (const adoption of input.adoptions) {
      const { outcome, cropRegionId } = await adoptOne(
        adoption,
        actorUserId,
        input.overwrite
      )
      results.push({ targetId: adoption.attemptId, outcome })
      if (outcome === "adopted" && cropRegionId) {
        adoptedCountByCropRegion.set(
          cropRegionId,
          (adoptedCountByCropRegion.get(cropRegionId) ?? 0) + 1
        )
      }
    }
  } finally {
    await recordAdoptionAudit(
      "exam.ai_grading.adopt",
      actorUserId,
      adoptedCountByCropRegion
    )
  }
  return results
}

/**
 * 白紙の答案を無答（no_answer）として書き込む。
 *
 * 白紙は送らないので試行が無い。白紙かどうかは renderer がその場で測ったインク率から
 * 決め、ここへは答案（examStudentId）だけを渡す。採点済みのマスは試行の採用と同じく
 * 既定で飛ばす。
 */
export async function adoptBlankAnswers(
  input: {
    cropRegionId: string
    examStudentIds: readonly string[]
    overwrite: boolean
  },
  actorUserId: string
): Promise<AiGradingAdoptionResult[]> {
  const results: AiGradingAdoptionResult[] = []
  let adoptedCount = 0
  try {
    for (const examStudentId of input.examStudentIds) {
      if (
        !input.overwrite &&
        (await hasOwnScore(examStudentId, input.cropRegionId, actorUserId))
      ) {
        results.push({
          targetId: examStudentId,
          outcome: "skipped_already_scored",
        })
        continue
      }
      await setQuestionScore({
        examStudentId,
        cropRegionId: input.cropRegionId,
        userId: actorUserId,
        status: "no_answer",
        partialScore: null,
      })
      adoptedCount += 1
      results.push({ targetId: examStudentId, outcome: "adopted" })
    }
  } finally {
    await recordAdoptionAudit(
      "exam.ai_grading.adopt_blank",
      actorUserId,
      adoptedCount > 0
        ? new Map([[input.cropRegionId, adoptedCount]])
        : new Map()
    )
  }
  return results
}
