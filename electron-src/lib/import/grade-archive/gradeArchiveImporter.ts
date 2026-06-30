/**
 * 成績算出アーカイブのインポート
 */

import type { Prisma } from "@prisma/client"

import type {
  GradeArchiveData,
  GradeArchiveImportOptions,
  GradeArchiveImportPreview,
} from "../../../../src/types/gradeArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import prisma from "../../prisma/client"
import { importCourseworkData } from "../coursework-archive/dataCreator"
import { transformGradeToLatest } from "../grade-transformers"

/**
 * インポート前のプレビュー（照合結果）
 */
export async function previewGradeArchiveImport(
  rawData: GradeArchiveData
): Promise<GradeArchiveImportPreview> {
  // 旧バージョンを現行（courseworkArchive 形式）へ正規化してから照合する
  const { data } = transformGradeToLatest(rawData)
  const { gradeData } = data
  const courseworkArchive = data.courseworkArchive

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

  // 埋め込み資料の照合候補（正規化済みのため courseworkArchive のみ参照）
  const cwPreviewItems = (courseworkArchive?.courseworks ?? []).map((cw) => ({
    id: cw.id,
    name: cw.name,
    itemCount: cw.items.length,
    studentCount: cw.students.length,
  }))

  // Student照合
  const courseworkStudentNumbers =
    courseworkArchive?.studentsData.map((s) => s.studentNumber) ?? []
  const studentNumbers = [
    ...courseworkStudentNumbers,
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

  // 埋め込み資料のマッチング候補（uuid一次・名前二次）を算出
  const courseworkMatches = await Promise.all(
    cwPreviewItems.map(async (cw) => {
      // uuid 完全一致（同一PC由来）
      const uuidMatch = cw.id
        ? await prisma.coursework.findUnique({
            where: { id: cw.id },
            select: { id: true, name: true },
          })
        : null
      // 名前一致候補（名前は非ユニークなので複数あり得る。uuid一致は除外）
      const nameCandidates = (
        await prisma.coursework.findMany({
          where: { name: cw.name },
          select: { id: true, name: true },
        })
      ).filter((c) => c.id !== uuidMatch?.id)
      return {
        archiveId: cw.id,
        name: cw.name,
        itemCount: cw.itemCount,
        studentCount: cw.studentCount,
        uuidMatch: uuidMatch ?? null,
        nameCandidates,
      }
    })
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
    courseworkMatches,
  }
}

/**
 * 実際のインポート実行
 */
export async function importGradeArchive(
  rawData: GradeArchiveData,
  options: GradeArchiveImportOptions = {}
): Promise<{
  success: boolean
  gradeId?: string
  error?: string
  /** 取り込み時の警告（点数スキップ・参照先未検出など）。空なら省略 */
  warnings?: string[]
}> {
  try {
    const { examMapping, courseworkDecisions = {} } = options
    // 旧バージョン（1.3.0 manual / 1.4.0 名前ベース）を現行へ正規化してから取り込む
    const { data, warnings: transformWarnings } =
      transformGradeToLatest(rawData)
    const warnings: string[] = [...transformWarnings]
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const { gradeData, boundariesData } = data

        // 1. Grade作成
        const gp = await tx.grade.create({
          data: {
            name: gradeData.grade.name,
            description: gradeData.grade.description,
            // v1.2.0+: 基準日（古いアーカイブではundefined → null）
            referenceDate: gradeData.grade.referenceDate
              ? new Date(gradeData.grade.referenceDate)
              : null,
          },
        })

        // 1.5. GradeExportSettings作成 (v1.2.0+、Gradeと1:1)
        if (gradeData.exportSettings) {
          await tx.gradeExportSettings.create({
            data: {
              gradeId: gp.id,
              settingsJson: gradeData.exportSettings.settingsJson,
            },
          })
        }

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

        // 3.5. Coursework（試験外成績資料）の復元。
        //   transformGradeToLatest により旧 v1.3.0(manual)/v1.4.0(名前ベース) は
        //   現行の courseworkArchive 形式へ正規化済み。独立 coursework モジュールへ委譲し、
        //   既存生徒・学級への lookup のみ（allowCreate=false）で grade の従来挙動を維持する。
        /** アーカイブ項目uuid → 実 CourseworkItem.id（DataSource 再リンクの一次キー） */
        const itemIdToActual = new Map<string, string>()
        /** `${courseworkName}:${itemName}` → 実 CourseworkItem.id（名前フォールバック） */
        const itemNameToActual = new Map<string, string>()

        if (data.courseworkArchive) {
          const cwResult = await importCourseworkData(
            tx,
            data.courseworkArchive,
            {
              allowCreate: false,
              studentMatching: "studentNumber",
              courseworkDecisions,
            }
          )
          warnings.push(...cwResult.warnings)
          for (const [archiveItemId, actualId] of cwResult.itemIdMap) {
            itemIdToActual.set(archiveItemId, actualId)
          }
          for (const cw of data.courseworkArchive.courseworks) {
            for (const item of cw.items) {
              const actual = cwResult.itemIdMap.get(item.id)
              if (actual)
                itemNameToActual.set(`${cw.name}:${item.name}`, actual)
            }
          }
        }

        // 4. GradeItem + DataSource作成
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

            // CourseworkItem 解決（uuid一次・名前二次）。
            //   旧 v1.3.0 の "manual" は transformGradeToLatest で "coursework" へ
            //   正規化済み（courseworkItemId / courseworkName / courseworkItemName を付与）。
            let courseworkItemId: string | null = null
            if (dsData.type === "coursework") {
              // アーカイブ項目uuidで一次解決
              if (dsData.courseworkItemId) {
                courseworkItemId =
                  itemIdToActual.get(dsData.courseworkItemId) ?? null
              }
              // 名前フォールバック（uuid不一致時）
              if (
                !courseworkItemId &&
                dsData.courseworkName &&
                dsData.courseworkItemName
              ) {
                courseworkItemId =
                  itemNameToActual.get(
                    `${dsData.courseworkName}:${dsData.courseworkItemName}`
                  ) ?? null
              }
              if (!courseworkItemId) {
                warnings.push(
                  `成績項目「${giData.name}」のデータソース「${dsData.name}」: 参照先の試験外成績資料が見つかりませんでした`
                )
              }
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

            await tx.gradeDataSource.create({
              data: {
                gradeItemId: gi.id,
                type: dsData.type,
                examId,
                subtotalId,
                cropRegionId,
                courseworkItemId,
                name: dsData.name,
                // v1.6.0: GradeDataSource.maxScore 列は廃止。満点はライブ算出するため挿入しない。
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
          }
        }

        // 5. （v1.4.0で廃止）旧 ManualScore 挿入は Coursework 復元(3.5)に統合済み

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

        // 8. GradeOverride挿入（後方互換: optionalフィールド）
        if (gradeData.gradeOverrides && gradeData.gradeOverrides.length > 0) {
          for (const ov of gradeData.gradeOverrides) {
            const student = await tx.student.findUnique({
              where: { studentNumber: ov.studentNumber },
            })
            if (!student) continue

            let gradeItemId: string | null = null
            if (ov.gradeItemName) {
              const gradeItem = await tx.gradeItem.findFirst({
                where: {
                  gradeId: gp.id,
                  name: ov.gradeItemName,
                },
              })
              if (!gradeItem) continue
              gradeItemId = gradeItem.id
            }

            await tx.gradeOverride.create({
              data: {
                gradeId: gp.id,
                studentId: student.id,
                targetType: ov.targetType,
                gradeItemId,
                overrideLabel: ov.overrideLabel,
              },
            })
          }
        }

        return { success: true, gradeId: gp.id }
      }
    )

    if (warnings.length > 0) {
      console.warn("Grade archive import warnings:", warnings)
    }

    // 監査ログ: 成績インポート
    await recordAuditLog({
      action: "grade.import",
      entityType: "Grade",
      entityId: result.gradeId ?? "",
      scopeId: result.gradeId ?? null,
      scopeLabel: data.gradeData.grade.name,
      target: data.gradeData.grade.name,
    })

    // 警告は呼び出し側（UI）へ返して通知する
    return { ...result, warnings: warnings.length > 0 ? warnings : undefined }
  } catch (error) {
    console.error("Error importing grade archive:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
