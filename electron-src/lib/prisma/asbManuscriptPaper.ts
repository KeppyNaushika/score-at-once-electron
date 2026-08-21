/**
 * 原稿用紙（AsbManuscriptPaper）の書き込み。
 *
 * **この実体が持つ列を知っているのはここだけ。** 原稿用紙はセル（小問・枝問）と1対1で、
 * 文字位置マーカー（`AsbCharGuide`）を子に持つ。`AsbOmrConfig` と同じ形。
 *
 * 設定は元々 `AsbSubQuestion` の列だった。画面では入れ子に束ね直していたため、原稿用紙と
 * 無関係な更新が設定を消す事故が出た（docs/asb-ipc-split-plan.md §8.5）。
 *
 * `tx` を先に取るものは木を書く側、`definitionId` を先に取るものが IPC の口。
 */

import type { AsbManuscriptPaper, Prisma } from "@prisma/client"

import type {
  AsbCellParent,
  AsbManuscriptPaperAttributes,
  ManuscriptPaper,
} from "../../../src/types/answerSheetDefinition.types"
import type { CurrentAsbCharGuideRows } from "./asbCharGuide"
import { writeAsbCharGuides } from "./asbCharGuide"
import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import { writeRow } from "./rowDiff"

/** 原稿用紙とその子のうち、既に DB にある行 */
export interface CurrentAsbManuscriptPaperRows extends CurrentAsbCharGuideRows {
  manuscriptPapers: ReadonlyMap<string, AsbManuscriptPaper>
}

function asbManuscriptPaperColumns(
  manuscriptPaper: AsbManuscriptPaperAttributes
) {
  return {
    enabled: manuscriptPaper.enabled,
    columns: manuscriptPaper.columns,
    rows: manuscriptPaper.rows,
    guideFontSize: manuscriptPaper.guideFontSize,
    guidePosition: manuscriptPaper.guidePosition,
    guidePadding: manuscriptPaper.guidePadding,
  }
}

/**
 * セルの原稿用紙と、その文字位置マーカーをまとめて書く。
 *
 * `current` を渡さないのは新しいセルを入れるときで、その場合はすべて作成になる。
 *
 * @returns 1行でも書いたら `true`
 */
export async function writeAsbManuscriptPaperTree(
  tx: Prisma.TransactionClient,
  parent: AsbCellParent,
  manuscriptPaper: ManuscriptPaper,
  current?: CurrentAsbManuscriptPaperRows
): Promise<boolean> {
  const data = asbManuscriptPaperColumns(manuscriptPaper)
  let changed = await writeRow(
    current?.manuscriptPapers.get(manuscriptPaper.id),
    data,
    () =>
      tx.asbManuscriptPaper.create({
        data: { id: manuscriptPaper.id, ...parent, ...data },
      }),
    () =>
      tx.asbManuscriptPaper.update({
        where: { id: manuscriptPaper.id },
        data,
      })
  )
  const wroteCharGuides = await writeAsbCharGuides(
    tx,
    manuscriptPaper.id,
    manuscriptPaper.charGuides,
    current?.charGuides
  )
  if (wroteCharGuides) changed = true
  return changed
}

/**
 * 原稿用紙を無くしたセルの行を消す。
 *
 * 原稿用紙は id を持つが、**残るかどうかは親で数える** — 木の中で原稿用紙が消えたときに
 * 残っている id が分からないため（OMR 設定と同じ扱い）。
 */
export async function deleteRemovedAsbManuscriptPapers(
  tx: Prisma.TransactionClient,
  definitionId: string,
  surviving: { subQuestionIds: string[]; branchQuestionIds: string[] }
): Promise<boolean> {
  const { count } = await tx.asbManuscriptPaper.deleteMany({
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
 * セルの原稿用紙を書く（無ければ作る）。
 *
 * 鍵は `@unique`（＝親の id）。**同じセルに2つ目の行を作らない**ためで、id そのものは
 * 不透明な uuidv4 のまま（借用 id は PR #1150 で全廃され、`uuidIdCoverage.test.ts` が
 * 禁じている）。既に行があればその id を使い続ける — 毎回作り直すと、保存のたびに
 * 別 id の行が同期へ流れ、文字位置マーカーの行き先も変わってしまう。
 *
 * 文字位置マーカーはここでは触らない（自分の口を持つ子である）。
 */
export async function upsertAsbManuscriptPaper(
  definitionId: string,
  parent: AsbCellParent,
  manuscriptPaperId: string,
  attributes: AsbManuscriptPaperAttributes
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const existing = await tx.asbManuscriptPaper.findFirst({ where: parent })
    const data = asbManuscriptPaperColumns(attributes)
    return writeRow(
      existing ?? undefined,
      data,
      () =>
        tx.asbManuscriptPaper.create({
          data: { id: manuscriptPaperId, ...parent, ...data },
        }),
      () => tx.asbManuscriptPaper.update({ where: { id: existing?.id }, data })
    )
  })
}

/** セルの原稿用紙を外す。文字位置マーカーは Cascade で消える */
export async function deleteAsbManuscriptPaper(
  definitionId: string,
  parent: AsbCellParent
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const { count } = await tx.asbManuscriptPaper.deleteMany({ where: parent })
    return count > 0
  })
}
