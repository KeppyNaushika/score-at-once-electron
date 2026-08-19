/**
 * OMR設定（AsbOmrConfig / AsbOmrChoiceOption）の書き込み。
 *
 * 設定はセル（小問・枝問）と1対1で、選択肢は設定に完全従属する。**選択肢は id を
 * 持たない**（renderer の `OMRCellConfig` が `labels: string[]` で持つ）ので、
 * 並び順の位置（`choiceIndex`）で既存行を使い回す。設定ごと upsert するのが
 * 意図の最小単位になる（docs/asb-ipc-split-plan.md §4.4）。
 */

import type { Prisma } from "@prisma/client"

import type { AsbCellParent } from "../../../src/types/answerSheetDefinition.types"
import type { OMRCellConfig } from "../../../src/types/omr.types"
import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import { isUnchanged, writeRow } from "./rowDiff"

/** 設定と選択肢をまとめて書く。書いたら `true` */
export async function writeAsbOmrConfig(
  tx: Prisma.TransactionClient,
  parent: AsbCellParent,
  config: OMRCellConfig
): Promise<boolean> {
  // 設定は小問／枝問と1対1。既にあれば同じ行を使い続ける
  // （毎回作り直すと、保存のたびに別 id の行が同期へ流れる）
  const existing = await tx.asbOmrConfig.findFirst({
    where: parent,
    include: { choiceOptions: { orderBy: { choiceIndex: "asc" } } },
  })
  const omrConfigId = existing?.id ?? crypto.randomUUID()

  const omrConfigData = {
    type: "choice",
    numChoices: config.numChoices,
    choiceLayout: config.layout,
  }
  let changed = await writeRow(
    existing ?? undefined,
    omrConfigData,
    () =>
      tx.asbOmrConfig.create({
        data: { id: omrConfigId, ...parent, ...omrConfigData },
      }),
    () =>
      tx.asbOmrConfig.update({
        where: { id: omrConfigId },
        data: omrConfigData,
      })
  )

  // 選択肢は id を持たないので、並び順の位置で既存行を使い回す。
  // 増えた分だけ作り、減った分だけ消す
  const existingOptions = existing?.choiceOptions ?? []
  for (let ci = 0; ci < config.labels.length; ci++) {
    const label = config.labels[ci]
    const isCorrect = config.correctAnswers.includes(ci)
    const reused = existingOptions[ci]
    const choiceOptionData = { choiceIndex: ci, label, isCorrect }
    if (!reused) {
      await tx.asbOmrChoiceOption.create({
        data: { omrConfigId, ...choiceOptionData },
      })
      changed = true
    } else if (!isUnchanged(reused, choiceOptionData)) {
      await tx.asbOmrChoiceOption.update({
        where: { id: reused.id },
        data: choiceOptionData,
      })
      changed = true
    }
  }
  const removed = existingOptions.slice(config.labels.length)
  if (removed.length > 0) {
    await tx.asbOmrChoiceOption.deleteMany({
      where: { id: { in: removed.map((option) => option.id) } },
    })
    changed = true
  }

  return changed
}

/**
 * OMR設定を無くしたセルの設定行を消す。
 *
 * 設定自体は id を持ち回らないので、**残るかどうかは親で数える**。
 */
export async function deleteRemovedAsbOmrConfigs(
  tx: Prisma.TransactionClient,
  definitionId: string,
  surviving: { subQuestionIds: string[]; branchQuestionIds: string[] }
): Promise<boolean> {
  const { count } = await tx.asbOmrConfig.deleteMany({
    where: {
      OR: [
        {
          subQuestion: { majorQuestion: { definitionId } },
          subQuestionId: { notIn: surviving.subQuestionIds },
        },
        {
          branchQuestion: { subQuestion: { majorQuestion: { definitionId } } },
          branchQuestionId: { notIn: surviving.branchQuestionIds },
        },
      ],
    },
  })
  return count > 0
}

// =============================================================================
// 1件ずつの書き込み（IPC から）
// =============================================================================

/**
 * セルの OMR 設定を書く（無ければ作る）。
 *
 * 選択肢は設定に完全従属し、個々の選択肢に id が無い。**id の無いレコードは
 * プリミティブで指せない**ので、設定単位の upsert が意図の最小単位になる
 * （docs/asb-ipc-split-plan.md §4.4）。
 */
export async function upsertAsbOmrConfig(
  definitionId: string,
  parent: AsbCellParent,
  config: OMRCellConfig
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, (tx) =>
    writeAsbOmrConfig(tx, parent, config)
  )
}

/** セルの OMR 設定を外す。選択肢は Cascade で消える */
export async function deleteAsbOmrConfig(
  definitionId: string,
  parent: AsbCellParent
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const { count } = await tx.asbOmrConfig.deleteMany({ where: parent })
    return count > 0
  })
}
