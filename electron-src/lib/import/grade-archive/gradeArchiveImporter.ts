/**
 * 成績算出アーカイブのインポート
 */

import type { Prisma } from "@prisma/client"

import type {
  GradeArchiveData,
  GradeArchiveImportPreview,
} from "../../../../types/gradeArchive.types"
import prisma from "../../prisma/client"

/**
 * インポート前のプレビュー（照合結果）
 */
export async function previewGradeArchiveImport(
  data: GradeArchiveData
): Promise<GradeArchiveImportPreview> {
  const { gradeProjectData, manualScoresData } = data

  // Class照合（複数学級対応）
  const classMatches = await Promise.all(
    gradeProjectData.classRefs.map(async (ref) => {
      const existing = await prisma.class.findUnique({
        where: { name: ref.name },
      })
      return { found: !!existing, name: ref.name }
    })
  )

  // ExamProject照合
  const examProjectMatches = await Promise.all(
    gradeProjectData.examProjectRefs.map(async (ref) => {
      const projects = await prisma.project.findMany({
        where: { examName: ref.examName },
        select: { id: true },
      })
      return {
        examName: ref.examName,
        found: projects.length > 0,
        projectId: projects[0]?.id ?? null,
      }
    })
  )

  // Student照合
  const studentNumbers = [
    ...new Set(manualScoresData.manualScores.map((ms) => ms.studentNumber)),
    ...gradeProjectData.studentRefs.map((s) => s.studentNumber),
  ]
  const uniqueNumbers = [...new Set(studentNumbers)]
  const existingStudents = await prisma.student.findMany({
    where: { studentNumber: { in: uniqueNumbers } },
    select: { studentNumber: true },
  })
  const existingNumberSet = new Set(
    existingStudents.map((s) => s.studentNumber)
  )

  return {
    manifest: data.manifest,
    classMatches,
    examProjectMatches,
    studentMatchCount: uniqueNumbers.filter((sn) => existingNumberSet.has(sn))
      .length,
    studentMissingCount: uniqueNumbers.filter(
      (sn) => !existingNumberSet.has(sn)
    ).length,
  }
}

/**
 * 実際のインポート実行
 */
