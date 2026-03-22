/**
 * 成績算出アーカイブ用データ収集
 */

import type {
  ArchiveBoundariesData,
  ArchiveGradeData,
  ArchiveManualScoresData,
} from "../../../../src/types/gradeArchive.types"
import prisma from "../../prisma/client"

export interface CollectedGradeData {
  gradeData: ArchiveGradeData
  manualScoresData: ArchiveManualScoresData
  boundariesData: ArchiveBoundariesData
  counts: {
    gradeItems: number
    dataSources: number
    manualScores: number
    boundarySets: number
    boundaries: number
    classes: number
    students: number
  }
}

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
              manualScores: {
                include: { student: { select: { studentNumber: true } } },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
      gradeClasses: {
        include: { class: true },
        orderBy: { order: "asc" },
      },
      gradeStudents: {
        include: {
          student: {
            include: {
              memberships: {
                include: { class: { select: { name: true } } },
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
    },
  })

  const classIds = new Set(gp.gradeClasses.map((c) => c.classId))

  const gradeItems = gp.gradeItems.map((gi) => ({
    name: gi.name,
    order: gi.order,
    dataSources: gi.dataSources.map((ds) => ({
      type: ds.type,
      name: ds.name,
      maxScore: Number(ds.maxScore),
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
    name: c.class.name,
  }))

  const studentRefs = gp.gradeStudents.map((ps) => {
    const membership = ps.student.memberships.find((m) =>
      classIds.has(m.classId)
    )
    return {
      studentNumber: ps.student.studentNumber,
      className: membership?.class.name ?? null,
      customOrder: ps.customOrder,
    }
  })

  const manualScores = gp.gradeItems.flatMap((gi) =>
    gi.dataSources
      .filter((ds) => ds.type === "manual")
      .flatMap((ds) =>
        ds.manualScores.map((ms) => ({
          gradeItemName: gi.name,
          dataSourceName: ds.name,
          studentNumber: ms.student.studentNumber,
          score: ms.score !== null ? Number(ms.score) : null,
        }))
      )
  )

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

  return {
    gradeData: {
      grade: {
        name: gp.name,
        description: gp.description,
      },
      gradeItems,
      classRefs,
      examRefs,
      studentRefs,
      gradeItemExclusions:
        gradeItemExclusions.length > 0 ? gradeItemExclusions : undefined,
      gradeOverrides: gradeOverrides.length > 0 ? gradeOverrides : undefined,
    },
    manualScoresData: { manualScores },
    boundariesData: { boundarySets },
    counts: {
      gradeItems: gradeItems.length,
      dataSources: totalDataSources,
      manualScores: manualScores.length,
      boundarySets: boundarySets.length,
      boundaries: totalBoundaries,
      classes: classRefs.length,
      students: studentRefs.length,
    },
  }
}
