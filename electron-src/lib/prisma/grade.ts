/**
 * Grade（成績算出試験）のPrisma操作関数
 */

import { diffFields, recordAuditLog } from "./auditLog"
import prisma from "./client"
import {
  gradeItemWithDataSourcesInclude,
  hydrateGrade,
  parseEstimationSourceIds,
} from "./gradeDataSource"
import { serializePrisma } from "./serializePrisma"

/**
 * 全成績算出試験を取得
 */
export async function getAllGrades() {
  try {
    const grades = await prisma.grade.findMany({
      include: {
        gradeClassrooms: {
          include: { classroom: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemWithDataSourcesInclude,
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            gradeItems: true,
            gradeStudents: true,
            boundarySets: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })
    return {
      success: true,
      grades: grades.map((grade) => hydrateGrade(serializePrisma(grade))),
    }
  } catch (error) {
    console.error("Error getting grade exams:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * IDで成績算出試験を取得
 */
export async function getGradeById(id: string) {
  try {
    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        gradeClassrooms: {
          include: { classroom: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemWithDataSourcesInclude,
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            gradeItems: true,
            gradeStudents: true,
            boundarySets: true,
          },
        },
      },
    })
    if (!grade) {
      return { success: false, error: "Grade exam not found" }
    }
    return {
      success: true,
      grade: hydrateGrade(serializePrisma(grade)),
    }
  } catch (error) {
    console.error("Error getting grade exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績算出試験を作成
 */
export async function createGrade(data: {
  name: string
  description?: string
  referenceDate?: string | null
}) {
  try {
    const grade = await prisma.grade.create({
      data: {
        name: data.name,
        description: data.description,
        referenceDate: data.referenceDate ? new Date(data.referenceDate) : null,
      },
      include: {
        gradeClassrooms: {
          include: { classroom: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemWithDataSourcesInclude,
          orderBy: { order: "asc" },
        },
      },
    })

    await recordAuditLog({
      action: "grade.create",
      entityType: "Grade",
      entityId: grade.id,
      scopeId: grade.id,
      scopeLabel: grade.name,
      target: grade.name,
    })

    return {
      success: true,
      grade: hydrateGrade(serializePrisma(grade)),
    }
  } catch (error) {
    console.error("Error creating grade exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
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
  try {
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined)
      updateData.description = data.description
    if (data.referenceDate !== undefined) {
      updateData.referenceDate = data.referenceDate
        ? new Date(data.referenceDate)
        : null
    }
    const before = await prisma.grade.findUnique({
      where: { id },
      select: { name: true, description: true },
    })
    const grade = await prisma.grade.update({
      where: { id },
      data: updateData,
      include: {
        gradeClassrooms: {
          include: { classroom: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemWithDataSourcesInclude,
          orderBy: { order: "asc" },
        },
      },
    })

    await recordAuditLog({
      action: "grade.update",
      entityType: "Grade",
      entityId: grade.id,
      scopeId: grade.id,
      scopeLabel: grade.name,
      target: grade.name,
      changes: diffFields(
        before ?? undefined,
        { name: grade.name, description: grade.description },
        [
          { field: "name", label: "成績名" },
          { field: "description", label: "説明" },
        ]
      ),
    })

    return {
      success: true,
      grade: hydrateGrade(serializePrisma(grade)),
    }
  } catch (error) {
    console.error("Error updating grade exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績算出試験を削除
 */
export async function deleteGrade(id: string) {
  try {
    const before = await prisma.grade.findUnique({
      where: { id },
      select: { name: true },
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

    return { success: true }
  } catch (error) {
    console.error("Error deleting grade exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
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
 * Grade を頂点に、GradeItem / GradeDataSource / GradeBoundarySet+GradeBoundary /
 * GradeOverride / GradeItemExclusion / GradeClassroom / GradeStudent /
 * GradeConstraint / GradeExportSettings をすべて新IDで再作成する。
 *
 * 外部参照（examId・studentId・classroomId・cropRegionId・courseworkId 等）は
 * 同一DB内でそのまま流用する（アーカイブ取込と違い名前照合は不要）。
 * Grade 内部を参照するフィールドは新IDへ再リンクする:
 *   - GradeItem を指す子（DataSource / BoundarySet / Override / Exclusion）→ 旧→新 gradeItemId
 *   - GradeDataSource.estimationSourceIds（同一Grade内の他DataSource ID群）→ 旧→新 dataSourceId
 *
 * ⚠️ Grade に子テーブル／内部参照フィールドを追加した場合は、ここと
 *    import/grade-archive の dataCreator（アーカイブ取込側）の両方を更新すること。
 *
 * 複製元の読み取りと全 create は単一トランザクション内で行い、共有DB上の並行編集に
 * 対する一貫性を確保する。行数が多い独立テーブルは createMany でまとめて挿入する。
 */
export async function duplicateGrade(id: string) {
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const source = await tx.grade.findUnique({
          where: { id },
          include: {
            gradeClassrooms: { orderBy: { order: "asc" } },
            gradeStudents: true,
            gradeItems: {
              include: { dataSources: { orderBy: { order: "asc" } } },
              orderBy: { order: "asc" },
            },
            boundarySets: {
              include: { boundaries: { orderBy: { order: "asc" } } },
            },
            gradeOverrides: true,
            gradeItemExclusions: true,
            gradeConstraints: { orderBy: { order: "asc" } },
            exportSettings: true,
          },
        })
        if (!source) return null

        // 重複しないコピー名（Grade.name にDB制約は無く、UX目的の best-effort）
        const allGrades = await tx.grade.findMany({ select: { name: true } })
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

        // 2. エクスポート設定（1:1）
        if (source.exportSettings) {
          await tx.gradeExportSettings.create({
            data: {
              gradeId: grade.id,
              settingsJson: source.exportSettings.settingsJson,
            },
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

        // 4. 対象生徒（独立行）
        if (source.gradeStudents.length > 0) {
          await tx.gradeStudent.createMany({
            data: source.gradeStudents.map((gradeStudent) => ({
              gradeId: grade.id,
              studentId: gradeStudent.studentId,
              customOrder: gradeStudent.customOrder,
            })),
          })
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
                estimationSourceIds: dataSource.estimationSourceIds,
              },
            })
            dataSourceIdMap.set(dataSource.id, newDataSource.id)
            const oldEstimationSourceIds = parseEstimationSourceIds(
              dataSource.estimationSourceIds
            )
            if (oldEstimationSourceIds.length > 0) {
              dataSourcesToRelink.push({
                newId: newDataSource.id,
                oldEstimationSourceIds,
              })
            }
          }
        }

        // 5.5. estimationSourceIds を新DataSource IDへ remap
        //   （元Grade内に見つからないID＝不整合は落とす）。
        for (const relink of dataSourcesToRelink) {
          const remapped = relink.oldEstimationSourceIds
            .map((oldSourceId) => dataSourceIdMap.get(oldSourceId))
            .filter((newSourceId): newSourceId is string => !!newSourceId)
          await tx.gradeDataSource.update({
            where: { id: relink.newId },
            data: { estimationSourceIds: JSON.stringify(remapped) },
          })
        }

        // 6. 評定境界セット + 境界（gradeItemId を再リンク）
        for (const boundarySet of source.boundarySets) {
          const newBoundarySet = await tx.gradeBoundarySet.create({
            data: {
              gradeId: grade.id,
              gradeItemId: remapItemId(boundarySet.gradeItemId),
            },
          })
          if (boundarySet.boundaries.length > 0) {
            await tx.gradeBoundary.createMany({
              data: boundarySet.boundaries.map((boundary) => ({
                gradeBoundarySetId: newBoundarySet.id,
                label: boundary.label,
                minPercentage: boundary.minPercentage,
                order: boundary.order,
              })),
            })
          }
        }

        // 7. 評定の手動上書き（gradeItemId を再リンク／独立行）
        if (source.gradeOverrides.length > 0) {
          await tx.gradeOverride.createMany({
            data: source.gradeOverrides.map((gradeOverride) => ({
              gradeId: grade.id,
              studentId: gradeOverride.studentId,
              gradeItemId: remapItemId(gradeOverride.gradeItemId),
              overrideLabel: gradeOverride.overrideLabel,
            })),
          })
        }

        // 8. 評価項目ごとの生徒除外（gradeItemId 必須のため remap 結果を非nullで使う／独立行）
        if (source.gradeItemExclusions.length > 0) {
          await tx.gradeItemExclusion.createMany({
            data: source.gradeItemExclusions.map((exclusion) => {
              const newItemId = itemIdMap.get(exclusion.gradeItemId)
              if (!newItemId) {
                throw new Error(
                  `GradeItem ${exclusion.gradeItemId} の複製先が見つかりません`
                )
              }
              return {
                gradeId: grade.id,
                studentId: exclusion.studentId,
                gradeItemId: newItemId,
              }
            }),
          })
        }

        // 9. 観点間の制約ルール（式・configは観点名参照のためID再マップ不要／独立行）
        if (source.gradeConstraints.length > 0) {
          await tx.gradeConstraint.createMany({
            data: source.gradeConstraints.map((gradeConstraint) => ({
              gradeId: grade.id,
              name: gradeConstraint.name,
              kind: gradeConstraint.kind,
              config: gradeConstraint.config,
              expression: gradeConstraint.expression,
              color: gradeConstraint.color,
              message: gradeConstraint.message,
              enabled: gradeConstraint.enabled,
              order: gradeConstraint.order,
            })),
          })
        }

        return { gradeId: grade.id, name: copyName }
      },
      { timeout: 30000 }
    )

    if (!result) {
      return { success: false, error: "Grade exam not found" }
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
  } catch (error) {
    console.error("Error duplicating grade exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// =============================================================================
// GradeExportSettings（エクスポート設定）
// =============================================================================

/** 成績算出試験のエクスポート設定をJSON形式で取得する */
export async function getGradeExportSettings(gradeId: string) {
  const settings = await prisma.gradeExportSettings.findUnique({
    where: { gradeId },
  })
  if (!settings) return null
  try {
    return JSON.parse(settings.settingsJson)
  } catch {
    return null
  }
}

/** 成績算出試験のエクスポート設定を作成または更新する（JSON文字列として保存） */
export async function upsertGradeExportSettings(
  gradeId: string,
  settings: Record<string, unknown>
) {
  const settingsJson = JSON.stringify(settings)
  return prisma.gradeExportSettings.upsert({
    where: { gradeId },
    update: { settingsJson },
    create: { gradeId, settingsJson },
  })
}
