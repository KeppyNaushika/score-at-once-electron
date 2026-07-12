/**
 * 答案配置の採点安全な一括適用（view の方式B: 任意マスへ移動・衝突swap）
 *
 * 設計（docs/06-student-answers-entity-first-plan.md §5）:
 * - 2軸移動: studentId だけでなく examPageId も更新する（移動先 ExamPage は id 直指定で受ける）。
 * - 採点はページ scoped: 移動元ページの CropRegion × 現生徒の QuestionScore/ScoreDecision のみ対象。
 * - carry（追従・同一ページのみ）:
 *   - QuestionScore は unique が無いので **id 指定の updateMany で studentId 付け替え**（id 保持 →
 *     子の DrawingAnnotation を温存。swap も id 指定なので途中衝突なし）。
 *   - ScoreDecision は `@@unique([cropRegionId, studentId])` があるため **delete → 最終位置へ再作成**。
 * - discard: DrawingAnnotation を tombstone してから両スコア表を削除。
 * - **移動先セルの残存採点を掃除**: 移動先 (finalStudentId, 移動先ページの CropRegion) に既存の
 *   採点があり、それが「移動してくる採点（moving 集合）」でない場合は stale として削除する
 *   （さもないと carry で QuestionScore が二重計上、ScoreDecision は unique 違反になる）。
 * - 画像は `@@unique([examPageId, studentId])` の 2-cycle を避けるため **delete → 同一 id で再作成**。
 * - ガード: carry かつページ変化はエラー。finalStudentId=null（削除）は不可（削除は別操作）。
 *   移動先が batch 外の答案で占有されている場合もエラー（上書きはしない）。
 *
 * いずれも基本的な Prisma 操作のみ（findMany/updateMany/deleteMany/createMany）。
 */
import type { Prisma } from "@prisma/client"

import prisma from "../client"
import { recordDrawingAnnotationDeletionsForQuestionScores } from "../deletedRecord"

export type PlacementScorePolicy = "carry" | "discard"

export interface StudentAnswerPlacementMove {
  fileId: string
  finalStudentId: string | null // null は不可（本APIは削除を扱わない）
  finalExamPageId: string
  scorePolicy: PlacementScorePolicy
}

/**
 * 複数の答案配置を採点安全に一括適用する。
 * @param moves スロット置換を表す移動の配列（swap は両方を含む／空マスへは移動）
 */
