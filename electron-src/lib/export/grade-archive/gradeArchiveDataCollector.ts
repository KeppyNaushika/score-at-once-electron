/**
 * 成績算出アーカイブ用データ収集
 */

import type {
  ArchiveBoundariesData,
  ArchiveCoursework,
  ArchiveGradeData,
} from "../../../../src/types/gradeArchive.types"
import prisma from "../../prisma/client"

export interface CollectedGradeData {
  gradeData: ArchiveGradeData
  /** v1.4.0+: 参照中の試験外成績資料（Coursework）を自己完結で埋め込む */
  courseworksData: ArchiveCoursework[]
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
      exportSettings: true,
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
      courseworkId:
        ds.type === "coursework"
          ? (ds.courseworkItem?.coursework?.id ?? null)
          : null,
      courseworkItemId:
        ds.type === "coursework" ? (ds.courseworkItem?.id ?? null) : null,
      courseworkName:
        ds.type === "coursework"
          ? (ds.courseworkItem?.coursework?.name ?? null)
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

  // v1.4.0+: 参照中の試験外成績資料（Coursework）を一意に集めて埋め込む
  const courseworkIds = new Set(
    allDataSources
      .filter((ds) => ds.type === "coursework" && ds.courseworkItem)
      .map((ds) => ds.courseworkItem!.courseworkId)
  )

  const courseworkRows = await prisma.coursework.findMany({
    where: { id: { in: [...courseworkIds] } },
    include: {
      classes: {
        include: { class: { select: { name: true } } },
        orderBy: { order: "asc" },
      },
      tags: { include: { tag: { select: { name: true } } } },
      students: {
        include: { student: { select: { studentNumber: true } } },
        orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
      },
      items: {
        include: {
          letterScales: { orderBy: { order: "asc" } },
          scores: {
            include: { student: { select: { studentNumber: true } } },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  })

  const courseworksData: ArchiveCoursework[] = courseworkRows.map((cw) => ({
    id: cw.id,
    name: cw.name,
    description: cw.description,
    date: cw.date?.toISOString() ?? null,
    classes: cw.classes.map((c) => ({
      className: c.class.name,
      order: c.order,
    })),
    tags: cw.tags.map((t) => ({ tagName: t.tag.name })),
    students: cw.students.map((s) => ({
      studentNumber: s.student.studentNumber,
      customOrder: s.customOrder,
    })),
    items: cw.items.map((item) => ({
      id: item.id,
      name: item.name,
      order: item.order,
      maxScore: Number(item.maxScore),
      inputMode: item.inputMode,
      letterScales: item.letterScales.map((ls) => ({
        label: ls.label,
        score: Number(ls.score),
        order: ls.order,
      })),
      scores: item.scores.map((sc) => ({
        studentNumber: sc.student.studentNumber,
        score: sc.score !== null ? Number(sc.score) : null,
        letterValue: sc.letterValue,
        adjustment: sc.adjustment !== null ? Number(sc.adjustment) : null,
        adjustmentReason: sc.adjustmentReason,
        comment: sc.comment,
      })),
    })),
  }))

  const manualScoresCount = courseworksData.reduce(
    (sum, cw) => sum + cw.items.reduce((s, item) => s + item.scores.length, 0),
    0
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
    },
    courseworksData,
    boundariesData: { boundarySets },
    counts: {
      gradeItems: gradeItems.length,
      dataSources: totalDataSources,
      manualScores: manualScoresCount,
      boundarySets: boundarySets.length,
      boundaries: totalBoundaries,
      classes: classRefs.length,
      students: studentRefs.length,
    },
  }
}
