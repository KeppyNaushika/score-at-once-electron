/**
 * 成績算出アーカイブ用データ収集
 */

import type { CollectedCourseworkData } from "../../../../src/types/courseworkArchive.types"
import type {
  ArchiveBoundariesData,
  ArchiveGradeData,
} from "../../../../src/types/gradeArchive.types"
import prisma from "../../prisma/client"
import { collectCourseworkArchiveData } from "../coursework-archive/dataCollector"

export interface CollectedGradeData {
  gradeData: ArchiveGradeData
  /**
   * v1.5.0+: 参照中の試験外成績資料（Coursework）を coursework-archive と同じ
   * UUID ベースの形で内包する（独立モジュールの収集ロジックへ委譲）。
   */
  courseworkArchive: CollectedCourseworkData
  boundariesData: ArchiveBoundariesData
  counts: {
    gradeItems: number
    dataSources: number
    manualScores: number
    boundarySets: number
    boundaries: number
    classrooms: number
    students: number
  }
}

/** 指定した成績算出IDに関連する全データ（成績項目・手動スコア・境界値・生徒情報）をDBから収集する */
export async function collectGradeArchiveData(
  gradeId: string
): Promise<CollectedGradeData> {
  const grade = await prisma.grade.findUniqueOrThrow({
    where: { id: gradeId },
    include: {
      gradeItems: {
        include: {
          dataSources: {
            include: {
              exam: { select: { examName: true, examDate: true } },
              subtotal: true,
              cropRegion: true,
              courseworkItem: { include: { coursework: true } },
              coursework: { select: { id: true, name: true } },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
      gradeClassrooms: {
        include: { classroom: true },
        orderBy: { order: "asc" },
      },
      gradeStudents: {
        include: {
          student: {
            include: {
              memberships: {
                include: { classroom: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
      },
      boundarySets: {
        include: {
          gradeItem: true,
          boundaries: { orderBy: { order: "asc" } },
        },
      },
      gradeItemExclusions: {
        include: {
          student: { select: { studentNumber: true } },
          gradeItem: { select: { name: true } },
        },
      },
      gradeOverrides: {
        include: {
          student: { select: { studentNumber: true } },
          gradeItem: { select: { name: true } },
        },
      },
      gradeFrozenScores: {
        include: {
          student: { select: { studentNumber: true } },
          gradeItem: { select: { name: true } },
        },
      },
      gradeConstraints: {
        orderBy: { order: "asc" },
      },
      exportSettings: true,
    },
  })

  const classroomIds = new Set(
    grade.gradeClassrooms.map((gradeClassroom) => gradeClassroom.classroomId)
  )

  const gradeItems = grade.gradeItems.map((gradeItem) => ({
    name: gradeItem.name,
    order: gradeItem.order,
    dataSources: gradeItem.dataSources.map((dataSource) => ({
      type: dataSource.type,
      name: dataSource.name,
      // v1.6.0: maxScore は廃止（満点は import 後に元データからライブ算出）。出力しない。
      weight: Number(dataSource.weight),
      order: dataSource.order,
      examName: dataSource.exam?.examName ?? null,
      subtotalName: dataSource.subtotal?.name ?? null,
      cropRegionLabel: dataSource.cropRegion?.label ?? null,
      absentMethod: dataSource.absentMethod,
      absentRatio: Number(dataSource.absentRatio),
      absentOffset: Number(dataSource.absentOffset),
      treatExpectedAsMissing: dataSource.treatExpectedAsMissing,
      estimationMode: dataSource.estimationMode,
      estimationSourceIds: (() => {
        if (typeof dataSource.estimationSourceIds === "string") {
          try {
            return JSON.parse(dataSource.estimationSourceIds)
          } catch {
            return []
          }
        }
        return []
      })(),
      // coursework: 評価項目参照（courseworkId は親資料 / courseworkItemId は項目）
      // coursework_total: 資料全体参照（courseworkId のみ・項目参照は null）
      courseworkId:
        dataSource.type === "coursework"
          ? (dataSource.courseworkItem?.coursework?.id ?? null)
          : dataSource.type === "coursework_total"
            ? (dataSource.coursework?.id ?? null)
            : null,
      courseworkItemId:
        dataSource.type === "coursework"
          ? (dataSource.courseworkItem?.id ?? null)
          : null,
      courseworkName:
        dataSource.type === "coursework"
          ? (dataSource.courseworkItem?.coursework?.name ?? null)
          : dataSource.type === "coursework_total"
            ? (dataSource.coursework?.name ?? null)
            : null,
      courseworkItemName:
        dataSource.type === "coursework"
          ? (dataSource.courseworkItem?.name ?? null)
          : null,
    })),
  }))

  const allDataSources = grade.gradeItems.flatMap(
    (gradeItem) => gradeItem.dataSources
  )

  const examRefs = allDataSources
    .filter(
      (dataSource) =>
        (dataSource.type === "exam_total" ||
          dataSource.type === "subtotal" ||
          dataSource.type === "crop_region") &&
        dataSource.exam
    )
    .map((dataSource) => ({
      examName: dataSource.exam!.examName,
      examDate: dataSource.exam!.examDate?.toISOString() ?? null,
      dataSourceName: dataSource.name,
    }))

  const classroomRefs = grade.gradeClassrooms.map((gradeClassroom) => ({
    name: gradeClassroom.classroom.name,
  }))

  const studentRefs = grade.gradeStudents.map((gradeStudent) => {
    const membership = gradeStudent.student.memberships.find(
      (studentMembership) => classroomIds.has(studentMembership.classroomId)
    )
    return {
      studentNumber: gradeStudent.student.studentNumber,
      classroomName: membership?.classroom.name ?? null,
      customOrder: gradeStudent.customOrder,
    }
  })

  // v1.5.0+: 参照中の試験外成績資料（Coursework）を独立モジュールへ委譲して収集
  const courseworkIds = new Set(
    allDataSources
      .filter(
        (dataSource) =>
          dataSource.type === "coursework" && dataSource.courseworkItem
      )
      .map((dataSource) => dataSource.courseworkItem!.courseworkId)
  )
  const courseworkArchive = await collectCourseworkArchiveData([
    ...courseworkIds,
  ])
  const manualScoresCount = courseworkArchive.counts.scores

  const boundarySets = grade.boundarySets.map((boundarySet) => ({
    targetType: boundarySet.targetType,
    gradeItemName: boundarySet.gradeItem?.name ?? null,
    boundaries: boundarySet.boundaries.map((boundary) => ({
      label: boundary.label,
      minPercentage: Number(boundary.minPercentage),
      order: boundary.order,
    })),
  }))

  const totalBoundaries = boundarySets.reduce(
    (sum, boundarySet) => sum + boundarySet.boundaries.length,
    0
  )

  const totalDataSources = gradeItems.reduce(
    (sum, gradeItem) => sum + gradeItem.dataSources.length,
    0
  )

  const gradeItemExclusions = grade.gradeItemExclusions.map(
    (gradeItemExclusion) => ({
      studentNumber: gradeItemExclusion.student.studentNumber,
      gradeItemName: gradeItemExclusion.gradeItem.name,
    })
  )

  const gradeOverrides = grade.gradeOverrides.map((gradeOverride) => ({
    studentNumber: gradeOverride.student.studentNumber,
    targetType: gradeOverride.targetType,
    gradeItemName: gradeOverride.gradeItem?.name ?? null,
    overrideLabel: gradeOverride.overrideLabel,
  }))

  // 確定値は成績そのものなので必ず持ち出す。確定操作者は移動先に同じ User が居る保証が
  // 無いため出さない（取り込み側で null＝操作者不明になる）。
  const gradeFrozenScores = grade.gradeFrozenScores.map((gradeFrozenScore) => ({
    studentNumber: gradeFrozenScore.student.studentNumber,
    gradeItemName: gradeFrozenScore.gradeItem.name,
    weightedScore:
      gradeFrozenScore.weightedScore !== null
        ? Number(gradeFrozenScore.weightedScore)
        : null,
    weightedMaxScore: Number(gradeFrozenScore.weightedMaxScore),
    percentage:
      gradeFrozenScore.percentage !== null
        ? Number(gradeFrozenScore.percentage)
        : null,
    gradeLabel: gradeFrozenScore.gradeLabel,
    frozenAt: gradeFrozenScore.frozenAt.toISOString(),
  }))

  const gradeConstraints = grade.gradeConstraints.map((gradeConstraint) => ({
    name: gradeConstraint.name,
    kind: gradeConstraint.kind,
    config: gradeConstraint.config,
    expression: gradeConstraint.expression,
    color: gradeConstraint.color,
    message: gradeConstraint.message,
    enabled: gradeConstraint.enabled,
    order: gradeConstraint.order,
  }))

  return {
    gradeData: {
      grade: {
        name: grade.name,
        description: grade.description,
        referenceDate: grade.referenceDate?.toISOString() ?? null,
      },
      exportSettings: grade.exportSettings
        ? { settingsJson: grade.exportSettings.settingsJson }
        : null,
      gradeItems,
      classroomRefs,
      examRefs,
      studentRefs,
      gradeItemExclusions:
        gradeItemExclusions.length > 0 ? gradeItemExclusions : undefined,
      gradeOverrides: gradeOverrides.length > 0 ? gradeOverrides : undefined,
      gradeFrozenScores:
        gradeFrozenScores.length > 0 ? gradeFrozenScores : undefined,
      gradeConstraints:
        gradeConstraints.length > 0 ? gradeConstraints : undefined,
    },
    courseworkArchive,
    boundariesData: { boundarySets },
    counts: {
      gradeItems: gradeItems.length,
      dataSources: totalDataSources,
      manualScores: manualScoresCount,
      boundarySets: boundarySets.length,
      boundaries: totalBoundaries,
      classrooms: classroomRefs.length,
      students: studentRefs.length,
    },
  }
}
