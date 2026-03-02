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
  const { gradeData, manualScoresData } = data

  // Class照合（複数学級対応）
  const classMatches = await Promise.all(
    gradeData.classRefs.map(async (ref) => {
      const existing = await prisma.class.findUnique({
        where: { name: ref.name },
      })
      return { found: !!existing, name: ref.name }
    })
  )

  // ExamExam照合
  const examMatches = await Promise.all(
    gradeData.examRefs.map(async (ref) => {
      const exams = await prisma.exam.findMany({
        where: { examName: ref.examName },
        select: { id: true },
      })
      return {
        examName: ref.examName,
        found: exams.length > 0,
        examId: exams[0]?.id ?? null,
      }
    })
  )

  // Student照合
  const studentNumbers = [
    ...new Set(manualScoresData.manualScores.map((ms) => ms.studentNumber)),
    ...gradeData.studentRefs.map((s) => s.studentNumber),
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
    examMatches,
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
  examMapping?: Record<string, string>
): Promise<{ success: boolean; gradeId?: string; error?: string }> {
  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { gradeData, manualScoresData, boundariesData } = data

      // 1. Grade作成
      const gp = await tx.grade.create({
        data: {
          name: gradeData.grade.name,
          description: gradeData.grade.description,
        },
      })

      // 2. Class照合→GradeClass作成
      for (let i = 0; i < gradeData.classRefs.length; i++) {
        const ref = gradeData.classRefs[i]
        const cls = await tx.class.findUnique({
          where: { name: ref.name },
        })
        if (cls) {
          await tx.gradeClass.create({
            data: {
              gradeId: gp.id,
              classId: cls.id,
              order: i,
            },
          })
        }
      }

      // 3. Student照合→GradeStudent作成
      for (const studentRef of gradeData.studentRefs) {
        const student = await tx.student.findUnique({
          where: { studentNumber: studentRef.studentNumber },
        })
        if (student) {
          await tx.gradeStudent.create({
            data: {
              gradeId: gp.id,
              studentId: student.id,
              customOrder: studentRef.customOrder,
            },
          })
        }
      }

      // 4. GradeItem + DataSource作成
      // gradeItemName+dataSourceName → dataSourceId のマッピング
      const dsKeyToId = new Map<string, string>()

      for (const giData of gradeData.gradeItems) {
        const gi = await tx.gradeItem.create({
          data: {
            gradeId: gp.id,
            name: giData.name,
            order: giData.order,
          },
        })

        for (const dsData of giData.dataSources) {
          // 旧アーカイブ互換: project_total → exam_total
          if (dsData.type === "project_total") {
            dsData.type = "exam_total"
          }

          let examId: string | null = null
          if (
            dsData.examName &&
            (dsData.type === "exam_total" ||
              dsData.type === "subtotal" ||
              dsData.type === "crop_region")
          ) {
            examId = examMapping?.[dsData.examName] ?? null
            if (!examId) {
              const exams = await tx.exam.findMany({
                where: { examName: dsData.examName },
                select: { id: true },
              })
              examId = exams[0]?.id ?? null
            }
          }

          // Subtotal照合（名前ベース）
          let subtotalId: string | null = null
          if (dsData.type === "subtotal" && dsData.subtotalName && examId) {
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
            examId
          ) {
            const regions = await tx.cropRegion.findMany({
              where: {
                label: dsData.cropRegionLabel,
                examPage: { examId: examId },
              },
            })
            cropRegionId = regions[0]?.id ?? null
          }

          const ds = await tx.gradeDataSource.create({
            data: {
              gradeItemId: gi.id,
              type: dsData.type,
              examId,
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
          // GradeItem名で照合（同じ試験内）
          const gi = await tx.gradeItem.findFirst({
            where: {
              gradeId: gp.id,
              name: bsData.gradeItemName,
            },
          })
          gradeItemId = gi?.id ?? null
          if (!gradeItemId) continue
        }

        const bs = await tx.gradeBoundarySet.create({
          data: {
            gradeId: gp.id,
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
        gradeData.gradeItemExclusions &&
        gradeData.gradeItemExclusions.length > 0
      ) {
        for (const excl of gradeData.gradeItemExclusions) {
          const student = await tx.student.findUnique({
            where: { studentNumber: excl.studentNumber },
          })
          if (!student) continue

          const gradeItem = await tx.gradeItem.findFirst({
            where: {
              gradeId: gp.id,
              name: excl.gradeItemName,
            },
          })
          if (!gradeItem) continue

          await tx.gradeItemExclusion.create({
            data: {
              gradeId: gp.id,
              studentId: student.id,
              gradeItemId: gradeItem.id,
            },
          })
        }
      }

      return { success: true, gradeId: gp.id }
    })
  } catch (error) {
    console.error("Error importing grade archive:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