export async function applyStudentAnswerPlacements(
  moves: StudentAnswerPlacementMove[]
) {
  if (moves.length === 0) return { success: true }

  // 本APIは配置の移動/入れ替え専用。削除は deleteStudentAnswer（ファイル削除・監査込み）を使う。
  const nullMove = moves.find((move) => move.finalStudentId === null)
  if (nullMove) {
    return {
      success: false,
      error:
        "配置適用では画像の削除はできません（削除は別操作を使用してください）",
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. 現在の配置を取得（再作成のため imagePath/createdAt も保持）
      const currentAnswers = await Promise.all(
        moves.map((move) =>
          tx.studentAnswerImage.findUnique({
            where: { id: move.fileId },
            select: {
              id: true,
              studentId: true,
              examPageId: true,
              imagePath: true,
              createdAt: true,
              examPage: { select: { examId: true } },
            },
          })
        )
      )
      const missingIndex = currentAnswers.findIndex(
        (currentAnswer) => !currentAnswer
      )
      if (missingIndex !== -1) {
        throw new Error(`答案が見つかりません: ${moves[missingIndex].fileId}`)
      }

      // 2. ターゲット examPageId 解決 + carry ガード
      type PlacementPlan = {
        move: StudentAnswerPlacementMove
        current: NonNullable<(typeof currentAnswers)[number]>
        finalStudentId: string
        targetExamPageId: string
      }
      const plans: PlacementPlan[] = []
      for (let index = 0; index < moves.length; index++) {
        const move = moves[index]
        const current = currentAnswers[index]!
        const finalStudentId = move.finalStudentId! // null は上で除外済み

        // 移動先 ExamPage は id 直指定。同一試験のページであることのみ検証する
        // （pageNumber 序数への解決はしない＝id 一次同定）。
        const targetPage = await tx.examPage.findFirst({
          where: {
            id: move.finalExamPageId,
            examId: current.examPage.examId,
          },
          select: { id: true },
        })
        if (!targetPage) {
          throw new Error(
            `移動先ページが見つかりません: ${move.finalExamPageId}`
          )
        }

        const pageChanged = current.examPageId !== targetPage.id
        if (move.scorePolicy === "carry" && pageChanged) {
          throw new Error(
            "ページを跨ぐ移動では採点情報の追従はできません（破棄を選択してください）"
          )
        }

        plans.push({
          move,
          current,
          finalStudentId,
          targetExamPageId: targetPage.id,
        })
      }

      // 移動先が batch 外の答案で占有されていないか（上書きは不可、入れ替えのみ）
      const batchFileIds = plans.map((plan) => plan.move.fileId)
      for (const plan of plans) {
        const occupant = await tx.studentAnswerImage.findFirst({
          where: {
            examPageId: plan.targetExamPageId,
            studentId: plan.finalStudentId,
            id: { notIn: batchFileIds },
          },
          select: { id: true },
        })
        if (occupant) {
          throw new Error(
            "移動先に別の答案があります（入れ替えでのみ移動できます）"
          )
        }
      }

      // 3. 移動する採点（source）の収集。moving 集合も作る（移動先掃除で使う）。
      const questionScoreIdsToDelete: string[] = [] // discard source + stale destination
      const scoreDecisionIdsToDelete: string[] = [] // discard/carry source + stale destination
      const questionScoreCarryUpdates: Array<{
        ids: string[]
        finalStudentId: string
      }> = []
      const scoreDecisionsToRecreate: Prisma.ScoreDecisionCreateManyInput[] = []
      const movingQuestionScoreIds = new Set<string>()
      const movingScoreDecisionIds = new Set<string>()
      // 移動先掃除のための (finalStudentId, 移動先ページの cropRegionIds)
      const destinationScopes: Array<{
        finalStudentId: string
        cropRegionIds: string[]
      }> = []

      const cropRegionIdsByPage = new Map<string, string[]>()
      const getCropRegionIds = async (examPageId: string) => {
        const cached = cropRegionIdsByPage.get(examPageId)
        if (cached) return cached
        const cropRegions = await tx.cropRegion.findMany({
          where: { examPageId },
          select: { id: true },
        })
        const ids = cropRegions.map((cropRegion) => cropRegion.id)
        cropRegionIdsByPage.set(examPageId, ids)
        return ids
      }

      for (const plan of plans) {
        const sourceCropRegionIds = await getCropRegionIds(
          plan.current.examPageId
        )
        const targetCropRegionIds = await getCropRegionIds(
          plan.targetExamPageId
        )
        destinationScopes.push({
          finalStudentId: plan.finalStudentId,
          cropRegionIds: targetCropRegionIds,
        })

        if (sourceCropRegionIds.length === 0) continue

        const questionScores = await tx.questionScore.findMany({
          where: {
            studentId: plan.current.studentId,
            cropRegionId: { in: sourceCropRegionIds },
          },
          select: { id: true },
        })
        const scoreDecisions = await tx.scoreDecision.findMany({
          where: {
            studentId: plan.current.studentId,
            cropRegionId: { in: sourceCropRegionIds },
          },
        })
        questionScores.forEach((questionScore) =>
          movingQuestionScoreIds.add(questionScore.id)
        )
        scoreDecisions.forEach((scoreDecision) =>
          movingScoreDecisionIds.add(scoreDecision.id)
        )

        if (plan.move.scorePolicy === "discard") {
          questionScoreIdsToDelete.push(
            ...questionScores.map((questionScore) => questionScore.id)
          )
          scoreDecisionIdsToDelete.push(
            ...scoreDecisions.map((scoreDecision) => scoreDecision.id)
          )
        } else {
          // carry: QuestionScore は id 指定で studentId 付け替え（注釈を温存）
          if (questionScores.length > 0) {
            questionScoreCarryUpdates.push({
              ids: questionScores.map((questionScore) => questionScore.id),
              finalStudentId: plan.finalStudentId,
            })
          }
          // ScoreDecision は unique 回避のため delete → id 保持で最終位置へ再作成
          scoreDecisionIdsToDelete.push(
            ...scoreDecisions.map((scoreDecision) => scoreDecision.id)
          )
          scoreDecisionsToRecreate.push(
            ...scoreDecisions.map((scoreDecision) => ({
              id: scoreDecision.id,
              cropRegionId: scoreDecision.cropRegionId,
              studentId: plan.finalStudentId,
              verdict: scoreDecision.verdict,
              score: scoreDecision.score,
              comment: scoreDecision.comment,
              decidedByUserId: scoreDecision.decidedByUserId,
              decidedAt: scoreDecision.decidedAt,
              createdAt: scoreDecision.createdAt,
              sourceQuestionScoreId: scoreDecision.sourceQuestionScoreId,
            }))
          )
        }
      }

      // 3b. 移動先セルの残存採点（moving でないもの）を stale として掃除する。
      for (const scope of destinationScopes) {
        if (scope.cropRegionIds.length === 0) continue
        const staleQuestionScores = await tx.questionScore.findMany({
          where: {
            studentId: scope.finalStudentId,
            cropRegionId: { in: scope.cropRegionIds },
          },
          select: { id: true },
        })
        const staleScoreDecisions = await tx.scoreDecision.findMany({
          where: {
            studentId: scope.finalStudentId,
            cropRegionId: { in: scope.cropRegionIds },
          },
          select: { id: true },
        })
        for (const questionScore of staleQuestionScores) {
          if (!movingQuestionScoreIds.has(questionScore.id)) {
            questionScoreIdsToDelete.push(questionScore.id)
          }
        }
        for (const scoreDecision of staleScoreDecisions) {
          if (!movingScoreDecisionIds.has(scoreDecision.id)) {
            scoreDecisionIdsToDelete.push(scoreDecision.id)
          }
        }
      }

      // 4. QuestionScore: DrawingAnnotation を tombstone してから削除
      if (questionScoreIdsToDelete.length > 0) {
        await recordDrawingAnnotationDeletionsForQuestionScores(
          questionScoreIdsToDelete,
          { tx }
        )
        await tx.questionScore.deleteMany({
          where: { id: { in: questionScoreIdsToDelete } },
        })
      }

      // 5. carry の QuestionScore: id 指定で studentId 付け替え（行=注釈を保持）
      for (const carryUpdate of questionScoreCarryUpdates) {
        await tx.questionScore.updateMany({
          where: { id: { in: carryUpdate.ids } },
          data: { studentId: carryUpdate.finalStudentId },
        })
      }

      // 6. ScoreDecision: 対象を削除 → carry 分を最終位置へ再作成（unique 回避）
      if (scoreDecisionIdsToDelete.length > 0) {
        await tx.scoreDecision.deleteMany({
          where: { id: { in: scoreDecisionIdsToDelete } },
        })
      }
      if (scoreDecisionsToRecreate.length > 0) {
        await tx.scoreDecision.createMany({ data: scoreDecisionsToRecreate })
      }

      // 7. 画像移動: delete → 同一 id で再作成（2-cycle 回避、id/imagePath/createdAt 保持）
      await tx.studentAnswerImage.deleteMany({
        where: { id: { in: batchFileIds } },
      })
      await tx.studentAnswerImage.createMany({
        data: plans.map((plan) => ({
          id: plan.move.fileId,
          examPageId: plan.targetExamPageId,
          studentId: plan.finalStudentId,
          imagePath: plan.current.imagePath,
          createdAt: plan.current.createdAt,
        })),
      })
    })

    return { success: true }
  } catch (error) {
    console.error("Error applying student answer placements:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案配置の適用に失敗しました",
    }
  }
}
