/**
 * 試験と小計点グループの関連（ExamSubtotalGroup）への書き込みと、出力選択フラグ。
 *
 * 試験で有効化されているグループの一覧（`getActiveSubtotalGroupsForExam`）は
 * `subtotalGroup.ts` にある。
 */

import { recordAuditLog } from "./auditLog"
import { resolveExamScope } from "./auditScope"
import prisma from "./client"

/**
 * 試験に小計点グループを追加する。
 *
 * **鍵は id ではなく `@@unique`。** id は uuidv4 なので端末ごとに異なり、同じ組み合わせの
 * 行を引くのに使えない。2端末が同時に同じ組み合わせを追加すると id 違いの行が2つできるが、
 * sqlite-nas-sync が LWW で1行へ収束させる
 * （以前は素の create で、重複防止は @@unique も無いまま呼び出し側任せだった）。
 *
 * **この収束は「敗者行に子がいない場合に限る」**（実測: docs/sync-secondary-unique-hazard.md）。
 * `ExamSubtotalGroup` は子を持たないので条件を満たすが、**敗者行の属性は勝った行に取り込まれず
 * 失われる**（`selectedForTable` / `selectedForBoxPlot`。同文書 §6.1 の既知の穴）。
 * 子を持つ表で同じことをすると、その子が消えるうえ**勝った側の端末**が外部キー違反で詰まり、
 * その相手からの以後すべての変更が届かなくなる。この形を他表へ写すときは条件を確かめること。
 */
export async function addSubtotalGroupToExam(
  examId: string,
  subtotalGroupId: string
) {
  const examSubtotalGroup = await prisma.examSubtotalGroup.upsert({
    where: { examId_subtotalGroupId: { examId, subtotalGroupId } },
    create: {
      examId,
      subtotalGroupId,
    },
    update: {},
    include: {
      subtotalGroup: {
        include: {
          subtotals: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  })

  return examSubtotalGroup
}

/**
 * 試験から小計点グループを削除
 */
export async function removeSubtotalGroupFromExam(
  examId: string,
  subtotalGroupId: string
) {
  // この試験でCropSubtotalによって実際に使用されているかチェック
  const usageDetails = await prisma.cropSubtotal.findMany({
    where: {
      subtotal: {
        subtotalGroupId,
      },
      cropRegion: {
        examPage: {
          examId,
        },
      },
    },
    include: { cropRegion: true, subtotal: true },
  })

  // 実際に使用されている場合は削除を防ぐ
  if (usageDetails.length > 0) {
    const assignments = usageDetails.map((usage) => {
      const cropRegionLabel =
        usage.cropRegion.label ||
        `設問${(usage.cropRegion.orderIndex || 0) + 1}`
      return `${cropRegionLabel} → ${usage.subtotal.name}`
    })

    throw new Error(
      `この小計点グループは以下の設問で使用されており、試験から削除できません:\n\n${assignments.join(", ")}\n\n設問との関連付けを先に解除してから削除してください。`
    )
  }

  // 使用されていない場合は削除を実行
  await prisma.examSubtotalGroup.deleteMany({
    where: {
      examId,
      subtotalGroupId,
    },
  })
}

/**
 * 小計グループの出力選択フラグを取得する（個人成績表のテーブル/箱ひげ図）。
 * source of truth は ExamSubtotalGroup.selectedForTable/selectedForBoxPlot（settingsJson ではない）。
 */
export async function getSubtotalGroupSelection(examId: string) {
  const links = await prisma.examSubtotalGroup.findMany({
    where: { examId },
  })
  return {
    tableGroupIds: links
      .filter((link) => link.selectedForTable)
      .map((link) => link.subtotalGroupId),
    boxPlotGroupIds: links
      .filter((link) => link.selectedForBoxPlot)
      .map((link) => link.subtotalGroupId),
  }
}

/**
 * 小計グループの出力選択フラグを設定する（個人成績表のテーブル/箱ひげ図）。
 * 指定 ID をフラグ true、それ以外を false にする（亡霊ID排除のため relational に保持）。
 *
 * @param tableGroupIds - 小計点テーブルに含める subtotalGroupId 群
 * @param boxPlotGroupIds - 箱ひげ図に含める subtotalGroupId 群
 */
export async function setSubtotalGroupSelection(
  examId: string,
  tableGroupIds: string[],
  boxPlotGroupIds: string[]
) {
  await prisma.$transaction(async (tx) => {
    // 一旦全フラグを false にし、指定IDのみ true へ。行ごとの update（N+1）を
    // 定数本数の updateMany に集約する。
    await tx.examSubtotalGroup.updateMany({
      where: { examId },
      data: { selectedForTable: false, selectedForBoxPlot: false },
    })
    if (tableGroupIds.length > 0) {
      await tx.examSubtotalGroup.updateMany({
        where: { examId, subtotalGroupId: { in: tableGroupIds } },
        data: { selectedForTable: true },
      })
    }
    if (boxPlotGroupIds.length > 0) {
      await tx.examSubtotalGroup.updateMany({
        where: { examId, subtotalGroupId: { in: boxPlotGroupIds } },
        data: { selectedForBoxPlot: true },
      })
    }
  })

  const scope = await resolveExamScope(examId)
  await recordAuditLog({
    action: "subtotal_group.selection_update",
    entityType: "ExamSubtotalGroup",
    entityId: examId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    coalesceKey: `subtotal_group_selection:${examId}`,
  })
}