export async function importGradeArchive(
  data: GradeArchiveData,
  examProjectMapping?: Record<string, string>
): Promise<{ success: boolean; gradeProjectId?: string; error?: string }> {
  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { gradeProjectData, manualScoresData, boundariesData } = data

      // 1. GradeProject作成
      const gp = await tx.gradeProject.create({
        data: {
          name: gradeProjectData.gradeProject.name,
          description: gradeProjectData.gradeProject.description,
        },
      })

      // 2. Class照合→GradeProjectClass作成
      for (let i = 0; i < gradeProjectData.classRefs.length; i++) {
        const ref = gradeProjectData.classRefs[i]
        const cls = await tx.class.findUnique({
          where: { name: ref.name },
        })
        if (cls) {
          await tx.gradeProjectClass.create({
            data: {
              gradeProjectId: gp.id,
              classId: cls.id,
              order: i,
            },
          })
        }
      }

      // 3. Student照合→GradeProjectStudent作成
      for (const studentRef of gradeProjectData.studentRefs) {
        const student = await tx.student.findUnique({
          where: { studentNumber: studentRef.studentNumber },
        })
        if (student) {
          await tx.gradeProjectStudent.create({
            data: {
              gradeProjectId: gp.id,
              studentId: student.id,
              customOrder: studentRef.customOrder,
            },
          })
        }
      }

      // 4. GradeItem + DataSource作成
      // gradeItemName+dataSourceName → dataSourceId のマッピング
      const dsKeyToId = new Map<string, string>()

      for (const giData of gradeProjectData.gradeItems) {
        const gi = await tx.gradeItem.create({
          data: {
            gradeProjectId: gp.id,
            name: giData.name,
            order: giData.order,
          },
        })

        for (const dsData of giData.dataSources) {
          let examProjectId: string | null = null
          if (
            dsData.examProjectName &&
            (dsData.type === "project_total" ||
              dsData.type === "subtotal" ||
              dsData.type === "crop_region")
          ) {
            examProjectId = examProjectMapping?.[dsData.examProjectName] ?? null
            if (!examProjectId) {
              const projects = await tx.project.findMany({
                where: { examName: dsData.examProjectName },
                select: { id: true },
              })
              examProjectId = projects[0]?.id ?? null
            }
          }

          // Subtotal照合（名前ベース）
          let subtotalId: string | null = null
          if (
            dsData.type === "subtotal" &&
            dsData.subtotalName &&
            examProjectId
          ) {
            const subtotals = await tx.subtotal.findMany({
              where: { name: dsData.subtotalName },
            })
            subtotalId = subtotals[0]?.id ?? null
          }

          // CropRegion照合（ラベルベース）
          let cropRegionId: string | null = null
          if (
            dsData.type === "crop_region" &&
            dsData.cropRegionLabel &&
            examProjectId
          ) {
            const regions = await tx.cropRegion.findMany({
              where: {
                label: dsData.cropRegionLabel,
                projectPage: { projectId: examProjectId },
              },
            })
            cropRegionId = regions[0]?.id ?? null
          }

          const ds = await tx.gradeDataSource.create({
            data: {
              gradeItemId: gi.id,
              type: dsData.type,
              examProjectId,
              subtotalId,
              cropRegionId,
              name: dsData.name,
              maxScore: dsData.maxScore,
              weight: dsData.weight,
              order: dsData.order,
              absentMethod: dsData.absentMethod ?? "null",
              absentRatio: dsData.absentRatio ?? 1.0,
              absentOffset: dsData.absentOffset ?? 0,
              treatExpectedAsMissing: dsData.treatExpectedAsMissing ?? false,
              estimationMode: dsData.estimationMode ?? "all",
              estimationSourceIds: JSON.stringify(
                dsData.estimationSourceIds ?? []
              ),
            },
          })
          dsKeyToId.set(`${giData.name}:${dsData.name}`, ds.id)
        }
      }

      // 5. ManualScore挿入
      for (const msData of manualScoresData.manualScores) {
        const dsId = dsKeyToId.get(
          `${msData.gradeItemName}:${msData.dataSourceName}`
        )
        if (!dsId) continue

        const student = await tx.student.findUnique({
          where: { studentNumber: msData.studentNumber },
        })
        if (!student) continue

        await tx.manualScore.create({
          data: {
            gradeDataSourceId: dsId,
            studentId: student.id,
            score: msData.score,
          },
        })
      }

      // 6. BoundarySet/Boundary挿入
      for (const bsData of boundariesData.boundarySets) {
        let gradeItemId: string | null = null
        if (bsData.gradeItemName) {
          // GradeItem名で照合（同じプロジェクト内）
          const gi = await tx.gradeItem.findFirst({
            where: {
              gradeProjectId: gp.id,
              name: bsData.gradeItemName,
            },
          })
          gradeItemId = gi?.id ?? null
          if (!gradeItemId) continue
        }

        const bs = await tx.gradeBoundarySet.create({
          data: {
            gradeProjectId: gp.id,
            targetType: bsData.targetType,
            gradeItemId,
          },
        })

        if (bsData.boundaries.length > 0) {
          await tx.gradeBoundary.createMany({
            data: bsData.boundaries.map((b) => ({
              gradeBoundarySetId: bs.id,
              label: b.label,
              minPercentage: b.minPercentage,
              order: b.order,
            })),
          })
        }
      }

      // 7. GradeItemExclusion挿入（後方互換: optionalフィールド）
      if (
        gradeProjectData.gradeItemExclusions &&
        gradeProjectData.gradeItemExclusions.length > 0
      ) {
        for (const excl of gradeProjectData.gradeItemExclusions) {
          const student = await tx.student.findUnique({
            where: { studentNumber: excl.studentNumber },
          })
          if (!student) continue

          const gradeItem = await tx.gradeItem.findFirst({
            where: {
              gradeProjectId: gp.id,
              name: excl.gradeItemName,
            },
          })
          if (!gradeItem) continue

          await tx.gradeItemExclusion.create({
            data: {
              gradeProjectId: gp.id,
              studentId: student.id,
              gradeItemId: gradeItem.id,
            },
          })
        }
      }

      return { success: true, gradeProjectId: gp.id }
    })
  } catch (error) {
    console.error("Error importing grade archive:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
