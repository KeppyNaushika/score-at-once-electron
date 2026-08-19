/**
 * 成績算出アーカイブ（.grade）用データ収集
 *
 * 【原則】Prisma のクエリが返した行をそのまま JSON として持つ。射影・詰め替えはしない。
 * JSON に載らない型だけを JSON.stringify と同じ規則で文字列にする
 * （DateTime → ISO 文字列、Decimal → decimal.js の toJSON と同じ文字列）。
 *
 * アーカイブに含めない実体（生徒・学級・試験・小計・採点領域）への参照は、行が持つ uuid を
 * 一次キーにしたまま残し、取り込み先で同定するための情報を別セクションで添える。
 * 生徒・学級は coursework-archive と同形の full レコードを carry する（uuid → 学籍番号 /
 * 学級名 のフォールバックが効く）。試験・小計・採点領域は carry できないので名前だけ添える。
 */

import type { Prisma } from "@prisma/client"

import type {
  ArchiveCwClass,
  ArchiveCwMembership,
  ArchiveCwStudent,
} from "../../../../src/types/courseworkArchive.types"
import type {
  ArchiveGradeClassroomRow,
  ArchiveGradeConstraintExclusionLabelRow,
  ArchiveGradeConstraintLabelValueRow,
  ArchiveGradeConstraintRow,
  ArchiveGradeConstraintViewpointRow,
  ArchiveGradeCropRegionRef,
  ArchiveGradeDataSourceEstimationSourceRow,
  ArchiveGradeDataSourceRow,
  ArchiveGradeExamRef,
  ArchiveGradeFrozenScoreRow,
  ArchiveGradeIndividualReportSettingsRow,
  ArchiveGradeItemBoundaryRow,
  ArchiveGradeItemExclusionRow,
  ArchiveGradeItemRow,
  ArchiveGradeOverrideRow,
  ArchiveGradeRow,
  ArchiveGradeStudentRow,
  ArchiveGradeSubtotalRef,
  CollectedGradeData,
} from "../../../../src/types/gradeArchive.types"
import prisma from "../../prisma/client"
import { collectCourseworkArchiveData } from "../coursework-archive/dataCollector"

/** Decimal を JSON.stringify と同じ文字列表現にする */
const decimalToJson = (value: Prisma.Decimal): string => value.toString()
const nullableDecimalToJson = (value: Prisma.Decimal | null): string | null =>
  value === null ? null : value.toString()

const dateToJson = (value: Date): string => value.toISOString()
const nullableDateToJson = (value: Date | null): string | null =>
  value === null ? null : value.toISOString()

/**
 * 指定した成績を、参照している試験外成績資料込みで収集する。
 * @throws Grade が存在しない場合
 */
