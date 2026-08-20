/**
 * 答案配置の採点安全な一括適用（view の方式B: 任意マスへ移動・衝突swap）
 *
 * 設計:
 * - 2軸移動: examStudentId だけでなく examPageId も更新する（移動先 ExamPage は id 直指定で受ける）。
 * - 採点はページ scoped: 移動元ページの CropRegion / CompoundAnswer × 現生徒の
 *   QuestionScore / ScoreDecision / CompoundAnswerScore のみ対象。
 * - carry（追従・同一ページのみ）:
 *   - QuestionScore は unique が無いので **id 指定の updateMany で examStudentId 付け替え**（id 保持 →
 *     子の DrawingAnnotation を温存。swap も id 指定なので途中衝突なし）。
 *   - ScoreDecision は `@@unique([cropRegionId, examStudentId])` があるため **delete → 最終位置へ再作成**。
 *   - CompoundAnswerScore も `@@unique([compoundAnswerId, examStudentId])` があるため同じく再作成方式。
 * - discard: 各スコア表（QuestionScore / ScoreDecision / CompoundAnswerScore）を削除。
 *   DrawingAnnotation は QuestionScore の cascade で道連れになる。
 * - **移動先セルの残存採点を掃除**: 移動先 (finalExamStudentId, 移動先ページの CropRegion /
 *   CompoundAnswer) に既存の採点があり、それが「移動してくる採点（moving 集合）」でない場合は
 *   stale として削除する（さもないと carry で QuestionScore が二重計上、ScoreDecision と
 *   CompoundAnswerScore は unique 違反になる）。
 * - 画像は `@@unique([examPageId, examStudentId])` の 2-cycle を避けるため **delete → 同一 id で再作成**。
 * - ガード: carry かつページ変化はエラー。finalExamStudentId=null（削除）は不可（削除は別操作）。
 *   移動先が batch 外の答案で占有されている場合もエラー（上書きはしない）。
 *
 * いずれも基本的な Prisma 操作のみ（findMany/updateMany/deleteMany/createMany）。
 *
 * ## 前提（実コードで確認済み・崩すと壊れる）
 *
 * - **FK は実行時強制**。衝突回避のために偽IDの一時レコードを挟む方式は FK 違反で壊れる
 *   （旧 `batchUpdateStudentAnswerPlacements`/`swap*` がそれで破綻していた）。
 *   本APIが一時IDを使わず delete → 再作成で表現しているのはこのため。
 * - **delete → 同一 id での再作成は sqlite-nas-sync 上で安全**。`sync.ts` の tombstone-ignore が
 *   「現存すれば再作成とみなす」ため、削除が同期先で復活を潰さない。**必ず id を保持すること**
 *   （新しい id を振ると別レコードとして増える）。
 * - 二次 `@@unique`（`[cropRegionId, examStudentId]` 等）の衝突は `conflict.ts` ケース2 が
 *   LWW で単一行に収束させる。**ただしこれは「敗者行に子がいない場合に限る」**（実測:
 *   docs/sync-secondary-unique-hazard.md）。敗者に子がいると、その子はカスケードで消え、
 *   さらに負けた側ではなく**勝った側の端末**が子の INSERT で外部キー違反を起こして取り込みが
 *   丸ごと巻き戻り、**その相手からの以後すべての変更が永久に届かなくなる**。ここで扱う
 *   `ScoreDecision` / `CompoundAnswerScore` / `StudentAnswerImage` はいずれも子を持たないので
 *   該当しないが、「全表汎用だから個別対応は不要」とは言えない（該当は10モデル、最重は
 *   `ExamStudent`）。
 */
import type { Prisma } from "@prisma/client"

import prisma from "../client"
import { getPageScoreScope, type PageScoreScope } from "./pageScope"

/**
 * 移動1件ごとの採点データ処理方針（view 方式B）。
 * - carry: 採点も追従（同一ページの生徒付け替えのみ可）
 * - discard: 採点を破棄（要再採点。ページ跨ぎは常にこれ）
 */
export type PlacementScorePolicy = "carry" | "discard"

export interface StudentAnswerPlacementMove {
  fileId: string
  finalExamStudentId: string | null // null は不可（本APIは削除を扱わない）
  finalExamPageId: string
  scorePolicy: PlacementScorePolicy
}

/**
 * 複数の答案配置を採点安全に一括適用する。
 *
 * **失敗は例外で伝える。** 以前は `{ success: false }` を返していたが、呼び出し側は
 * 例外だけを見ているので、失敗が「N件を反映しました」として通り抜けていた
 * （画面は閉じ、控えていた変更も消え、DB は変わっていない）。
 *
 * @param moves スロット置換を表す移動の配列（swap は両方を含む／空マスへは移動）
 */
