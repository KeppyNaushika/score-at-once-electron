/**
 * 解答用紙を「この姿にしろ」と丸ごと置き換える経路。
 *
 * 木をまるごと受け取るのは、**本当に全体を指定する操作**のためにある
 * （docs/asb-ipc-split-plan.md §4.5）。
 *
 * | 経路               | なぜ全体なのか                                   |
 * | ------------------ | ------------------------------------------------ |
 * | 新規作成           | まだ何も無いところへ、既定の姿を丸ごと置く       |
 * | undo / redo        | 「過去の姿」であって、対応する1つの意図が無い    |
 * | 複製               | 元の姿をそのまま別の id で置く                   |
 * | アーカイブ取り込み | ファイルに書かれた姿をそのまま置く               |
 *
 * **日常の編集をここへ流さない。** 1件の編集は実体ごとの書き込み（`asbHeaderField.ts`
 * などの `create` / `update` / `delete` / `reorder`）が受け持つ。ここへ流すと、触って
 * いないレコードの値まで IPC に載り、同期で先へ進んだ相手の編集を巻き戻す。名前が
 * `save` だった頃は、実際に通常編集がここへ流れ込んでいた。
 *
 * **置き換えても、残るものは残す。** 以前は全消しして作り直していたため、保存のたびに
 * 作成日時が「今」へ戻り、全行の削除と挿入が同期の変更履歴へ流れていた。全消しをやめた
 * 後も全行を上書きしていたため、触っていない行まで `updatedAt` が動いていた（同時編集で
 * 相手の木を丸ごと倒す。`rowDiff.ts` を参照）。
 *
 * 列を知っているのは実体ごとのモジュールで、ここは**どの行が残るかを決めて、それらを
 * 順に通すだけ**。
 */

import type { AnswerSheetDefinition } from "../../../src/types/answerSheetDefinition.types"
import { deleteRemovedAsbBranchQuestions } from "./asbBranchQuestion"
import { deleteRemovedAsbCharGuides } from "./asbCharGuide"
import { asbDefinitionRow } from "./asbDefinition"
import { assertAsbDefinitionEditableBy } from "./asbDefinitionWrite"
import {
  deleteRemovedAsbHeaderFields,
  writeAsbHeaderField,
} from "./asbHeaderField"
import { deleteRemovedAsbImageElements } from "./asbImageElement"
import {
  deleteRemovedAsbMajorQuestions,
  writeAsbMajorQuestionTree,
} from "./asbMajorQuestion"
import { deleteRemovedAsbOmrConfigs } from "./asbOmrConfig"
import { deleteRemovedAsbSubQuestions } from "./asbSubQuestion"
import { deleteRemovedAsbTextElements } from "./asbTextElement"
import { recordAuditLog } from "./auditLog"
import prisma from "./client"
import { byId, writeRow } from "./rowDiff"

/** 置き換えたあとに残るべき id を、木を辿って集めたもの */
interface SurvivingIds {
  headerFields: string[]
  majorQuestions: string[]
  subQuestions: string[]
  branchQuestions: string[]
  charGuides: string[]
  textElements: string[]
  imageElements: string[]
  /** OMR設定を持つ小問・枝問（設定自体は id を持ち回らないので親で数える） */
  omrSubQuestions: string[]
  omrBranchQuestions: string[]
}

function collectSurvivingIds(definition: AnswerSheetDefinition): SurvivingIds {
  const surviving: SurvivingIds = {
    headerFields: definition.settings.headerFields.map(
      (headerField) => headerField.id
    ),
    majorQuestions: [],
    subQuestions: [],
    branchQuestions: [],
    charGuides: [],
    textElements: [],
    imageElements: [],
    omrSubQuestions: [],
    omrBranchQuestions: [],
  }

  for (const majorQuestion of definition.majorQuestions) {
    surviving.majorQuestions.push(majorQuestion.id)
    for (const subQuestion of majorQuestion.subQuestions) {
      surviving.subQuestions.push(subQuestion.id)
      for (const charGuide of subQuestion.manuscriptPaper?.charGuides ?? []) {
        surviving.charGuides.push(charGuide.id)
      }
      for (const textElement of subQuestion.textElements) {
        surviving.textElements.push(textElement.id)
      }
      for (const imageElement of subQuestion.imageElements ?? []) {
        surviving.imageElements.push(imageElement.id)
      }
      if (subQuestion.omrConfig) {
        surviving.omrSubQuestions.push(subQuestion.id)
      }
      for (const branchQuestion of subQuestion.branchQuestions) {
        surviving.branchQuestions.push(branchQuestion.id)
        for (const textElement of branchQuestion.textElements) {
          surviving.textElements.push(textElement.id)
        }
        for (const imageElement of branchQuestion.imageElements ?? []) {
          surviving.imageElements.push(imageElement.id)
        }
        if (branchQuestion.omrConfig) {
          surviving.omrBranchQuestions.push(branchQuestion.id)
        }
      }
    }
  }
  return surviving
}

/**
 * 解答用紙を丸ごと置き換える。
 *
 * 置き換えられるのは担当者だけ（判定は操作者。`assertAsbDefinitionEditableBy`）。
 * **担当は置き換えでは変わらない。** `ownerUserId` は、まだ無い解答用紙を作るときに
 * 担当として書き込む値で、既にある解答用紙には使わない。
 */
