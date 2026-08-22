/**
 * 答案配置の採点安全な一括適用（view の方式B: 任意マスへ移動・衝突swap）
 *
 * 設計:
 * - 2軸移動: examStudentId だけでなく examPageId も更新する（移動先 ExamPage は id 直指定で受ける）。
 * - 採点はページ scoped: 移動元ページの CropRegion / CompoundAnswer × 現生徒の
 *   QuestionScore / ScoreDecision / CompoundAnswerScore のみ対象。
 * - carry（追従・同一ページのみ）:
 *   - QuestionScore は unique が無いので **id 指定の updateMany で examStudentId 付け替え**
 *     （id 保持 → 子の DrawingAnnotation を温存）。
 *   - unique を持つ ScoreDecision / CompoundAnswerScore / StudentAnswerImage は
 *     `slotPermutation.ts` の計画に従う（移動先が空くなら行ごと動かし、空かない輪は
 *     行をスロットに残して中身だけ回す）。**削除→再作成はしない**。
 * - discard: 各スコア表（QuestionScore / ScoreDecision / CompoundAnswerScore）を削除。
 *   DrawingAnnotation は QuestionScore の cascade で道連れになる。
 * - **移動先セルの残存採点を掃除**: 移動先 (finalExamStudentId, 移動先ページの CropRegion /
 *   CompoundAnswer) に既存の採点があり、それが「移動してくる採点（moving 集合）」でない場合は
 *   stale として削除する（さもないと carry で QuestionScore が二重計上、ScoreDecision と
 *   CompoundAnswerScore は unique 違反になる）。
 * - ガード: carry かつページ変化はエラー。finalExamStudentId=null（削除）は不可（削除は別操作）。
 *   移動先が batch 外の答案で占有されている場合もエラー（上書きはしない）。
 *
 * いずれも基本的な Prisma 操作のみ（findMany/updateMany/deleteMany/update）。
 *
 * ## 前提（実コードで確認済み・崩すと壊れる）
 *
 * - **FK は実行時強制**。衝突回避のために偽IDの一時レコードを挟む方式は FK 違反で壊れる
 *   （旧 `batchUpdateStudentAnswerPlacements`/`swap*` がそれで破綻していた）。
 * - **delete → 同一 id での再作成は NAS 同期を越えられない**（2026-08 実測。
 *   `__tests__/sync/studentAnswerPlacementSync.test.ts`）。`sqlite-nas-sync` の
 *   `deduplicateEntries` が同じ (表, id) のエントリを最後の1件へ畳むため、相手には
 *   **INSERT 1件**しか届かず、相手はそれを主キー衝突として `applyInsert` のケース1
 *   （素の UPDATE）で当てる。そこがセカンダリ unique に当たると例外が catch されず、
 *   取り込みが丸ごと巻き戻り `lastSeenId` も進まない ＝ **その相手からの変更が以後
 *   永久に届かなくなる**。実測では「生徒swap」と「相手が移動先に自分の行を持っていた」の
 *   両方で `UNIQUE constraint failed: ScoreDecision.cropRegionId, ScoreDecision.examStudentId`
 *   が出て同期が止まった。ここに削除→再作成を戻してはいけない。
 * - 上と同じ理由で、**入れ替え（輪）を unique キーの書き換えで表現することもできない**。
 *   相手は変更を1件ずつ当てるので、どの順でも途中で2行が同じスロットに乗る。輪だけは
 *   「行をスロットに残して中身を回す」以外に手が無い（`slotPermutation.ts` 参照）。
 * - 二次 `@@unique` の衝突そのものは `conflict.ts` の `applyUpdate` が LWW で畳んでくれる。
 *   **ただしこれは「敗者行に子がいない場合に限る」**（実測: docs/sync-secondary-unique-hazard.md）。
 *   ここで扱う `ScoreDecision` / `CompoundAnswerScore` / `StudentAnswerImage` はいずれも
 *   子を持たないので該当しないが、「全表汎用だから個別対応は不要」とは言えない
 *   （該当は10モデル、最重は `ExamStudent`）。
 */
import prisma from "../client"
import { getPageScoreScope, type PageScoreScope } from "./pageScope"
import { planSlotPermutation, type SlotOccupant } from "./slotPermutation"

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

