/**
 * 解答を書くセル（小問・枝問）の中身をまとめて扱う。
 *
 * セルはテキスト要素・画像要素・OMR設定・原稿用紙を持ち、**小問と枝問がまったく同じ形で
 * 持つ**。DB では親が別の外部キーになるので、親の指し方を1つの形（{@link AsbCellParent}）に
 * まとめる。列を知っているのは実体ごとのモジュール（`asbTextElement.ts` /
 * `asbImageElement.ts` / `asbOmrConfig.ts` / `asbManuscriptPaper.ts`）で、ここはそれらを
 * 順に通すだけ。
 */

import type { AsbImageElement, AsbTextElement, Prisma } from "@prisma/client"

import type {
  AsbCellParent,
  BranchQuestion,
  SubQuestion,
} from "../../../src/types/answerSheetDefinition.types"
import { writeAsbImageElement } from "./asbImageElement"
import type { CurrentAsbManuscriptPaperRows } from "./asbManuscriptPaper"
import { writeAsbManuscriptPaperTree } from "./asbManuscriptPaper"
import { writeAsbOmrConfig } from "./asbOmrConfig"
import { writeAsbTextElement } from "./asbTextElement"

/** セルの中身のうち、既に DB にある行（変わっていない行を書かないための突き合わせ先） */
export interface CurrentAsbCellRows extends CurrentAsbManuscriptPaperRows {
  textElements: ReadonlyMap<string, AsbTextElement>
  imageElements: ReadonlyMap<string, AsbImageElement>
}

/**
 * 行が属しているセルを、行の外部キーから読み取る。
 *
 * 小問と枝問のどちらか一方だけが埋まっている。並びを詰めるときに「同じセルの兄弟」を
 * 名指しするのに要る。
 */
export function cellOf(row: {
  subQuestionId: string | null
  branchQuestionId: string | null
}): AsbCellParent {
  if (row.subQuestionId !== null) return { subQuestionId: row.subQuestionId }
  if (row.branchQuestionId !== null) {
    return { branchQuestionId: row.branchQuestionId }
  }
  throw new Error("どのセルにも属していない行です")
}

/** 「この解答用紙のどれかのセルに属する」— 小問の子か、枝問の子か */
export function inDefinitionCells(definitionId: string) {
  return [
    { subQuestion: { majorQuestion: { definitionId } } },
    { branchQuestion: { subQuestion: { majorQuestion: { definitionId } } } },
  ]
}

/**
 * 1つのセルが持つ中身を、木の並びのとおりに書く。
 *
 * `current` を渡さないのは新しく足した枝を入れるときで、その場合はすべて作成になる。
 *
 * @returns 1行でも書いたら `true`
 */
export async function writeAsbCellContents(
  tx: Prisma.TransactionClient,
  parent: AsbCellParent,
  cell: SubQuestion | BranchQuestion,
  current?: CurrentAsbCellRows
): Promise<boolean> {
  let changed = false
  const mark = (wrote: boolean) => {
    if (wrote) changed = true
  }

  for (const [order, textElement] of cell.textElements.entries()) {
    mark(
      await writeAsbTextElement(
        tx,
        parent,
        textElement,
        order,
        current?.textElements.get(textElement.id)
      )
    )
  }
  for (const [order, imageElement] of (cell.imageElements ?? []).entries()) {
    mark(
      await writeAsbImageElement(
        tx,
        parent,
        imageElement,
        order,
        current?.imageElements.get(imageElement.id)
      )
    )
  }
  if (cell.omrConfig) {
    mark(await writeAsbOmrConfig(tx, parent, cell.omrConfig))
  }
  if (cell.manuscriptPaper) {
    mark(
      await writeAsbManuscriptPaperTree(
        tx,
        parent,
        cell.manuscriptPaper,
        current
      )
    )
  }
  return changed
}