export async function replaceAsbDefinition(
  definition: AnswerSheetDefinition,
  ownerUserId: string
): Promise<void> {
  const definitionId = definition.id
  const surviving = collectSurvivingIds(definition)
  let existed = false

  await prisma.$transaction(async (tx) => {
    const existingDefinition = await tx.asbDefinition.findUnique({
      where: { id: definitionId },
    })
    existed = existingDefinition !== null
    if (existingDefinition) {
      assertAsbDefinitionEditableBy(existingDefinition)
    }

    /**
     * この置き換えで DB を触ったか。
     *
     * 触っていない行を書かなくした結果、子だけが変わったときに解答用紙そのものの
     * `updatedAt` が動かなくなった。一覧の更新日時・並べ替え・期間フィルタが古い値を
     * 出すので、何か書いたら最後に親の時刻だけを進める。
     */
    let changed = false
    const mark = (wrote: boolean) => {
      if (wrote) changed = true
    }

    // 1. 無くなったものだけ消す（親が消えれば子は Cascade で消える）
    mark(
      await deleteRemovedAsbHeaderFields(
        tx,
        definitionId,
        surviving.headerFields
      )
    )
    mark(
      await deleteRemovedAsbMajorQuestions(
        tx,
        definitionId,
        surviving.majorQuestions
      )
    )
    mark(
      await deleteRemovedAsbSubQuestions(
        tx,
        definitionId,
        surviving.subQuestions
      )
    )
    mark(
      await deleteRemovedAsbBranchQuestions(
        tx,
        definitionId,
        surviving.branchQuestions
      )
    )
    mark(
      await deleteRemovedAsbCharGuides(tx, definitionId, surviving.charGuides)
    )
    mark(
      await deleteRemovedAsbTextElements(
        tx,
        definitionId,
        surviving.textElements
      )
    )
    mark(
      await deleteRemovedAsbImageElements(
        tx,
        definitionId,
        surviving.imageElements
      )
    )
    mark(
      await deleteRemovedAsbOmrConfigs(tx, definitionId, {
        subQuestionIds: surviving.omrSubQuestions,
        branchQuestionIds: surviving.omrBranchQuestions,
      })
    )

    // 2. いま DB にある行を引く（変わっていない行を書かないための突き合わせ先）
    const inDefinition = { majorQuestion: { definitionId } }
    const inSubQuestions = { subQuestion: inDefinition }
    const inCells = [inSubQuestions, { branchQuestion: inSubQuestions }]
    const currentHeaderFields = byId(
      await tx.asbHeaderField.findMany({ where: { definitionId } })
    )
    const current = {
      majorQuestions: byId(
        await tx.asbMajorQuestion.findMany({ where: { definitionId } })
      ),
      subQuestions: byId(
        await tx.asbSubQuestion.findMany({ where: inDefinition })
      ),
      branchQuestions: byId(
        await tx.asbBranchQuestion.findMany({ where: inSubQuestions })
      ),
      charGuides: byId(
        await tx.asbCharGuide.findMany({ where: inSubQuestions })
      ),
      textElements: byId(
        await tx.asbTextElement.findMany({ where: { OR: inCells } })
      ),
      imageElements: byId(
        await tx.asbImageElement.findMany({ where: { OR: inCells } })
      ),
    }

    // 3. 解答用紙そのもの。担当と作成日時は置き換えでは動かさない
    const definitionData = asbDefinitionRow(definition)
    mark(
      await writeRow(
        existingDefinition ?? undefined,
        definitionData,
        () =>
          tx.asbDefinition.create({
            data: {
              id: definitionId,
              userId: ownerUserId,
              ...definitionData,
            },
          }),
        () =>
          tx.asbDefinition.update({
            where: { id: definitionId },
            data: definitionData,
          })
      )
    )

    // 4. 木を辿って、変わった行だけを書く。並び順は木の中の位置がそのまま
    for (const [
      headerFieldOrder,
      headerField,
    ] of definition.settings.headerFields.entries()) {
      mark(
        await writeAsbHeaderField(
          tx,
          definitionId,
          headerField,
          headerFieldOrder,
          currentHeaderFields.get(headerField.id)
        )
      )
    }

    for (const [
      majorQuestionOrder,
      majorQuestion,
    ] of definition.majorQuestions.entries()) {
      mark(
        await writeAsbMajorQuestionTree(
          tx,
          definitionId,
          majorQuestion,
          majorQuestionOrder,
          current
        )
      )
    }

    // 子だけが変わったときも「解答用紙が更新された」ことは一覧へ出す。
    // 空の data では `@updatedAt` は動かないので（実測）、時刻を明示的に渡す
    if (changed) {
      await tx.asbDefinition.update({
        where: { id: definitionId },
        data: { updatedAt: new Date() },
      })
    }
  })

  // 監査ログ: 解答用紙の作成/更新
  await recordAuditLog({
    action: existed ? "answer_sheet.update" : "answer_sheet.create",
    userId: ownerUserId,
    entityType: "AsbDefinition",
    entityId: definitionId,
    scopeId: definitionId,
    scopeLabel: definition.name,
    target: definition.name,
  })
}
