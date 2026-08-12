import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import prisma from "./client"
import { subtotalWithQuestionAssignmentsInclude } from "./cropSubtotal"
import { tagSubtotalGroupWithTagInclude } from "./tagSubtotalGroup"

/**
 * SubtotalGroup の include 形状（SSOT）。型（GetPayload）と実クエリの双方がこの const を
 * 参照するため両者が乖離しない。create/update/available は subtotals のみ、
 * getSubtotalGroups は examSubtotalGroups.exam（id・examName の部分 select）と
 * tagSubtotalGroups.tag も取る。
 */
const subtotalGroupWithSubtotalsInclude = {
  subtotals: {
    orderBy: { order: "asc" },
  },
} satisfies Prisma.SubtotalGroupInclude

const subtotalGroupWithSubtotalsExamsAndTagsInclude = {
  subtotals: {
    orderBy: { order: "asc" },
  },
  examSubtotalGroups: { include: { exam: true } },
  tagSubtotalGroups: {
    include: tagSubtotalGroupWithTagInclude,
    orderBy: { tag: { order: "asc" } },
  },
} satisfies Prisma.SubtotalGroupInclude

/**
 * 小計点の算出に使う SubtotalGroup の include。
 * 各小計は自分の設問割り当てを持つので、小計点も満点も追加クエリ無しで算出できる。
 */
const subtotalGroupForScoringInclude = {
  subtotals: {
    include: subtotalWithQuestionAssignmentsInclude,
    orderBy: { order: "asc" },
  },
} satisfies Prisma.SubtotalGroupInclude

/** 設問割り当てまで含む SubtotalGroup（getActiveSubtotalGroupsForExam の返り値） */
export type SubtotalGroupForScoring = Prisma.SubtotalGroupGetPayload<{
  include: typeof subtotalGroupForScoringInclude
}>

/** subtotals を含む SubtotalGroup（create/update/available の返り値） */
export type SubtotalGroupWithSubtotals = Prisma.SubtotalGroupGetPayload<{
  include: typeof subtotalGroupWithSubtotalsInclude
}>

/**
 * subtotals・examSubtotalGroups.exam（部分 select）・tagSubtotalGroups.tag を含む
 * SubtotalGroup（getSubtotalGroups の返り値）
 */
export type SubtotalGroupWithSubtotalsExamsAndTags =
  Prisma.SubtotalGroupGetPayload<{
    include: typeof subtotalGroupWithSubtotalsExamsAndTagsInclude
  }>

/**
 * 小計点グループを全て取得
 */
export async function getSubtotalGroups() {
  const subtotalGroups = await prisma.subtotalGroup.findMany({
    include: subtotalGroupWithSubtotalsExamsAndTagsInclude,
    orderBy: { createdAt: "desc" },
  })

  return subtotalGroups
}

/**
 * 小計点グループを作成
 */
export async function createSubtotalGroup(data: {
  name: string
  subtotals: {
    name: string
    order: number
  }[]
}) {
  const subtotalGroup = await prisma.subtotalGroup.create({
    data: {
      name: data.name,
      subtotals: {
        create: data.subtotals,
      },
    },
    include: subtotalGroupWithSubtotalsInclude,
  })

  await recordAuditLog({
    action: "subtotal_group.create",
    entityType: "SubtotalGroup",
    entityId: subtotalGroup.id,
    target: subtotalGroup.name,
  })

  return subtotalGroup
}

/**
 * 小計点グループを更新
 */
export async function updateSubtotalGroup(
  id: string,
  data: {
    name: string
    subtotals: {
      name: string
      order: number
    }[]
  }
) {
  // トランザクション内で更新
  const subtotalGroup = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // 既存の小計項目を削除
      await tx.subtotal.deleteMany({
        where: { subtotalGroupId: id },
      })

      // 小計点グループを更新
      return await tx.subtotalGroup.update({
        where: { id },
        data: {
          name: data.name,
          subtotals: {
            create: data.subtotals,
          },
        },
        include: subtotalGroupWithSubtotalsInclude,
      })
    }
  )

  await recordAuditLog({
    action: "subtotal_group.update",
    entityType: "SubtotalGroup",
    entityId: subtotalGroup.id,
    target: subtotalGroup.name,
  })

  return subtotalGroup
}

