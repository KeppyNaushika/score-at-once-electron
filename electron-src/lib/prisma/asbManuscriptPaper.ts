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
  AsbManuscriptPaperSettings,
  ManuscriptPaper,
} from "../../../src/types/answerSheetDefinition.types"
import type { CurrentAsbCharGuideRows } from "./asbCharGuide"
import { writeAsbCharGuides } from "./asbCharGuide"
import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import { updateRowIfChanged, writeRow } from "./rowDiff"

/** 原稿用紙とその子のうち、既に DB にある行 */
export interface CurrentAsbManuscriptPaperRows extends CurrentAsbCharGuideRows {
  manuscriptPapers: ReadonlyMap<string, AsbManuscriptPaper>
}

/** 見た目の設定の列（オンオフは含めない） */
function asbManuscriptPaperSettingColumns(
  settings: AsbManuscriptPaperSettings
) {
  return {
    columns: settings.columns,
    rows: settings.rows,
    guideFontSize: settings.guideFontSize,
    guidePosition: settings.guidePosition,
    guidePadding: settings.guidePadding,
  }
}

function asbManuscriptPaperColumns(
  manuscriptPaper: AsbManuscriptPaperAttributes
) {
  return {
    enabled: manuscriptPaper.enabled,
    ...asbManuscriptPaperSettingColumns(manuscriptPaper),
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
 * セルが原稿用紙を使うかどうかを切り替える。**行が無ければここで作る**。
 *
 * 原稿用紙の行を作る経路はこれひとつ。設定の書き込み（`updateAsbManuscriptPaper`）は
 * 行が在ることを前提にできる。**作るときの列数・行数は renderer が渡す**
 * （`initialSettings`）— 既定は用紙設定から決まる（縦書きなら 20×10 の200字詰、段幅に
 * 入らなければ詰める）ので、ここでは決められない。スキーマの `@default` は残っているが、
 * この経路では必ず値が入るので使われない。既に在る行には触らない（オンオフだけを書く）。
 *
 * 鍵は `@unique`（＝親の id）。**同じセルに2つ目の行を作らない**ためで、id そのものは
 * 不透明な uuidv4 のまま（借用 id は PR #1150 で全廃され、`uuidIdCoverage.test.ts` が
 * 禁じている）。既に行があればその id を使い続ける — 毎回作り直すと、保存のたびに
 * 別 id の行が同期へ流れ、文字位置マーカーの行き先も変わってしまう。
 *
 * **使い続けた id は呼び出し側へ返す。** renderer は自分の木に原稿用紙が無ければ新しい
 * id を振るので、木に無いのに DB に在るとき（別の端末が先に作ったとき）に、渡された
 * `manuscriptPaperId` は捨てられる。捨てたことを黙っていると、renderer の木は存在しない
 * 行を指したままになり、文字位置マーカーの追加が外部キーで落ち、全体保存が親の
 * `@unique` で落ちる。
 *
 * 文字位置マーカーはここでは触らない（自分の口を持つ子である）。
 *
 * @returns 実際に書いた行の id
 */
export async function setAsbManuscriptPaperEnabled(
  definitionId: string,
  parent: AsbCellParent,
  manuscriptPaperId: string,
  enabled: boolean,
  initialSettings: AsbManuscriptPaperSettings
): Promise<string> {
  let writtenManuscriptPaperId = manuscriptPaperId
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const existing = await tx.asbManuscriptPaper.findFirst({ where: parent })
    writtenManuscriptPaperId = existing?.id ?? manuscriptPaperId
    return writeRow(
      existing ?? undefined,
      { enabled },
      () =>
        tx.asbManuscriptPaper.create({
          data: {
            id: writtenManuscriptPaperId,
            ...parent,
            enabled,
            ...asbManuscriptPaperSettingColumns(initialSettings),
          },
        }),
      () =>
        tx.asbManuscriptPaper.update({
          where: { id: writtenManuscriptPaperId },
          data: { enabled },
        })
    )
  })
  return writtenManuscriptPaperId
}

/**
 * 原稿用紙の設定（列数・行数・ガイド）を書く。**オンオフは触らない**。
 *
 * 設定を触る欄はオンのときしか出ないので、行は在る。他の1件ずつの書き込みと同じく
 * id で引き、無ければ例外にする。
 */
export async function updateAsbManuscriptPaper(
  definitionId: string,
  manuscriptPaperId: string,
  settings: AsbManuscriptPaperSettings
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const existing = await tx.asbManuscriptPaper.findUnique({
      where: { id: manuscriptPaperId },
    })
    if (!existing) throw new Error("原稿用紙が見つかりません")
    const data = asbManuscriptPaperSettingColumns(settings)
    return updateRowIfChanged(existing, data, () =>
      tx.asbManuscriptPaper.update({ where: { id: manuscriptPaperId }, data })
    )
  })
}
