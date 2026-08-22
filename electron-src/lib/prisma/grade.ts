/**
 * Grade（成績算出試験）のPrisma操作関数
 */

import type { Prisma } from "@prisma/client"

import { diffFields, recordAuditLog } from "./auditLog"
import prisma from "./client"
import {
  gradeConstraintInclude,
  writeConstraintConfig,
} from "./gradeConstraint"
import {
  buildEstimationSourceRows,
  gradeItemWithDataSourcesInclude,
  hydrateGrade,
} from "./gradeDataSource"
import { serializePrisma } from "./serializePrisma"

/**
 * Grade を GradeWithRelations として返すときの include（SSOT）。
 *
 * 取得も作成も更新も同じ形を返す。以前は取得系だけが gradeStudents を同梱しており、
 * IPC の型は4経路とも GradeWithRelations を名乗っていたため、作成結果を一覧・詳細へ
 * そのまま渡すと `gradeStudents.length` が実行時に落ちた。
 */
const gradeWithRelationsInclude = {
  gradeClassrooms: {
    include: { classroom: true },
    orderBy: { order: "asc" },
  },
  gradeItems: {
    include: gradeItemWithDataSourcesInclude,
    orderBy: { order: "asc" },
  },
  // 対象者は行のまま渡し切る。件数は renderer が `.length` で取る
  // （件数も計算値なので main では作らない）
  gradeStudents: true,
  gradeTags: { include: { tag: true } },
} satisfies Prisma.GradeInclude

/**
 * 一覧が読む分だけの include（SSOT）。
 *
 * 一覧が使うのは「名前・学級・対象者数・評価項目数」と、次のステップ判定
 * （`gradeStatus`）が読む「境界の有無・データソースの種別・資料の点数の有無」だけ。
 * 満点の元データ（exam.examPages / subtotal.cropSubtotals / coursework.items）も
 * 表示名用の参照先も、03/04/05 画面が使う `grade.getById` の側にだけあればよい。
 *
 * 列は削らない（規約: Prisma include の出力を射影せずそのまま持つ）。減らすのは
 * 「引くリレーション」であって列ではない。
 */