/**
 * 小計点グループを削除
 */
export async function deleteSubtotalGroup(id: string) {
  // 実際にCropSubtotalで使用されているかを詳細にチェック
  const usageDetails = await prisma.cropSubtotal.findMany({
    where: {
      subtotal: {
        subtotalGroupId: id,
      },
    },
    include: {
      cropRegion: { include: { examPage: { include: { exam: true } } } },
      subtotal: true,
    },
  })

  // 実際に使用されている場合は削除を防ぐ
  if (usageDetails.length > 0) {
    // 試験別に使用状況をまとめる
    const usageByExam = usageDetails.reduce(
      (acc, usage) => {
        const examName = usage.cropRegion.examPage.exam.examName
        const subtotalName = usage.subtotal.name
        const cropRegionLabel =
          usage.cropRegion.label ||
          `設問${(usage.cropRegion.orderIndex || 0) + 1}`

        if (!acc[examName]) {
          acc[examName] = []
        }
        acc[examName].push(`${cropRegionLabel} → ${subtotalName}`)
        return acc
      },
      {} as Record<string, string[]>
    )

    const usageMessages = Object.entries(usageByExam)
      .map(
        ([examName, assignments]) => `・${examName}: ${assignments.join(", ")}`
      )
      .join("\n")

    throw new Error(
      `この小計点グループは以下の設問で使用されており、削除できません:\n\n${usageMessages}\n\n設問との関連付けを先に解除してから削除してください。`
    )
  }

  const before = await prisma.subtotalGroup.findUnique({
    where: { id },
  })

  // 試験に追加されているが実際には使用されていない場合はExamSubtotalGroupも削除
  await prisma.$transaction(async (tx) => {
    // ExamSubtotalGroupを削除
    await tx.examSubtotalGroup.deleteMany({
      where: { subtotalGroupId: id },
    })

    // 小計点グループを削除（関連する小計項目も CASCADE で削除される）
    await tx.subtotalGroup.delete({
      where: { id },
    })
  })

  await recordAuditLog({
    action: "subtotal_group.delete",
    entityType: "SubtotalGroup",
    entityId: id,
    target: before?.name ?? null,
  })
}

/**
 * 試験で利用可能な小計点グループを取得（試験で有効化されていないもの）
 */
export async function getAvailableSubtotalGroupsForExam(examId: string) {
  const subtotalGroups = await prisma.subtotalGroup.findMany({
    where: {
      examSubtotalGroups: {
        none: {
          examId,
        },
      },
    },
    include: subtotalGroupWithSubtotalsInclude,
    orderBy: { name: "asc" },
  })

  return subtotalGroups
}

/**
 * 試験で有効化されている小計点グループを取得
 */
export async function getActiveSubtotalGroupsForExam(examId: string) {
  const examSubtotalGroups = await prisma.examSubtotalGroup.findMany({
    where: {
      examId,
    },
    include: { subtotalGroup: { include: subtotalGroupForScoringInclude } },
    orderBy: {
      subtotalGroup: {
        name: "asc",
      },
    },
  })

  return examSubtotalGroups
}

/**
 * 試験に小計点グループを追加する。
 *
 * **鍵は id ではなく `@@unique`。** id は uuidv4 なので端末ごとに異なり、同じ組み合わせの
 * 行を引くのに使えない。2端末が同時に同じ組み合わせを追加すると id 違いの行が2つできるが、
 * sqlite-nas-sync が LWW で1行へ収束させる
 * （以前は素の create で、重複防止は @@unique も無いまま呼び出し側任せだった）。
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

  await recordAuditLog({
    action: "subtotal_group.selection_update",
    entityType: "ExamSubtotalGroup",
    entityId: examId,
  })
}