/** 答案画像のスロット（`@@unique([examPageId, examStudentId])`）を1つの文字列で表す */
const imageSlot = (examPageId: string, examStudentId: string): string =>
  `${examPageId}|${examStudentId}`

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
      // 1. 現在の配置を取得
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

      // 3. 削除対象の収集。moving 集合も作る（移動先掃除で「動いてくる行」を除くのに使う）。
      const questionScoreIdsToDelete: string[] = [] // discard source + stale destination
      const scoreDecisionIdsToDelete: string[] = [] // discard source + stale destination
      const compoundAnswerScoreIdsToDelete: string[] = []
      const questionScoreCarryUpdates: Array<{
        ids: string[]
        finalExamStudentId: string
      }> = []
      const movingQuestionScoreIds = new Set<string>()
      const movingScoreDecisionIds = new Set<string>()
      const movingCompoundAnswerScoreIds = new Set<string>()
      // 移動先掃除のための (finalExamStudentId, 移動先ページの cropRegionIds/compoundAnswerIds)
      const destinationScopes: Array<{
        finalExamStudentId: string
        cropRegionIds: string[]
        compoundAnswerIds: string[]
      }> = []
      /** carry が表すスロット置換（同一ページ内なので受験者の置換になる） */
      const carryDestinationsByPage = new Map<string, Map<string, string>>()

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

        if (plan.move.scorePolicy === "carry") {
          const destinations =
            carryDestinationsByPage.get(plan.targetExamPageId) ??
            new Map<string, string>()
          destinations.set(plan.current.examStudentId, plan.finalExamStudentId)
          carryDestinationsByPage.set(plan.targetExamPageId, destinations)
        }

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
          if (plan.move.scorePolicy === "discard") {
            compoundAnswerScoreIdsToDelete.push(
              ...compoundAnswerScores.map(
                (compoundAnswerScore) => compoundAnswerScore.id
              )
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
        } else if (questionScores.length > 0) {
          // carry: QuestionScore は id 指定で examStudentId 付け替え（注釈を温存）。
          // unique が無いので途中で衝突しない — swap も2連発でよい。
          questionScoreCarryUpdates.push({
            ids: questionScores.map((questionScore) => questionScore.id),
            finalExamStudentId: plan.finalExamStudentId,
          })
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

      // 4. 削除（QuestionScore の DrawingAnnotation は cascade で道連れ）。
      //    carry の置換より先に済ませて、移動先スロットを空けておく。
      if (questionScoreIdsToDelete.length > 0) {
        await tx.questionScore.deleteMany({
          where: { id: { in: questionScoreIdsToDelete } },
        })
      }
      if (scoreDecisionIdsToDelete.length > 0) {
        await tx.scoreDecision.deleteMany({
          where: { id: { in: scoreDecisionIdsToDelete } },
        })
      }
      if (compoundAnswerScoreIdsToDelete.length > 0) {
        await tx.compoundAnswerScore.deleteMany({
          where: { id: { in: compoundAnswerScoreIdsToDelete } },
        })
      }

      // 5. carry の QuestionScore: id 指定で examStudentId 付け替え（行=注釈を保持）
      for (const carryUpdate of questionScoreCarryUpdates) {
        await tx.questionScore.updateMany({
          where: { id: { in: carryUpdate.ids } },
          data: { examStudentId: carryUpdate.finalExamStudentId },
        })
      }

      // 6. carry の ScoreDecision / CompoundAnswerScore: unique を壊さない手順で置換する。
      //    削除は済んでいるので、ここで見える行がそのままスロットの住人になる。
      for (const [examPageId, destinations] of carryDestinationsByPage) {
        const scope = await getScope(examPageId)
        const involvedExamStudentIds = Array.from(
          new Set([...destinations.keys(), ...destinations.values()])
        )

        if (scope.cropRegionIds.length > 0) {
          const scoreDecisions = await tx.scoreDecision.findMany({
            where: {
              cropRegionId: { in: scope.cropRegionIds },
              examStudentId: { in: involvedExamStudentIds },
            },
          })
          const scoreDecisionById = new Map(
            scoreDecisions.map((scoreDecision) => [
              scoreDecision.id,
              scoreDecision,
            ])
          )
          const occupantsByCropRegion = new Map<string, SlotOccupant[]>()
          for (const scoreDecision of scoreDecisions) {
            const occupants =
              occupantsByCropRegion.get(scoreDecision.cropRegionId) ?? []
            occupants.push({
              rowId: scoreDecision.id,
              slot: scoreDecision.examStudentId,
            })
            occupantsByCropRegion.set(scoreDecision.cropRegionId, occupants)
          }

          for (const occupants of occupantsByCropRegion.values()) {
            const permutation = planSlotPermutation(occupants, destinations)
            for (const keyMove of permutation.keyMoves) {
              await tx.scoreDecision.update({
                where: { id: keyMove.rowId },
                data: { examStudentId: keyMove.toSlot },
              })
            }
            for (const payloadCopy of permutation.payloadCopies) {
              const source = scoreDecisionById.get(payloadCopy.fromRowId)!
              await tx.scoreDecision.update({
                where: { id: payloadCopy.intoRowId },
                data: {
                  verdict: source.verdict,
                  score: source.score,
                  comment: source.comment,
                  decidedByUserId: source.decidedByUserId,
                  decidedAt: source.decidedAt,
                  createdAt: source.createdAt,
                },
              })
            }
          }
        }

        if (scope.compoundAnswerIds.length === 0) continue
        const compoundAnswerScores = await tx.compoundAnswerScore.findMany({
          where: {
            compoundAnswerId: { in: scope.compoundAnswerIds },
            examStudentId: { in: involvedExamStudentIds },
          },
        })
        const compoundAnswerScoreById = new Map(
          compoundAnswerScores.map((compoundAnswerScore) => [
            compoundAnswerScore.id,
            compoundAnswerScore,
          ])
        )
        const occupantsByCompoundAnswer = new Map<string, SlotOccupant[]>()
        for (const compoundAnswerScore of compoundAnswerScores) {
          const occupants =
            occupantsByCompoundAnswer.get(
              compoundAnswerScore.compoundAnswerId
            ) ?? []
          occupants.push({
            rowId: compoundAnswerScore.id,
            slot: compoundAnswerScore.examStudentId,
          })
          occupantsByCompoundAnswer.set(
            compoundAnswerScore.compoundAnswerId,
            occupants
          )
        }

        for (const occupants of occupantsByCompoundAnswer.values()) {
          const permutation = planSlotPermutation(occupants, destinations)
          for (const keyMove of permutation.keyMoves) {
            await tx.compoundAnswerScore.update({
              where: { id: keyMove.rowId },
              data: { examStudentId: keyMove.toSlot },
            })
          }
          for (const payloadCopy of permutation.payloadCopies) {
            const source = compoundAnswerScoreById.get(payloadCopy.fromRowId)!
            await tx.compoundAnswerScore.update({
              where: { id: payloadCopy.intoRowId },
              data: {
                userId: source.userId,
                recognizedAnswer: source.recognizedAnswer,
                status: source.status,
                partialScore: source.partialScore,
                createdAt: source.createdAt,
              },
            })
          }
        }
      }

      // 7. 答案画像も同じ手順で置換する（`@@unique([examPageId, examStudentId])`）。
      //    ページ跨ぎもあるのでスロットは (ページ, 受験者) の組。
      const imageDestinations = new Map<string, string>()
      const imageSlotColumns = new Map<
        string,
        { examPageId: string; examStudentId: string }
      >()
      const imageOccupants: SlotOccupant[] = plans.map((plan) => {
        const fromSlot = imageSlot(
          plan.current.examPageId,
          plan.current.examStudentId
        )
        const toSlot = imageSlot(plan.targetExamPageId, plan.finalExamStudentId)
        imageDestinations.set(fromSlot, toSlot)
        imageSlotColumns.set(toSlot, {
          examPageId: plan.targetExamPageId,
          examStudentId: plan.finalExamStudentId,
        })
        return { rowId: plan.move.fileId, slot: fromSlot }
      })
      const imageById = new Map(
        plans.map((plan) => [plan.move.fileId, plan.current])
      )
      const imagePermutation = planSlotPermutation(
        imageOccupants,
        imageDestinations
      )
      for (const keyMove of imagePermutation.keyMoves) {
        const columns = imageSlotColumns.get(keyMove.toSlot)!
        await tx.studentAnswerImage.update({
          where: { id: keyMove.rowId },
          data: {
            examPageId: columns.examPageId,
            examStudentId: columns.examStudentId,
          },
        })
      }
      for (const payloadCopy of imagePermutation.payloadCopies) {
        const source = imageById.get(payloadCopy.fromRowId)!
        await tx.studentAnswerImage.update({
          where: { id: payloadCopy.intoRowId },
          data: {
            imagePath: source.imagePath,
            createdAt: source.createdAt,
          },
        })
      }
    },
    // 学級分の一括移動では plan ごとの照会が積み上がり、既定の 5s を超えうる
    // （超えると P2028 で全体がロールバックする）。
    { timeout: 30000 }
  )
}