export async function collectGradeArchiveData(
  gradeId: string
): Promise<CollectedGradeData> {
  const gradeRow = await prisma.grade.findUnique({ where: { id: gradeId } })
  if (!gradeRow) {
    throw new Error(`Grade ${gradeId} が見つかりません`)
  }

  const [
    classroomJoinRows,
    studentJoinRows,
    itemRows,
    constraintRows,
    reportSettingsRow,
  ] = await Promise.all([
    prisma.gradeClassroom.findMany({
      where: { gradeId },
      orderBy: { order: "asc" },
    }),
    prisma.gradeStudent.findMany({
      where: { gradeId },
      orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.gradeItem.findMany({
      where: { gradeId },
      orderBy: { order: "asc" },
    }),
    prisma.gradeConstraint.findMany({
      where: { gradeId },
      orderBy: { order: "asc" },
    }),
    prisma.gradeIndividualReportSettings.findUnique({ where: { gradeId } }),
  ])

  const gradeItemIds = itemRows.map((gradeItem) => gradeItem.id)
  const gradeStudentIds = studentJoinRows.map((gradeStudent) => gradeStudent.id)
  const constraintIds = constraintRows.map((constraint) => constraint.id)

  const [
    dataSourceRows,
    boundaryRows,
    overrideRows,
    frozenScoreRows,
    itemExclusionRows,
    viewpointRows,
    labelValueRows,
    exclusionLabelRows,
  ] = await Promise.all([
    prisma.gradeDataSource.findMany({
      where: { gradeItemId: { in: gradeItemIds } },
      orderBy: { order: "asc" },
    }),
    prisma.gradeItemBoundary.findMany({
      where: { gradeItemId: { in: gradeItemIds } },
      orderBy: { order: "asc" },
    }),
    prisma.gradeOverride.findMany({
      where: { gradeStudentId: { in: gradeStudentIds } },
    }),
    prisma.gradeFrozenScore.findMany({
      where: { gradeStudentId: { in: gradeStudentIds } },
    }),
    prisma.gradeItemExclusion.findMany({
      where: { gradeStudentId: { in: gradeStudentIds } },
    }),
    prisma.gradeConstraintViewpoint.findMany({
      where: { constraintId: { in: constraintIds } },
      orderBy: { order: "asc" },
    }),
    prisma.gradeConstraintLabelValue.findMany({
      where: { constraintId: { in: constraintIds } },
      orderBy: { order: "asc" },
    }),
    prisma.gradeConstraintExclusionLabel.findMany({
      where: { constraintId: { in: constraintIds } },
      orderBy: { order: "asc" },
    }),
  ])

  const dataSourceIds = dataSourceRows.map((dataSource) => dataSource.id)
  const estimationSourceRows =
    await prisma.gradeDataSourceEstimationSource.findMany({
      where: { dataSourceId: { in: dataSourceIds } },
      orderBy: { order: "asc" },
    })

  // ── 成績本体のセクション（行をそのまま持つ） ─────────────────
  const grades: ArchiveGradeRow[] = [
    {
      id: gradeRow.id,
      name: gradeRow.name,
      description: gradeRow.description,
      referenceDate: nullableDateToJson(gradeRow.referenceDate),
      createdAt: dateToJson(gradeRow.createdAt),
      updatedAt: dateToJson(gradeRow.updatedAt),
    },
  ]

  const gradeClassrooms: ArchiveGradeClassroomRow[] = classroomJoinRows.map(
    (gradeClassroom) => ({
      id: gradeClassroom.id,
      gradeId: gradeClassroom.gradeId,
      classroomId: gradeClassroom.classroomId,
      order: gradeClassroom.order,
      createdAt: dateToJson(gradeClassroom.createdAt),
      updatedAt: dateToJson(gradeClassroom.updatedAt),
    })
  )

  const gradeStudents: ArchiveGradeStudentRow[] = studentJoinRows.map(
    (gradeStudent) => ({
      id: gradeStudent.id,
      gradeId: gradeStudent.gradeId,
      studentId: gradeStudent.studentId,
      customOrder: gradeStudent.customOrder,
      createdAt: dateToJson(gradeStudent.createdAt),
      updatedAt: dateToJson(gradeStudent.updatedAt),
    })
  )

  const gradeItems: ArchiveGradeItemRow[] = itemRows.map((gradeItem) => ({
    id: gradeItem.id,
    gradeId: gradeItem.gradeId,
    name: gradeItem.name,
    order: gradeItem.order,
    createdAt: dateToJson(gradeItem.createdAt),
    updatedAt: dateToJson(gradeItem.updatedAt),
  }))

  const gradeDataSources: ArchiveGradeDataSourceRow[] = dataSourceRows.map(
    (dataSource) => ({
      id: dataSource.id,
      gradeItemId: dataSource.gradeItemId,
      type: dataSource.type,
      examId: dataSource.examId,
      subtotalId: dataSource.subtotalId,
      cropRegionId: dataSource.cropRegionId,
      courseworkItemId: dataSource.courseworkItemId,
      courseworkId: dataSource.courseworkId,
      name: dataSource.name,
      weight: decimalToJson(dataSource.weight),
      order: dataSource.order,
      absentMethod: dataSource.absentMethod,
      absentRatio: decimalToJson(dataSource.absentRatio),
      absentOffset: decimalToJson(dataSource.absentOffset),
      treatExpectedAsMissing: dataSource.treatExpectedAsMissing,
      estimationMode: dataSource.estimationMode,
      createdAt: dateToJson(dataSource.createdAt),
      updatedAt: dateToJson(dataSource.updatedAt),
    })
  )

  const gradeDataSourceEstimationSources: ArchiveGradeDataSourceEstimationSourceRow[] =
    estimationSourceRows.map((estimationSource) => ({
      id: estimationSource.id,
      dataSourceId: estimationSource.dataSourceId,
      sourceDataSourceId: estimationSource.sourceDataSourceId,
      order: estimationSource.order,
      createdAt: dateToJson(estimationSource.createdAt),
      updatedAt: dateToJson(estimationSource.updatedAt),
    }))

  const gradeItemBoundaries: ArchiveGradeItemBoundaryRow[] = boundaryRows.map(
    (boundary) => ({
      id: boundary.id,
      gradeItemId: boundary.gradeItemId,
      label: boundary.label,
      minPercentage: decimalToJson(boundary.minPercentage),
      order: boundary.order,
      createdAt: dateToJson(boundary.createdAt),
      updatedAt: dateToJson(boundary.updatedAt),
    })
  )

  const gradeOverrides: ArchiveGradeOverrideRow[] = overrideRows.map(
    (override) => ({
      id: override.id,
      gradeStudentId: override.gradeStudentId,
      gradeItemId: override.gradeItemId,
      overrideLabel: override.overrideLabel,
      createdAt: dateToJson(override.createdAt),
      updatedAt: dateToJson(override.updatedAt),
    })
  )

  const gradeFrozenScores: ArchiveGradeFrozenScoreRow[] = frozenScoreRows.map(
    (frozenScore) => ({
      id: frozenScore.id,
      gradeStudentId: frozenScore.gradeStudentId,
      gradeItemId: frozenScore.gradeItemId,
      weightedScore: nullableDecimalToJson(frozenScore.weightedScore),
      weightedMaxScore: decimalToJson(frozenScore.weightedMaxScore),
      percentage: nullableDecimalToJson(frozenScore.percentage),
      gradeLabel: frozenScore.gradeLabel,
      frozenByUserId: frozenScore.frozenByUserId,
      frozenAt: dateToJson(frozenScore.frozenAt),
      createdAt: dateToJson(frozenScore.createdAt),
      updatedAt: dateToJson(frozenScore.updatedAt),
    })
  )

  const gradeItemExclusions: ArchiveGradeItemExclusionRow[] =
    itemExclusionRows.map((itemExclusion) => ({
      id: itemExclusion.id,
      gradeStudentId: itemExclusion.gradeStudentId,
      gradeItemId: itemExclusion.gradeItemId,
      createdAt: dateToJson(itemExclusion.createdAt),
      updatedAt: dateToJson(itemExclusion.updatedAt),
    }))

  const gradeConstraints: ArchiveGradeConstraintRow[] = constraintRows.map(
    (constraint) => ({
      id: constraint.id,
      gradeId: constraint.gradeId,
      name: constraint.name,
      kind: constraint.kind,
      targetGradeItemId: constraint.targetGradeItemId,
      aggregate: constraint.aggregate,
      tolerance: decimalToJson(constraint.tolerance),
      expression: constraint.expression,
      color: constraint.color,
      message: constraint.message,
      disabledReason: constraint.disabledReason,
      enabled: constraint.enabled,
      order: constraint.order,
      createdAt: dateToJson(constraint.createdAt),
      updatedAt: dateToJson(constraint.updatedAt),
    })
  )

  const gradeConstraintViewpoints: ArchiveGradeConstraintViewpointRow[] =
    viewpointRows.map((viewpoint) => ({
      id: viewpoint.id,
      constraintId: viewpoint.constraintId,
      gradeItemId: viewpoint.gradeItemId,
      order: viewpoint.order,
      createdAt: dateToJson(viewpoint.createdAt),
      updatedAt: dateToJson(viewpoint.updatedAt),
    }))

  const gradeConstraintLabelValues: ArchiveGradeConstraintLabelValueRow[] =
    labelValueRows.map((labelValue) => ({
      id: labelValue.id,
      constraintId: labelValue.constraintId,
      label: labelValue.label,
      value: decimalToJson(labelValue.value),
      order: labelValue.order,
      createdAt: dateToJson(labelValue.createdAt),
      updatedAt: dateToJson(labelValue.updatedAt),
    }))

  const gradeConstraintExclusionLabels: ArchiveGradeConstraintExclusionLabelRow[] =
    exclusionLabelRows.map((exclusionLabel) => ({
      id: exclusionLabel.id,
      constraintId: exclusionLabel.constraintId,
      label: exclusionLabel.label,
      order: exclusionLabel.order,
      createdAt: dateToJson(exclusionLabel.createdAt),
      updatedAt: dateToJson(exclusionLabel.updatedAt),
    }))

  const gradeIndividualReportSettings: ArchiveGradeIndividualReportSettingsRow[] =
    reportSettingsRow
      ? [
          {
            ...reportSettingsRow,
            createdAt: dateToJson(reportSettingsRow.createdAt),
            updatedAt: dateToJson(reportSettingsRow.updatedAt),
          },
        ]
      : []

  // ── 外部参照 ─────────────────────────────────────────────
  const [studentRows, classroomRows] = await Promise.all([
    prisma.student.findMany({
      where: {
        id: {
          in: studentJoinRows.map((gradeStudent) => gradeStudent.studentId),
        },
      },
    }),
    prisma.classroom.findMany({
      where: {
        id: {
          in: classroomJoinRows.map(
            (gradeClassroom) => gradeClassroom.classroomId
          ),
        },
      },
    }),
  ])

  const studentsData: ArchiveCwStudent[] = studentRows.map((student) => ({
    id: student.id,
    studentNumber: student.studentNumber,
    lastName: student.lastName,
    firstName: student.firstName,
    lastNameKana: student.lastNameKana,
    firstNameKana: student.firstNameKana,
    enrollmentYear: student.enrollmentYear,
    updatedAt: dateToJson(student.updatedAt),
  }))

  const classesData: ArchiveCwClass[] = classroomRows.map((classroom) => ({
    id: classroom.id,
    name: classroom.name,
    classroomCode: classroom.classroomCode,
    grade: classroom.grade,
    description: classroom.description,
    isVisible: classroom.isVisible,
  }))

  // 学級所属は「対象生徒 × 登録学級」の範囲だけ carry する。取り込み先で名簿の
  // 学級表示・並びを復元する裏付けになる
  const membershipRows = await prisma.studentClassroomMembership.findMany({
    where: {
      studentId: { in: studentRows.map((student) => student.id) },
      classroomId: { in: classroomRows.map((classroom) => classroom.id) },
    },
  })
  const membershipsData: ArchiveCwMembership[] = membershipRows.map(
    (membership) => ({
      id: membership.id,
      studentId: membership.studentId,
      classroomId: membership.classroomId,
      startDate: dateToJson(membership.startDate),
      endDate: nullableDateToJson(membership.endDate),
      attendanceNumber: membership.attendanceNumber,
      notes: membership.notes,
    })
  )

  // 試験・小計・採点領域はアーカイブに含められない（答案画像を伴う別アーカイブの領分）。
  // uuid が当たらなかったときに名前で当てるための同定情報だけを添える。
  const [examRows, subtotalRows, cropRegionRows] = await Promise.all([
    prisma.exam.findMany({
      where: {
        id: {
          in: [
            ...new Set(
              dataSourceRows
                .map((dataSource) => dataSource.examId)
                .filter((examId): examId is string => examId !== null)
            ),
          ],
        },
      },
    }),
    prisma.subtotal.findMany({
      where: {
        id: {
          in: [
            ...new Set(
              dataSourceRows
                .map((dataSource) => dataSource.subtotalId)
                .filter(
                  (subtotalId): subtotalId is string => subtotalId !== null
                )
            ),
          ],
        },
      },
    }),
    prisma.cropRegion.findMany({
      where: {
        id: {
          in: [
            ...new Set(
              dataSourceRows
                .map((dataSource) => dataSource.cropRegionId)
                .filter(
                  (cropRegionId): cropRegionId is string =>
                    cropRegionId !== null
                )
            ),
          ],
        },
      },
      include: { examPage: true },
    }),
  ])

  const examRefs: ArchiveGradeExamRef[] = examRows.map((exam) => ({
    id: exam.id,
    examName: exam.examName,
    examDate: nullableDateToJson(exam.examDate),
  }))

  // 小計名はグループ内でしか一意でないため、名前で当てるときの絞り込みに試験が要る。
  // 小計は試験ではなく小計グループに属するので、その試験を参照している
  // データソースから逆に辿る
  const examIdBySubtotalId = new Map(
    dataSourceRows
      .filter(
        (dataSource) =>
          dataSource.subtotalId !== null && dataSource.examId !== null
      )
      .map((dataSource) => [dataSource.subtotalId!, dataSource.examId!])
  )
  const subtotalRefs: ArchiveGradeSubtotalRef[] = subtotalRows.flatMap(
    (subtotal) => {
      const examId = examIdBySubtotalId.get(subtotal.id)
      if (!examId) return []
      return [{ id: subtotal.id, examId, name: subtotal.name }]
    }
  )

  const cropRegionRefs: ArchiveGradeCropRegionRef[] = cropRegionRows.map(
    (cropRegion) => ({
      id: cropRegion.id,
      examId: cropRegion.examPage.examId,
      label: cropRegion.label,
    })
  )

  // ── 内包する試験外成績資料（収集は coursework モジュールへ委譲） ──
  const courseworkIds = new Set(
    dataSourceRows.flatMap((dataSource) =>
      dataSource.courseworkId ? [dataSource.courseworkId] : []
    )
  )
  // coursework 型は評価項目を指す。親の資料 id は行に無いので項目から辿る
  const courseworkItemIds = dataSourceRows.flatMap((dataSource) =>
    dataSource.courseworkItemId ? [dataSource.courseworkItemId] : []
  )
  if (courseworkItemIds.length > 0) {
    const referencedItems = await prisma.courseworkItem.findMany({
      where: { id: { in: courseworkItemIds } },
    })
    for (const referencedItem of referencedItems) {
      courseworkIds.add(referencedItem.courseworkId)
    }
  }
  const courseworkArchive = await collectCourseworkArchiveData([
    ...courseworkIds,
  ])

  return {
    grades,
    gradeClassrooms,
    gradeStudents,
    gradeItems,
    gradeDataSources,
    gradeDataSourceEstimationSources,
    gradeItemBoundaries,
    gradeOverrides,
    gradeFrozenScores,
    gradeItemExclusions,
    gradeConstraints,
    gradeConstraintViewpoints,
    gradeConstraintLabelValues,
    gradeConstraintExclusionLabels,
    gradeIndividualReportSettings,
    studentsData,
    classesData,
    membershipsData,
    examRefs,
    subtotalRefs,
    cropRegionRefs,
    courseworkArchive,
    counts: {
      gradeItems: gradeItems.length,
      dataSources: gradeDataSources.length,
      manualScores: courseworkArchive.counts.scores,
      boundaries: gradeItemBoundaries.length,
      classrooms: gradeClassrooms.length,
      students: gradeStudents.length,
    },
  }
}