export async function applyStudentAnswerPlacements(
  moves: StudentAnswerPlacementMove[]
): Promise<void> {
  if (moves.length === 0) return

  // 本APIは配置の移動/入れ替え専用。削除は deleteStudentAnswer（ファイル削除・監査込み）を使う。
  const nullMove = moves.find((move) => move.finalExamStudentId === null)
  if (nullMove) {
    throw new Error(
      "配置適用では画像の削除はできません（削除は別操作を使用してください）"
    )
  }

  await prisma.$transaction(
    async (tx) => {
      // 1. 現在の配置を取得（再作成のため imagePath/createdAt も保持）
      const currentAnswers = await Promise.all(
        moves.map((move) =>
          tx.studentAnswerImage.findUnique({
            where: { id: move.fileId },
            include: { examPage: true },
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
        finalExamStudentId: string
        targetExamPageId: string
      }
      const plans: PlacementPlan[] = []
      for (let index = 0; index < moves.length; index++) {
        const move = moves[index]
        const current = currentAnswers[index]!
        const finalExamStudentId = move.finalExamStudentId! // null は上で除外済み

        // 移動先 ExamPage は id 直指定。同一試験のページであることのみ検証する
        // （pageNumber 序数への解決はしない＝id 一次同定）。
        const targetPage = await tx.examPage.findFirst({
          where: {
            id: move.finalExamPageId,
            examId: current.examPage.examId,
          },
        })
        if (!targetPage) {
          throw new Error(
            `移動先ページが見つかりません: ${move.finalExamPageId}`
          )
        }

        // 移動先の受験者も同一試験のものであること。ページと受験者は別々の FK なので、
        // ページだけ検証しても「試験Aのページに試験Bの受験者の答案」が作れてしまう。
        const targetExamStudent = await tx.examStudent.findFirst({
          where: {
            id: finalExamStudentId,
            examId: current.examPage.examId,
          },
        })
        if (!targetExamStudent) {
          throw new Error(
            `移動先の受験者が見つかりません: ${finalExamStudentId}`
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
          finalExamStudentId,
          targetExamPageId: targetPage.id,
        })
      }

      // 移動先が batch 外の答案で占有されていないか（上書きは不可、入れ替えのみ）
      const batchFileIds = plans.map((plan) => plan.move.fileId)
      for (const plan of plans) {
        const occupant = await tx.studentAnswerImage.findFirst({
          where: {
            examPageId: plan.targetExamPageId,
            examStudentId: plan.finalExamStudentId,
            id: { notIn: batchFileIds },
          },
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
        finalExamStudentId: string
      }> = []
      const scoreDecisionsToRecreate: Prisma.ScoreDecisionCreateManyInput[] = []
      // 複合回答も CropRegion と同じくページ scoped。`@@unique([compoundAnswerId, examStudentId])`
      // があるため ScoreDecision と同様 delete → 再作成で付け替える。
      const compoundAnswerScoreIdsToDelete: string[] = []
      const compoundAnswerScoresToRecreate: Prisma.CompoundAnswerScoreCreateManyInput[] =
        []
      const movingQuestionScoreIds = new Set<string>()
      const movingScoreDecisionIds = new Set<string>()
      const movingCompoundAnswerScoreIds = new Set<string>()
      // 移動先掃除のための (finalExamStudentId, 移動先ページの cropRegionIds/compoundAnswerIds)
      const destinationScopes: Array<{
        finalExamStudentId: string
        cropRegionIds: string[]
        compoundAnswerIds: string[]
      }> = []

      // ページ scope は crud.ts の削除と共有（getPageScoreScope）。同じページを何度も
      // 引かないようトランザクション内でキャッシュする。
      const scopeByPage = new Map<string, PageScoreScope>()
      const getScope = async (examPageId: string) => {
        const cached = scopeByPage.get(examPageId)
        if (cached) return cached
        const scope = await getPageScoreScope(tx, examPageId)
        scopeByPage.set(examPageId, scope)
        return scope
      }

      for (const plan of plans) {
        const sourceScope = await getScope(plan.current.examPageId)
        const targetScope = await getScope(plan.targetExamPageId)
        const sourceCropRegionIds = sourceScope.cropRegionIds
        const sourceCompoundAnswerIds = sourceScope.compoundAnswerIds
        destinationScopes.push({
          finalExamStudentId: plan.finalExamStudentId,
          cropRegionIds: targetScope.cropRegionIds,
          compoundAnswerIds: targetScope.compoundAnswerIds,
        })

        // 複合回答の採点（carry は同一ページ限定なので compoundAnswerId はそのまま使える）
        if (sourceCompoundAnswerIds.length > 0) {
          const compoundAnswerScores = await tx.compoundAnswerScore.findMany({
            where: {
              examStudentId: plan.current.examStudentId,
              compoundAnswerId: { in: sourceCompoundAnswerIds },
            },
          })
          compoundAnswerScores.forEach((compoundAnswerScore) =>
            movingCompoundAnswerScoreIds.add(compoundAnswerScore.id)
          )
          compoundAnswerScoreIdsToDelete.push(
            ...compoundAnswerScores.map(
              (compoundAnswerScore) => compoundAnswerScore.id
            )
          )
          if (plan.move.scorePolicy === "carry") {
            compoundAnswerScoresToRecreate.push(
              ...compoundAnswerScores.map((compoundAnswerScore) => ({
                id: compoundAnswerScore.id,
                compoundAnswerId: compoundAnswerScore.compoundAnswerId,
                examStudentId: plan.finalExamStudentId,
                userId: compoundAnswerScore.userId,
                recognizedAnswer: compoundAnswerScore.recognizedAnswer,
                status: compoundAnswerScore.status,
                partialScore: compoundAnswerScore.partialScore,
                createdAt: compoundAnswerScore.createdAt,
              }))
            )
          }
        }

        if (sourceCropRegionIds.length === 0) continue

        const questionScores = await tx.questionScore.findMany({
          where: {
            examStudentId: plan.current.examStudentId,
            cropRegionId: { in: sourceCropRegionIds },
          },
        })
        const scoreDecisions = await tx.scoreDecision.findMany({
          where: {
            examStudentId: plan.current.examStudentId,
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
          // carry: QuestionScore は id 指定で examStudentId 付け替え（注釈を温存）
          if (questionScores.length > 0) {
            questionScoreCarryUpdates.push({
              ids: questionScores.map((questionScore) => questionScore.id),
              finalExamStudentId: plan.finalExamStudentId,
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
              examStudentId: plan.finalExamStudentId,
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
        if (scope.compoundAnswerIds.length > 0) {
          const staleCompoundAnswerScores =
            await tx.compoundAnswerScore.findMany({
              where: {
                examStudentId: scope.finalExamStudentId,
                compoundAnswerId: { in: scope.compoundAnswerIds },
              },
            })
          for (const compoundAnswerScore of staleCompoundAnswerScores) {
            if (!movingCompoundAnswerScoreIds.has(compoundAnswerScore.id)) {
              compoundAnswerScoreIdsToDelete.push(compoundAnswerScore.id)
            }
          }
        }

        if (scope.cropRegionIds.length === 0) continue
        const staleQuestionScores = await tx.questionScore.findMany({
          where: {
            examStudentId: scope.finalExamStudentId,
            cropRegionId: { in: scope.cropRegionIds },
          },
        })
        const staleScoreDecisions = await tx.scoreDecision.findMany({
          where: {
            examStudentId: scope.finalExamStudentId,
            cropRegionId: { in: scope.cropRegionIds },
          },
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

      // 4. QuestionScore を削除（DrawingAnnotation は cascade で道連れ）
      if (questionScoreIdsToDelete.length > 0) {
        await tx.questionScore.deleteMany({
          where: { id: { in: questionScoreIdsToDelete } },
        })
      }

      // 5. carry の QuestionScore: id 指定で examStudentId 付け替え（行=注釈を保持）
      for (const carryUpdate of questionScoreCarryUpdates) {
        await tx.questionScore.updateMany({
          where: { id: { in: carryUpdate.ids } },
          data: { examStudentId: carryUpdate.finalExamStudentId },
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

      // 6b. CompoundAnswerScore: 同様に削除 → carry 分を最終位置へ再作成
      if (compoundAnswerScoreIdsToDelete.length > 0) {
        await tx.compoundAnswerScore.deleteMany({
          where: { id: { in: compoundAnswerScoreIdsToDelete } },
        })
      }
      if (compoundAnswerScoresToRecreate.length > 0) {
        await tx.compoundAnswerScore.createMany({
          data: compoundAnswerScoresToRecreate,
        })
      }

      // 7. 画像移動: delete → 同一 id で再作成（2-cycle 回避、id/imagePath/createdAt 保持）
      await tx.studentAnswerImage.deleteMany({
        where: { id: { in: batchFileIds } },
      })
      await tx.studentAnswerImage.createMany({
        data: plans.map((plan) => ({
          id: plan.move.fileId,
          examPageId: plan.targetExamPageId,
          examStudentId: plan.finalExamStudentId,
          imagePath: plan.current.imagePath,
          createdAt: plan.current.createdAt,
        })),
      })
    },
    // 学級分の一括移動では plan ごとの照会と tombstone の逐次 upsert が積み上がり、
    // 既定の 5s を超えうる（超えると P2028 で全体がロールバックする）。
    { timeout: 30000 }
  )
}