export const gradeSummaryInclude = {
  gradeClassrooms: {
    include: { classroom: true },
    orderBy: { order: "asc" },
  },
  gradeStudents: true,
  // 一覧はタグを表示し、タグでの絞り込みにも使う
  gradeTags: { include: { tag: true } },
  gradeItems: {
    include: {
      boundaries: { orderBy: { order: "asc" } },
      dataSources: {
        // 資料の点数は「入力に着手済みか」の判定に要る。判定するのは renderer。
        include: { courseworkItem: { include: { scores: true } } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  },
} satisfies Prisma.GradeInclude

/**
 * 全成績算出試験を取得
 */
export async function getAllGrades() {
  const grades = await prisma.grade.findMany({
    include: gradeSummaryInclude,
    orderBy: { createdAt: "desc" },
  })
  // 一覧は満点を表示しないので hydrate（maxScore の付与）は通さない。
  // 元データを引いていないため、通しても 0 を並べるだけになる。
  return serializePrisma(grades)
}

/**
 * IDで成績算出試験を取得
 */
export async function getGradeById(id: string) {
  const grade = await prisma.grade.findUnique({
    where: { id },
    include: gradeWithRelationsInclude,
  })
  if (!grade) {
    throw new Error("Grade exam not found")
  }
  return hydrateGrade(serializePrisma(grade))
}

/**
 * 成績算出試験を作成
 */
export async function createGrade(data: {
  name: string
  description?: string
  referenceDate?: string | null
}) {
  const grade = await prisma.grade.create({
    data: {
      name: data.name,
      description: data.description,
      referenceDate: data.referenceDate ? new Date(data.referenceDate) : null,
    },
    include: gradeWithRelationsInclude,
  })

  await recordAuditLog({
    action: "grade.create",
    entityType: "Grade",
    entityId: grade.id,
    scopeId: grade.id,
    scopeLabel: grade.name,
    target: grade.name,
  })

  return hydrateGrade(serializePrisma(grade))
}

/**
 * 成績算出試験を更新
 */
export async function updateGrade(
  id: string,
  data: {
    name?: string
    description?: string | null
    referenceDate?: string | null
  }
) {
  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.referenceDate !== undefined) {
    updateData.referenceDate = data.referenceDate
      ? new Date(data.referenceDate)
      : null
  }
  const before = await prisma.grade.findUnique({
    where: { id },
  })
  const grade = await prisma.grade.update({
    where: { id },
    data: updateData,
    include: gradeWithRelationsInclude,
  })

  await recordAuditLog({
    action: "grade.update",
    entityType: "Grade",
    entityId: grade.id,
    scopeId: grade.id,
    scopeLabel: grade.name,
    target: grade.name,
    changes: diffFields(before ?? undefined, grade, [
      { field: "name", label: "成績名" },
      { field: "description", label: "説明" },
    ]),
  })

  return hydrateGrade(serializePrisma(grade))
}

/**
 * 成績算出試験を削除
 */
export async function deleteGrade(id: string) {
  const before = await prisma.grade.findUnique({
    where: { id },
  })
  await prisma.grade.delete({ where: { id } })

  await recordAuditLog({
    action: "grade.delete",
    entityType: "Grade",
    entityId: id,
    scopeId: id,
    scopeLabel: before?.name ?? null,
    target: before?.name ?? null,
  })
}

/**
 * 既存の成績名から重複しない「（コピー）」名を採番する。
 * `${base} (コピー)`、以降 `${base} (コピー 2)`, `(コピー 3)` … と空きを探す。
 */
function buildCopyName(base: string, existingNames: Set<string>): string {
  const first = `${base} (コピー)`
  if (!existingNames.has(first)) return first
  let n = 2
  while (existingNames.has(`${base} (コピー ${n})`)) n++
  return `${base} (コピー ${n})`
}

/**
 * 成績算出試験をツリーごと複製する。
 *
 * Grade を頂点に、GradeItem / GradeDataSource / GradeItemBoundary /
 * GradeOverride / GradeItemExclusion / GradeClassroom / GradeStudent /
 * GradeConstraint / GradeExportSettings をすべて新IDで再作成する。
 *
 * 外部参照（examId・studentId・classroomId・cropRegionId・courseworkId 等）は
 * 同一DB内でそのまま流用する（アーカイブ取込と違い名前照合は不要）。
 * Grade 内部を参照するフィールドは新IDへ再リンクする:
 *   - GradeItem を指す子（DataSource / Boundary / Override / Exclusion）→ 旧→新 gradeItemId
 *   - GradeDataSource.estimationSourceIds（同一Grade内の他DataSource ID群）→ 旧→新 dataSourceId
 *
 * ⚠️ Grade に子テーブル／内部参照フィールドを追加した場合は、ここと
 *    import/grade-archive の dataCreator（アーカイブ取込側）の両方を更新すること。
 *
 * 複製元の読み取りと全 create は単一トランザクション内で行い、共有DB上の並行編集に
 * 対する一貫性を確保する。行数が多い独立テーブルは createMany でまとめて挿入する。
 */
export async function duplicateGrade(id: string) {
  const result = await prisma.$transaction(
    async (tx) => {
      const source = await tx.grade.findUnique({
        where: { id },
        include: {
          gradeClassrooms: { orderBy: { order: "asc" } },
          // 対象者は上書き・除外設定を子として持つ。複製先の対象者へ張り替えるため
          // 一緒に引く（確定値は複製しない。後述）
          gradeStudents: {
            include: { overrides: true, itemExclusions: true },
          },
          gradeItems: {
            include: {
              dataSources: {
                include: { estimationSources: { orderBy: { order: "asc" } } },
                orderBy: { order: "asc" },
              },
              boundaries: { orderBy: { order: "asc" } },
            },
            orderBy: { order: "asc" },
          },
          gradeConstraints: {
            include: gradeConstraintInclude,
            orderBy: { order: "asc" },
          },
          reportSettings: true,
        },
      })
      if (!source) return null

      // 重複しないコピー名（Grade.name にDB制約は無く、UX目的の best-effort）
      const allGrades = await tx.grade.findMany()
      const copyName = buildCopyName(
        source.name,
        new Set(allGrades.map((grade) => grade.name))
      )

      // 旧gradeItemId → 新gradeItemId。解決できなければ複製元が壊れているため
      // throw してロールバックする（矛盾した行を作らない）。
      const itemIdMap = new Map<string, string>()
      const remapItemId = (oldId: string): string => {
        const newId = itemIdMap.get(oldId)
        if (!newId) {
          throw new Error(`GradeItem ${oldId} の複製先が見つかりません`)
        }
        return newId
      }

      // 1. Grade 本体
      const grade = await tx.grade.create({
        data: {
          name: copyName,
          description: source.description,
          referenceDate: source.referenceDate,
        },
      })

      // 2. 個人成績通知書の設定（1:1）。id と日時は新しい行のもの
      if (source.reportSettings) {
        const {
          id: _id,
          gradeId: _gradeId,
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          ...reportSettings
        } = source.reportSettings
        await tx.gradeIndividualReportSettings.create({
          data: { gradeId: grade.id, ...reportSettings },
        })
      }

      // 3. 対象学級（独立行）
      if (source.gradeClassrooms.length > 0) {
        await tx.gradeClassroom.createMany({
          data: source.gradeClassrooms.map((gradeClassroom) => ({
            gradeId: grade.id,
            classroomId: gradeClassroom.classroomId,
            order: gradeClassroom.order,
          })),
        })
      }

      // 4. 対象生徒。上書き・除外設定は対象者の子なので、新しい対象者の id を
      //    後続で使えるよう1件ずつ作って旧→新の対応を持つ。
      const gradeStudentIdMap = new Map<string, string>()
      for (const gradeStudent of source.gradeStudents) {
        const newGradeStudent = await tx.gradeStudent.create({
          data: {
            gradeId: grade.id,
            studentId: gradeStudent.studentId,
            customOrder: gradeStudent.customOrder,
          },
        })
        gradeStudentIdMap.set(gradeStudent.id, newGradeStudent.id)
      }

      // 5. 評価項目 + データソース。
      //    新IDを後続の再リンクに使うため個別 create し、旧→新の
      //    gradeItemId / dataSourceId マップを両方構築する。
      //    estimationSourceIds は同一Grade内の他DataSource IDを指し前方参照が
      //    あり得るため、この時点では元値のままコピーし、全DataSource作成後（5.5）
      //    に新IDへ remap する。
      const dataSourceIdMap = new Map<string, string>()
      const dataSourcesToRelink: {
        newId: string
        oldEstimationSourceIds: string[]
      }[] = []
      for (const gradeItem of source.gradeItems) {
        const newItem = await tx.gradeItem.create({
          data: {
            gradeId: grade.id,
            name: gradeItem.name,
            order: gradeItem.order,
          },
        })
        itemIdMap.set(gradeItem.id, newItem.id)

        for (const dataSource of gradeItem.dataSources) {
          const newDataSource = await tx.gradeDataSource.create({
            data: {
              gradeItemId: newItem.id,
              type: dataSource.type,
              examId: dataSource.examId,
              subtotalId: dataSource.subtotalId,
              cropRegionId: dataSource.cropRegionId,
              courseworkItemId: dataSource.courseworkItemId,
              courseworkId: dataSource.courseworkId,
              name: dataSource.name,
              weight: dataSource.weight,
              order: dataSource.order,
              absentMethod: dataSource.absentMethod,
              absentRatio: dataSource.absentRatio,
              absentOffset: dataSource.absentOffset,
              treatExpectedAsMissing: dataSource.treatExpectedAsMissing,
              estimationMode: dataSource.estimationMode,
            },
          })
          dataSourceIdMap.set(dataSource.id, newDataSource.id)
          const oldEstimationSourceIds = dataSource.estimationSources.map(
            (estimationSource) => estimationSource.sourceDataSourceId
          )
          if (oldEstimationSourceIds.length > 0) {
            dataSourcesToRelink.push({
              newId: newDataSource.id,
              oldEstimationSourceIds,
            })
          }
        }
      }

      // 5.5. 推定に使う他データソースを新DataSource IDへ remap
      //   （元Grade内に見つからないID＝不整合は落とす）。
      for (const relink of dataSourcesToRelink) {
        const remapped = relink.oldEstimationSourceIds
          .map((oldSourceId) => dataSourceIdMap.get(oldSourceId))
          .filter((newSourceId): newSourceId is string => !!newSourceId)
        await tx.gradeDataSource.update({
          where: { id: relink.newId },
          data: {
            estimationSources: {
              create: buildEstimationSourceRows(relink.newId, remapped),
            },
          },
        })
      }

      // 6. 成績境界（gradeItemId を再リンク）
      const boundaryRows = source.gradeItems.flatMap((sourceGradeItem) =>
        sourceGradeItem.boundaries.map((boundary) => ({
          gradeItemId: remapItemId(sourceGradeItem.id),
          label: boundary.label,
          minPercentage: boundary.minPercentage,
          order: boundary.order,
        }))
      )
      if (boundaryRows.length > 0) {
        await tx.gradeItemBoundary.createMany({ data: boundaryRows })
      }

      // 7-8. 評定の手動上書きと評価項目ごとの除外。どちらも対象者×評価項目のセルなので、
      //   複製先の対象者 id と評価項目 id の両方へ再リンクする。解決できなければ
      //   複製元が壊れているため throw してロールバックする（矛盾した行を作らない）。
      const remapGradeStudentId = (oldId: string): string => {
        const newId = gradeStudentIdMap.get(oldId)
        if (!newId) {
          throw new Error(`GradeStudent ${oldId} の複製先が見つかりません`)
        }
        return newId
      }
      const overrideRows = source.gradeStudents.flatMap((gradeStudent) =>
        gradeStudent.overrides.map((override) => ({
          gradeStudentId: remapGradeStudentId(gradeStudent.id),
          gradeItemId: remapItemId(override.gradeItemId),
          overrideLabel: override.overrideLabel,
        }))
      )
      if (overrideRows.length > 0) {
        await tx.gradeOverride.createMany({ data: overrideRows })
      }

      const exclusionRows = source.gradeStudents.flatMap((gradeStudent) =>
        gradeStudent.itemExclusions.map((itemExclusion) => ({
          gradeStudentId: remapGradeStudentId(gradeStudent.id),
          gradeItemId: remapItemId(itemExclusion.gradeItemId),
        }))
      )
      if (exclusionRows.length > 0) {
        await tx.gradeItemExclusion.createMany({ data: exclusionRows })
      }

      // 9. 観点間の制約ルール。
      //   比較先・集計対象は評価項目への参照なので新gradeItemIdへ再マップする
      //   （旧configの観点名参照だったころは再マップ不要だった）。
      //   式（expression）だけは自由記述で項目名を含むため、文字列のまま複製する。
      for (const gradeConstraint of source.gradeConstraints) {
        const newConstraint = await tx.gradeConstraint.create({
          data: {
            gradeId: grade.id,
            name: gradeConstraint.name,
            kind: gradeConstraint.kind,
            targetGradeItemId: gradeConstraint.targetGradeItemId
              ? remapItemId(gradeConstraint.targetGradeItemId)
              : null,
            aggregate: gradeConstraint.aggregate,
            tolerance: gradeConstraint.tolerance,
            expression: gradeConstraint.expression,
            color: gradeConstraint.color,
            message: gradeConstraint.message,
            enabled: gradeConstraint.enabled,
            order: gradeConstraint.order,
          },
        })

        // 設定リレーションのidは親idから決定論的に作るため本体作成後に書く
        await writeConstraintConfig(tx, newConstraint.id, {
          viewpointGradeItemIds: gradeConstraint.viewpoints.map((viewpoint) =>
            remapItemId(viewpoint.gradeItemId)
          ),
          labelValues: Object.fromEntries(
            gradeConstraint.labelValues.map((labelValue) => [
              labelValue.label,
              Number(labelValue.value),
            ])
          ),
          exclusionLabels: gradeConstraint.exclusionLabels.map(
            (exclusionLabel) => exclusionLabel.label
          ),
        })
      }

      return { gradeId: grade.id, name: copyName }
    },
    { timeout: 30000 }
  )

  if (!result) {
    throw new Error("Grade exam not found")
  }

  await recordAuditLog({
    action: "grade.duplicate",
    entityType: "Grade",
    entityId: result.gradeId,
    scopeId: result.gradeId,
    scopeLabel: result.name,
    target: result.name,
  })

  return getGradeById(result.gradeId)
}

// =============================================================================
// タグ（GradeTag）
// =============================================================================

/** 成績算出のタグを一括設定（既存を全削除して再作成） */
export async function setGradeTags(gradeId: string, tagIds: string[]) {
  await prisma.$transaction(async (tx) => {
    await tx.gradeTag.deleteMany({ where: { gradeId } })
    if (tagIds.length > 0) {
      await tx.gradeTag.createMany({
        data: tagIds.map((tagId) => ({ gradeId, tagId })),
      })
    }
  })
}

/**
 * 成績算出にタグを1件追加（既存タグは保持・冪等）。
 *
 * 一覧の一括タグ付けはこちらを使う。全置換にすると、他端末が付けたタグを巻き添えにする。
 */
export async function addGradeTag(gradeId: string, tagId: string) {
  await prisma.gradeTag.upsert({
    where: { gradeId_tagId: { gradeId, tagId } },
    update: {},
    create: { gradeId, tagId },
  })
}
