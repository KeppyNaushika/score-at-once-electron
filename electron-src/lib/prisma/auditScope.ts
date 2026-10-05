/**
 * @fileoverview 監査ログのスコープ・対象ラベル解決ヘルパー
 * @description 計装時に scopeLabel（試験名・成績名等）や対象ラベル（生徒名）を
 *   解決するための軽量クエリ群。失敗時は null を返す（ベストエフォート）。
 */

import type { AuditTargetInput } from "./auditLog"
import { cropRegionAuditTarget, studentAuditTarget } from "./auditTargets"
import prisma from "./client"

/** examId から監査ログ用スコープを解決（試験名スナップショット付き） */
export async function resolveExamScope(
  examId: string
): Promise<{ scopeId: string; scopeLabel: string | null }> {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
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
      include: { coursework: true },
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
      include: { grade: true },
    })
    return {
      scopeId: item?.gradeId ?? null,
      scopeLabel: item?.grade?.name ?? null,
    }
  } catch {
    return { scopeId: null, scopeLabel: null }
  }
}

/** 解答用紙定義の id から監査ログ用スコープを解決（定義名スナップショット付き） */
export async function resolveAnswerSheetScope(
  definitionId: string
): Promise<{ scopeId: string; scopeLabel: string | null }> {
  try {
    const definition = await prisma.asbDefinition.findUnique({
      where: { id: definitionId },
    })
    return { scopeId: definitionId, scopeLabel: definition?.name ?? null }
  } catch {
    return { scopeId: definitionId, scopeLabel: null }
  }
}

/** examPageId から試験スコープを解決 */
export async function resolveExamScopeByPage(
  examPageId: string
): Promise<{ scopeId: string | null; scopeLabel: string | null }> {
  try {
    const page = await prisma.examPage.findUnique({
      where: { id: examPageId },
      include: { exam: true },
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
      include: { examPage: { include: { exam: true } } },
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
    const questionScore = await prisma.questionScore.findUnique({
      where: { id: questionScoreId },
      include: {
        cropRegion: { include: { examPage: { include: { exam: true } } } },
      },
    })
    const examId = questionScore?.cropRegion.examPage.examId ?? null
    return {
      scopeId: examId,
      scopeLabel: questionScore?.cropRegion.examPage.exam?.examName ?? null,
    }
  } catch {
    return { scopeId: null, scopeLabel: null }
  }
}

/**
 * 採点領域の id から、監査ログの対象（採点領域）を解決する。手元に行が無い経路のためのもの。
 * 見つからなければ空（ベストエフォート）
 */
export async function resolveCropRegionTargets(
  cropRegionId: string
): Promise<AuditTargetInput[]> {
  try {
    const cropRegion = await prisma.cropRegion.findUnique({
      where: { id: cropRegionId },
    })
    return cropRegion ? [cropRegionAuditTarget(cropRegion)] : []
  } catch {
    return []
  }
}

/** 生徒の id から、監査ログの対象（生徒）を解決する。見つからない生徒は入れない */
export async function resolveStudentTargets(
  studentIds: string[]
): Promise<AuditTargetInput[]> {
  if (studentIds.length === 0) return []
  try {
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
    })
    return students.map(studentAuditTarget)
  } catch {
    return []
  }
}

/** 受験者（ExamStudent）の id から、監査ログの対象（生徒）を解決する */
export async function resolveExamStudentTargets(
  examStudentIds: string[]
): Promise<AuditTargetInput[]> {
  if (examStudentIds.length === 0) return []
  try {
    const examStudents = await prisma.examStudent.findMany({
      where: { id: { in: examStudentIds } },
      include: { student: true },
    })
    return examStudents.map((examStudent) =>
      studentAuditTarget(examStudent.student)
    )
  } catch {
    return []
  }
}

/** 成績算出の対象者（GradeStudent）の id から、監査ログの対象（生徒）を解決する */
export async function resolveGradeStudentTargets(
  gradeStudentIds: string[]
): Promise<AuditTargetInput[]> {
  if (gradeStudentIds.length === 0) return []
  try {
    const gradeStudents = await prisma.gradeStudent.findMany({
      where: { id: { in: gradeStudentIds } },
      include: { student: true },
    })
    return gradeStudents.map((gradeStudent) =>
      studentAuditTarget(gradeStudent.student)
    )
  } catch {
    return []
  }
}

/** 資料の対象者（CourseworkStudent）の id から、監査ログの対象（生徒）を解決する */
export async function resolveCourseworkStudentTargets(
  courseworkStudentIds: string[]
): Promise<AuditTargetInput[]> {
  if (courseworkStudentIds.length === 0) return []
  try {
    const courseworkStudents = await prisma.courseworkStudent.findMany({
      where: { id: { in: courseworkStudentIds } },
      include: { student: true },
    })
    return courseworkStudents.map((courseworkStudent) =>
      studentAuditTarget(courseworkStudent.student)
    )
  } catch {
    return []
  }
}

/**
 * 採点のマス（受験者 × 採点領域）から、監査ログの対象（生徒・採点領域）を解決する。
 *
 * 書き込みの `include` に生徒と採点領域が無い経路（確定など）のためのもの。手元に
 * 行があるなら `auditTargets.ts` の関数で直接組み立て、ここで取り直さないこと。
 * 見つからないものは対象に入れない（ベストエフォート）。
 */
export async function resolveScoreCellTargets(
  cropRegionId: string,
  examStudentId: string
): Promise<AuditTargetInput[]> {
  try {
    const [examStudent, cropRegion] = await Promise.all([
      prisma.examStudent.findUnique({
        where: { id: examStudentId },
        include: { student: true },
      }),
      prisma.cropRegion.findUnique({ where: { id: cropRegionId } }),
    ])
    return [
      ...(examStudent ? [studentAuditTarget(examStudent.student)] : []),
      ...(cropRegion ? [cropRegionAuditTarget(cropRegion)] : []),
    ]
  } catch {
    return []
  }
}

/** userId から表示名を解決 */
export async function resolveUserLabel(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })
    return user?.name ?? null
  } catch {
    return null
  }
}
