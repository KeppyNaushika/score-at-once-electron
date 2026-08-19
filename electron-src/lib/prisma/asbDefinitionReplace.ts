/**
 * 解答用紙を「この姿にしろ」と丸ごと置き換える経路。
 *
 * 木をまるごと受け取るのは、undo / redo・複製・アーカイブ取り込みのように**本当に
 * 全体を指定する操作**のためにある（docs/asb-ipc-split-plan.md §4.5）。日常の編集は
 * 実体ごとの書き込みへ割る（段階17）。
 *
 * **置き換えても、残るものは残す。** 以前は全消しして作り直していたため、保存のたびに
 * 作成日時が「今」へ戻り、全行の削除と挿入が同期の変更履歴へ流れていた。全消しをやめた
 * 後も全行を上書きしていたため、触っていない行まで `updatedAt` が動いていた（同時編集で
 * 相手の木を丸ごと倒す。`rowDiff.ts` を参照）。
 *
 * 列を知っているのは実体ごとのモジュール（`asbHeaderField.ts` など）で、ここは
 * **どの行が残るかを決めて、それらを順に通すだけ**。
 */

import type { AnswerSheetDefinition } from "../../../src/types/answerSheetDefinition.types"
import {
  deleteRemovedAsbImageElements,
  deleteRemovedAsbTextElements,
  upsertAsbImageElement,
  upsertAsbTextElement,
} from "./asbCellElement"
import { deleteRemovedAsbCharGuides, upsertAsbCharGuide } from "./asbCharGuide"
import { asbDefinitionRow } from "./asbDefinition"
import {
  deleteRemovedAsbHeaderFields,
  upsertAsbHeaderField,
} from "./asbHeaderField"
import { deleteRemovedAsbOmrConfigs, upsertAsbOmrConfig } from "./asbOmrConfig"
import {
  deleteRemovedAsbBranchQuestions,
  deleteRemovedAsbMajorQuestions,
  deleteRemovedAsbSubQuestions,
  upsertAsbBranchQuestion,
  upsertAsbMajorQuestion,
  upsertAsbSubQuestion,
} from "./asbQuestion"
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
 * 置き換えられるのは担当者（`userId`）だけ。担当は置き換えでは変わらない。
 */
export async function replaceAsbDefinition(
  definition: AnswerSheetDefinition,
  userId: string
): Promise<void> {
  const existingDefinition = await prisma.asbDefinition.findUnique({
    where: { id: definition.id },
  })
  if (existingDefinition && existingDefinition.userId !== userId) {
    throw new Error(
      "この解答用紙の担当ではないため保存できません。担当を譲ってもらってください。"
    )
  }
  const existed = existingDefinition !== null
  const definitionId = definition.id
  const surviving = collectSurvivingIds(definition)

  await prisma.$transaction(async (tx) => {
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
    const currentMajorQuestions = byId(
      await tx.asbMajorQuestion.findMany({ where: { definitionId } })
    )
    const currentSubQuestions = byId(
      await tx.asbSubQuestion.findMany({ where: inDefinition })
    )
    const currentBranchQuestions = byId(
      await tx.asbBranchQuestion.findMany({ where: inSubQuestions })
    )
    const currentCharGuides = byId(
      await tx.asbCharGuide.findMany({ where: inSubQuestions })
    )
    const currentTextElements = byId(
      await tx.asbTextElement.findMany({ where: { OR: inCells } })
    )
    const currentImageElements = byId(
      await tx.asbImageElement.findMany({ where: { OR: inCells } })
    )

    // 3. 解答用紙そのもの。担当と作成日時は置き換えでは動かさない
    const definitionData = asbDefinitionRow(definition)
    mark(
      await writeRow(
        existingDefinition ?? undefined,
        definitionData,
        () =>
          tx.asbDefinition.create({
            data: { id: definitionId, userId, ...definitionData },
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
        await upsertAsbHeaderField(
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
        await upsertAsbMajorQuestion(
          tx,
          definitionId,
          majorQuestion,
          majorQuestionOrder,
          currentMajorQuestions.get(majorQuestion.id)
        )
      )

      for (const [
        subQuestionOrder,
        subQuestion,
      ] of majorQuestion.subQuestions.entries()) {
        mark(
          await upsertAsbSubQuestion(
            tx,
            majorQuestion.id,
            subQuestion,
            subQuestionOrder,
            currentSubQuestions.get(subQuestion.id)
          )
        )

        const charGuides = subQuestion.manuscriptPaper?.charGuides ?? []
        for (const [charGuideOrder, charGuide] of charGuides.entries()) {
          mark(
            await upsertAsbCharGuide(
              tx,
              subQuestion.id,
              charGuide,
              charGuideOrder,
              currentCharGuides.get(charGuide.id)
            )
          )
        }

        const subQuestionCell = { subQuestionId: subQuestion.id }
        for (const [
          textElementOrder,
          textElement,
        ] of subQuestion.textElements.entries()) {
          mark(
            await upsertAsbTextElement(
              tx,
              subQuestionCell,
              textElement,
              textElementOrder,
              currentTextElements.get(textElement.id)
            )
          )
        }
        for (const [imageElementOrder, imageElement] of (
          subQuestion.imageElements ?? []
        ).entries()) {
          mark(
            await upsertAsbImageElement(
              tx,
              subQuestionCell,
              imageElement,
              imageElementOrder,
              currentImageElements.get(imageElement.id)
            )
          )
        }
        if (subQuestion.omrConfig) {
          mark(
            await upsertAsbOmrConfig(tx, subQuestionCell, subQuestion.omrConfig)
          )
        }

        for (const [
          branchQuestionOrder,
          branchQuestion,
        ] of subQuestion.branchQuestions.entries()) {
          mark(
            await upsertAsbBranchQuestion(
              tx,
              subQuestion.id,
              branchQuestion,
              branchQuestionOrder,
              currentBranchQuestions.get(branchQuestion.id)
            )
          )

          const branchQuestionCell = { branchQuestionId: branchQuestion.id }
          for (const [
            textElementOrder,
            textElement,
          ] of branchQuestion.textElements.entries()) {
            mark(
              await upsertAsbTextElement(
                tx,
                branchQuestionCell,
                textElement,
                textElementOrder,
                currentTextElements.get(textElement.id)
              )
            )
          }
          for (const [imageElementOrder, imageElement] of (
            branchQuestion.imageElements ?? []
          ).entries()) {
            mark(
              await upsertAsbImageElement(
                tx,
                branchQuestionCell,
                imageElement,
                imageElementOrder,
                currentImageElements.get(imageElement.id)
              )
            )
          }
          if (branchQuestion.omrConfig) {
            mark(
              await upsertAsbOmrConfig(
                tx,
                branchQuestionCell,
                branchQuestion.omrConfig
              )
            )
          }
        }
      }
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
    userId,
    entityType: "AsbDefinition",
    entityId: definitionId,
    scopeId: definitionId,
    scopeLabel: definition.name,
    target: definition.name,
  })
}
