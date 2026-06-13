/**
 * GradeStudent / GradeClass のPrisma操作関数
 */

import prisma from "./client"

/** 基準日時点で有効なmembershipの条件（endDateがnull、または基準日以降） */
function membershipFilterAt(referenceDate?: Date | null) {
  const date = referenceDate ?? new Date()
  return {
    OR: [{ endDate: null }, { endDate: { gte: date } }],
  }
}

/** GradeのreferenceDateを取得 */
async function getExamReferenceDate(gradeId: string): Promise<Date | null> {
  const gp = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: { referenceDate: true },
  })
  return gp?.referenceDate ?? null
}

/**
 * 成績算出試験の対象生徒一覧を取得
 */
export async function getStudentsByGradeId(gradeId: string) {
  try {
    const students = await prisma.gradeStudent.findMany({
      where: { gradeId },
      include: {
        student: {
          include: {
            memberships: {
              include: { class: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
    })
    return { success: true, students }
  } catch (error) {
    console.error("Error getting grade exam students:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績算出試験の登録学級一覧を取得
 */
export async function getGradeClasses(gradeId: string) {
  try {
    const referenceDate = await getExamReferenceDate(gradeId)
    const classes = await prisma.gradeClass.findMany({
      where: { gradeId },
      include: {
        class: {
          include: {
            memberships: {
              where: membershipFilterAt(referenceDate),
              select: { studentId: true },
            },
          },
        },
      },
      orderBy: { order: "asc" },
    })
    return {
      success: true,
      classes: classes.map((c) => ({
        id: c.id,
        classId: c.classId,
        className: c.class.name,
        order: c.order,
        studentCount: c.class.memberships.length,
      })),
    }
  } catch (error) {
    console.error("Error getting grade exam classes:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * まだ登録されていない学級一覧を取得
 *
 * @param activeOnly trueなら基準日時点で在籍中の生徒のみを数える（既定）。
 *   falseなら在籍期間に関わらず学級に在籍歴のある全生徒を数える。
 *   いずれの場合も、対象生徒が0名の学級は候補から除外する。
 */
export async function getAvailableClassesForGrade(
  gradeId: string,
  activeOnly = true
) {
  try {
    const referenceDate = await getExamReferenceDate(gradeId)
    const existing = await prisma.gradeClass.findMany({
      where: { gradeId },
      select: { classId: true },
    })
    const existingIds = existing.map((e) => e.classId)

    const classes = await prisma.class.findMany({
      where: {
        id: existingIds.length > 0 ? { notIn: existingIds } : undefined,
      },
      include: {
        memberships: {
          where: activeOnly ? membershipFilterAt(referenceDate) : undefined,
          select: { studentId: true },
        },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    })

    return {
      success: true,
      classes: classes
        .map((c) => ({
          id: c.id,
          name: c.name,
          // 同一生徒の複数在籍歴を重複カウントしないようdistinct
          studentCount: new Set(c.memberships.map((m) => m.studentId)).size,
        }))
        // 対象生徒が0名の学級は非表示（activeOnlyスイッチの状態に連動）
        .filter((c) => c.studentCount > 0),
    }
  } catch (error) {
    console.error("Error getting available classes:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 学級から生徒を一括追加
 *
 * @param activeOnly trueなら基準日時点で在籍中の生徒のみ追加する（既定）。
 *   falseなら在籍期間に関わらず学級に在籍歴のある全生徒を追加する。
 */
export async function addStudentsFromClassToGrade(
  gradeId: string,
  classId: string,
  activeOnly = true
) {
  try {
    const referenceDate = await getExamReferenceDate(gradeId)

    // 1. 現在の最大order取得
    const maxOrderResult = await prisma.gradeClass.aggregate({
      where: { gradeId },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    // 2. GradeClass作成
    await prisma.gradeClass.upsert({
      where: {
        gradeId_classId: { gradeId, classId },
      },
      create: { gradeId, classId, order: nextOrder },
      update: {},
    })

    // 3. 対象生徒を出席番号順で取得（activeOnlyなら基準日時点で在籍中のみ）
    const memberships = await prisma.studentClassMembership.findMany({
      where: {
        classId,
        ...(activeOnly ? membershipFilterAt(referenceDate) : {}),
      },
      orderBy: [
        { attendanceNumber: "asc" },
        { student: { studentNumber: "asc" } },
      ],
      include: { student: true },
    })

    // 4. 既存の GradeStudent を取得
    const existing = await prisma.gradeStudent.findMany({
      where: { gradeId },
      select: { studentId: true, customOrder: true },
    })
    const existingIds = new Set(existing.map((e) => e.studentId))
    const maxCustomOrder = existing.reduce(
      (max, e) => Math.max(max, e.customOrder ?? 0),
      0
    )

    // 5. 新規生徒を追加
    const toAdd: { studentId: string; customOrder: number }[] = []
    let orderOffset = maxCustomOrder + 1

    for (const m of memberships) {
      if (!existingIds.has(m.studentId)) {
        toAdd.push({ studentId: m.studentId, customOrder: orderOffset++ })
        existingIds.add(m.studentId)
      }
    }

    if (toAdd.length > 0) {
      await prisma.gradeStudent.createMany({
        data: toAdd.map(({ studentId, customOrder }) => ({
          gradeId,
          studentId,
          customOrder,
        })),
      })
    }

    return {
      success: true,
      added: toAdd.length,
      skipped: memberships.length - toAdd.length,
    }
  } catch (error) {
    console.error("Error adding students from class:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 生徒の並び順を更新
 */
export async function updateGradeStudentOrders(
  gradeId: string,
  studentOrders: { studentId: string; customOrder: number }[]
) {
  try {
    for (const { studentId, customOrder } of studentOrders) {
      await prisma.gradeStudent.updateMany({
        where: { gradeId, studentId },
        data: { customOrder },
      })
    }
    return { success: true }
  } catch (error) {
    console.error("Error updating grade exam student orders:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 学級を削除（その学級由来の生徒も削除）
 */
export async function removeClassFromGrade(gradeId: string, classId: string) {
  try {
    // 学級の生徒IDを取得
    const memberships = await prisma.studentClassMembership.findMany({
      where: { classId },
      select: { studentId: true },
    })
    const classStudentIds = memberships.map((m) => m.studentId)

    // 他の学級にも属している生徒は残す
    const otherClasses = await prisma.gradeClass.findMany({
      where: { gradeId, classId: { not: classId } },
      select: { classId: true },
    })
    const otherClassIds = otherClasses.map((c) => c.classId)
    const otherMemberships = await prisma.studentClassMembership.findMany({
      where: { classId: { in: otherClassIds } },
      select: { studentId: true },
    })
    const otherStudentIds = new Set(otherMemberships.map((m) => m.studentId))

    const studentsToRemove = classStudentIds.filter(
      (id) => !otherStudentIds.has(id)
    )

    // トランザクションで削除
    await prisma.$transaction([
      prisma.gradeStudent.deleteMany({
        where: {
          gradeId,
          studentId: { in: studentsToRemove },
        },
      }),
      prisma.gradeClass.delete({
        where: { gradeId_classId: { gradeId, classId } },
      }),
    ])

    return { success: true, removedStudents: studentsToRemove.length }
  } catch (error) {
    console.error("Error removing class from grade exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
