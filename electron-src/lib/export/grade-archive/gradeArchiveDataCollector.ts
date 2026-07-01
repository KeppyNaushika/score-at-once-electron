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
  const gp = await prisma.grade.findUniqueOrThrow({
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
      gradeClasses: {
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
      gradeConstraints: {
        orderBy: { order: "asc" },
      },
      exportSettings: true,
    },
  })

  const classIds = new Set(gp.gradeClasses.map((c) => c.classroomId))

  const gradeItems = gp.gradeItems.map((gi) => ({
    name: gi.name,
    order: gi.order,
    dataSources: gi.dataSources.map((ds) => ({
      type: ds.type,
      name: ds.name,
      // v1.6.0: maxScore は廃止（満点は import 後に元データからライブ算出）。出力しない。
      weight: Number(ds.weight),
      order: ds.order,
      examName: ds.exam?.examName ?? null,
      subtotalName: ds.subtotal?.name ?? null,
      cropRegionLabel: ds.cropRegion?.label ?? null,
      absentMethod: ds.absentMethod,
      absentRatio: Number(ds.absentRatio),
      absentOffset: Number(ds.absentOffset),
      treatExpectedAsMissing: ds.treatExpectedAsMissing,
      estimationMode: ds.estimationMode,
      estimationSourceIds: (() => {
        if (typeof ds.estimationSourceIds === "string") {
          try {
            return JSON.parse(ds.estimationSourceIds)
          } catch {
            return []
          }
        }
        return []
      })(),
      // coursework: 評価項目参照（courseworkId は親資料 / courseworkItemId は項目）
      // coursework_total: 資料全体参照（courseworkId のみ・項目参照は null）
      courseworkId:
        ds.type === "coursework"
          ? (ds.courseworkItem?.coursework?.id ?? null)
          : ds.type === "coursework_total"
            ? (ds.coursework?.id ?? null)
            : null,
      courseworkItemId:
        ds.type === "coursework" ? (ds.courseworkItem?.id ?? null) : null,
      courseworkName:
        ds.type === "coursework"
          ? (ds.courseworkItem?.coursework?.name ?? null)
          : ds.type === "coursework_total"
            ? (ds.coursework?.name ?? null)
            : null,
      courseworkItemName:
        ds.type === "coursework" ? (ds.courseworkItem?.name ?? null) : null,
    })),
  }))

  const allDataSources = gp.gradeItems.flatMap((gi) => gi.dataSources)

  const examRefs = allDataSources
    .filter(
      (ds) =>
        (ds.type === "exam_total" ||
          ds.type === "subtotal" ||
          ds.type === "crop_region") &&
        ds.exam
    )
    .map((ds) => ({
      examName: ds.exam!.examName,
      examDate: ds.exam!.examDate?.toISOString() ?? null,
      dataSourceName: ds.name,
    }))

  const classRefs = gp.gradeClasses.map((c) => ({
    name: c.classroom.name,
  }))

  const studentRefs = gp.gradeStudents.map((ps) => {
    const membership = ps.student.memberships.find((m) =>
      classIds.has(m.classroomId)
    )
    return {
      studentNumber: ps.student.studentNumber,
      classroomName: membership?.classroom.name ?? null,
      customOrder: ps.customOrder,
    }
  })

  // v1.5.0+: 参照中の試験外成績資料（Coursework）を独立モジュールへ委譲して収集
  const courseworkIds = new Set(
    allDataSources
      .filter((ds) => ds.type === "coursework" && ds.courseworkItem)
      .map((ds) => ds.courseworkItem!.courseworkId)
  )
  const courseworkArchive = await collectCourseworkArchiveData([
    ...courseworkIds,
  ])
  const manualScoresCount = courseworkArchive.counts.scores

  const boundarySets = gp.boundarySets.map((bs) => ({
    targetType: bs.targetType,
    gradeItemName: bs.gradeItem?.name ?? null,
    boundaries: bs.boundaries.map((b) => ({
      label: b.label,
      minPercentage: Number(b.minPercentage),
      order: b.order,
    })),
  }))

  const totalBoundaries = boundarySets.reduce(
    (sum, bs) => sum + bs.boundaries.length,
    0
  )

  const totalDataSources = gradeItems.reduce(
    (sum, gi) => sum + gi.dataSources.length,
    0
  )

  const gradeItemExclusions = gp.gradeItemExclusions.map((ex) => ({
    studentNumber: ex.student.studentNumber,
    gradeItemName: ex.gradeItem.name,
  }))

  const gradeOverrides = gp.gradeOverrides.map((ov) => ({
    studentNumber: ov.student.studentNumber,
    targetType: ov.targetType,
    gradeItemName: ov.gradeItem?.name ?? null,
    overrideLabel: ov.overrideLabel,
  }))

  const gradeConstraints = gp.gradeConstraints.map((c) => ({
    name: c.name,
    kind: c.kind,
    config: c.config,
    expression: c.expression,
    color: c.color,
    message: c.message,
    enabled: c.enabled,
    order: c.order,
  }))

  return {
    gradeData: {
      grade: {
        name: gp.name,
        description: gp.description,
        referenceDate: gp.referenceDate?.toISOString() ?? null,
      },
      exportSettings: gp.exportSettings
        ? { settingsJson: gp.exportSettings.settingsJson }
        : null,
      gradeItems,
      classRefs,
      examRefs,
      studentRefs,
      gradeItemExclusions:
        gradeItemExclusions.length > 0 ? gradeItemExclusions : undefined,
      gradeOverrides: gradeOverrides.length > 0 ? gradeOverrides : undefined,
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
      classrooms: classRefs.length,
      students: studentRefs.length,
    },
  }
}
