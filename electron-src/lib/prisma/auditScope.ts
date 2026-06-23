/**
 * @fileoverview 監査ログのスコープ・対象ラベル解決ヘルパー
 * @description 計装時に scopeLabel（試験名・成績名等）や対象ラベル（生徒名）を
 *   解決するための軽量クエリ群。失敗時は null を返す（ベストエフォート）。
 */

import prisma from "./client"

/** examId から監査ログ用スコープを解決（試験名スナップショット付き） */
export async function resolveExamScope(
  examId: string
): Promise<{ scopeId: string; scopeLabel: string | null }> {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { examName: true },
    })
    return { scopeId: examId, scopeLabel: exam?.examName ?? null }
  } catch {
    return { scopeId: examId, scopeLabel: null }
  }
}

/** gradeId から監査ログ用スコープを解決（成績名スナップショット付き） */
export async function resolveGradeScope(
  gradeId: string
): Promise<{ scopeId: string; scopeLabel: string | null }> {
  try {
    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      select: { name: true },
    })
    return { scopeId: gradeId, scopeLabel: grade?.name ?? null }
  } catch {
    return { scopeId: gradeId, scopeLabel: null }
  }
}

/** courseworkId から監査ログ用スコープを解決（資料名スナップショット付き） */
export async function resolveCourseworkScope(
  courseworkId: string
): Promise<{ scopeId: string; scopeLabel: string | null }> {
  try {
    const cw = await prisma.coursework.findUnique({
      where: { id: courseworkId },
      select: { name: true },
    })
    return { scopeId: courseworkId, scopeLabel: cw?.name ?? null }
  } catch {
    return { scopeId: courseworkId, scopeLabel: null }
  }
}

/** courseworkItemId から資料スコープを解決 */
export async function resolveCourseworkScopeByItem(
  courseworkItemId: string
): Promise<{ scopeId: string | null; scopeLabel: string | null }> {
  try {
    const item = await prisma.courseworkItem.findUnique({
      where: { id: courseworkItemId },
      select: {
        courseworkId: true,
        coursework: { select: { name: true } },
      },
    })
    return {
      scopeId: item?.courseworkId ?? null,
      scopeLabel: item?.coursework?.name ?? null,
    }
  } catch {
    return { scopeId: null, scopeLabel: null }
  }
}

/** gradeItemId から成績スコープを解決 */
export async function resolveGradeScopeByItem(
  gradeItemId: string
): Promise<{ scopeId: string | null; scopeLabel: string | null }> {
  try {
    const item = await prisma.gradeItem.findUnique({
      where: { id: gradeItemId },
      select: { gradeId: true, grade: { select: { name: true } } },
    })
    return {
      scopeId: item?.gradeId ?? null,
      scopeLabel: item?.grade?.name ?? null,
    }
  } catch {
    return { scopeId: null, scopeLabel: null }
  }
}

/** gradeDataSourceId から成績スコープを解決 */
export async function resolveGradeScopeByDataSource(
  dataSourceId: string
): Promise<{ scopeId: string | null; scopeLabel: string | null }> {
  try {
    const ds = await prisma.gradeDataSource.findUnique({
      where: { id: dataSourceId },
      select: {
        gradeItem: {
          select: { gradeId: true, grade: { select: { name: true } } },
        },
      },
    })
    return {
      scopeId: ds?.gradeItem.gradeId ?? null,
      scopeLabel: ds?.gradeItem.grade?.name ?? null,
    }
  } catch {
    return { scopeId: null, scopeLabel: null }
  }
}

/** examPageId から試験スコープを解決 */
export async function resolveExamScopeByPage(
  examPageId: string
): Promise<{ scopeId: string | null; scopeLabel: string | null }> {
  try {
    const page = await prisma.examPage.findUnique({
      where: { id: examPageId },
      select: { examId: true, exam: { select: { examName: true } } },
    })
    return {
      scopeId: page?.examId ?? null,
      scopeLabel: page?.exam?.examName ?? null,
    }
  } catch {
    return { scopeId: null, scopeLabel: null }
  }
}

/** cropRegionId から試験スコープを解決 */
export async function resolveExamScopeByCropRegion(
  cropRegionId: string
): Promise<{ scopeId: string | null; scopeLabel: string | null }> {
  try {
    const region = await prisma.cropRegion.findUnique({
      where: { id: cropRegionId },
      select: {
        examPage: {
          select: { examId: true, exam: { select: { examName: true } } },
        },
      },
    })
    const examId = region?.examPage.examId ?? null
    return {
      scopeId: examId,
      scopeLabel: region?.examPage.exam?.examName ?? null,
    }
  } catch {
    return { scopeId: null, scopeLabel: null }
  }
}

/** questionScoreId から試験スコープを解決（採点マーク用） */
export async function resolveExamScopeByQuestionScore(
  questionScoreId: string
): Promise<{ scopeId: string | null; scopeLabel: string | null }> {
  try {
    const qs = await prisma.questionScore.findUnique({
      where: { id: questionScoreId },
      select: {
        cropRegion: {
          select: {
            examPage: {
              select: {
                examId: true,
                exam: { select: { examName: true } },
              },
            },
          },
        },
      },
    })
    const examId = qs?.cropRegion.examPage.examId ?? null
    return {
      scopeId: examId,
      scopeLabel: qs?.cropRegion.examPage.exam?.examName ?? null,
    }
  } catch {
    return { scopeId: null, scopeLabel: null }
  }
}

/** studentId から「姓 名」ラベルを解決 */
export async function resolveStudentLabel(
  studentId: string
): Promise<string | null> {
  try {
    const s = await prisma.student.findUnique({
      where: { id: studentId },
      select: { lastName: true, firstName: true },
    })
    if (!s) return null
    return `${s.lastName} ${s.firstName}`.trim()
  } catch {
    return null
  }
}

/** userId から表示名を解決 */
export async function resolveUserLabel(userId: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })
    return u?.name ?? null
  } catch {
    return null
  }
}
