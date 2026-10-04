/**
 * 統合アーカイブ（.sao）のテスト用データ
 *
 * 範囲の規則の結合テスト（unifiedArchiveScope.test.ts）と、migration が一部だけの DB でも
 * 全体と同じ結果になるかの回帰テスト用の固定データ（unifiedArchiveBaseline）の両方が使う。
 */

import type { PrismaClient } from "@prisma/client"
import * as crypto from "crypto"

import { createFullTestExam, type FullTestExam } from "./testExamBuilder"

export interface UnifiedArchiveFixture {
  examA: FullTestExam
  examB: FullTestExam
  otherScorer: { id: string }
  otherScoreId: string
  scoreDecisionId: string
  courseworkId: string
  courseworkItemId: string
  gradeId: string
  comparedGradeId: string
  comparisonId: string
  dataSourceIds: string[]
  outsideClassroomId: string
  outsideMembershipId: string
  preferenceIds: { scorer: string; outsider: string }
}

/**
 * 試験A（2人が採点）・試験B（無関係）・資料・成績算出（試験Aと資料を使い、別の成績算出と
 * 比較する）を作る。試験Aの受験生の1人は、試験と関係ない学級にも在籍していたことがある
 */
export async function createUnifiedArchiveFixture(
  prisma: PrismaClient
): Promise<UnifiedArchiveFixture> {
  const examA = await createFullTestExam(prisma, {
    examName: "試験A",
    includeAnnotations: true,
  })
  const examB = await createFullTestExam(prisma, { examName: "試験B" })

  const otherScorer = await prisma.user.create({
    data: { username: `scorer_${crypto.randomUUID()}`, name: "採点者2" },
  })
  const otherScore = await prisma.questionScore.create({
    data: {
      cropRegionId: examA.cropRegions[0].id,
      examStudentId: examA.examStudents[0].id,
      userId: otherScorer.id,
      status: "correct",
    },
  })
  const scoreDecision = await prisma.scoreDecision.create({
    data: {
      cropRegionId: examA.cropRegions[0].id,
      examStudentId: examA.examStudents[0].id,
      verdict: "correct",
      decidedByUserId: otherScorer.id,
    },
  })

  // 試験と関係ない学級（前年度の在籍）
  const outsideClassroom = await prisma.classroom.create({
    data: { name: "前年度の学級" },
  })
  const outsideMembership = await prisma.studentClassroomMembership.create({
    data: {
      studentId: examA.students[0].id,
      classroomId: outsideClassroom.id,
    },
  })

  const coursework = await prisma.coursework.create({
    data: { name: "提出物" },
  })
  const courseworkItem = await prisma.courseworkItem.create({
    data: { courseworkId: coursework.id, name: "レポート", maxScore: 10 },
  })
  await prisma.courseworkStudent.create({
    data: { courseworkId: coursework.id, studentId: examA.students[0].id },
  })

  const comparedGrade = await prisma.grade.create({
    data: { name: "前学期" },
  })
  const comparedGradeItem = await prisma.gradeItem.create({
    data: { gradeId: comparedGrade.id, name: "知識" },
  })
  const grade = await prisma.grade.create({ data: { name: "後学期" } })
  const gradeItem = await prisma.gradeItem.create({
    data: { gradeId: grade.id, name: "知識" },
  })
  const examSource = await prisma.gradeDataSource.create({
    data: {
      gradeItemId: gradeItem.id,
      type: "exam_total",
      name: "試験A",
      weight: 1,
      examId: examA.exam.id,
    },
  })
  const courseworkSource = await prisma.gradeDataSource.create({
    data: {
      gradeItemId: gradeItem.id,
      type: "coursework",
      name: "レポート",
      weight: 1,
      courseworkId: coursework.id,
      courseworkItemId: courseworkItem.id,
    },
  })
  await prisma.gradeStudent.create({
    data: { gradeId: grade.id, studentId: examA.students[0].id },
  })
  const comparison = await prisma.gradeComparison.create({
    data: {
      gradeItemId: gradeItem.id,
      comparedGradeItemId: comparedGradeItem.id,
    },
  })

  const scorerPreference = await prisma.userPreference.create({
    data: { userId: examA.user.id, key: "theme", value: "dark" },
  })
  const outsiderPreference = await prisma.userPreference.create({
    data: { userId: examB.user.id, key: "theme", value: "light" },
  })

  return {
    examA,
    examB,
    otherScorer,
    otherScoreId: otherScore.id,
    scoreDecisionId: scoreDecision.id,
    courseworkId: coursework.id,
    courseworkItemId: courseworkItem.id,
    gradeId: grade.id,
    comparedGradeId: comparedGrade.id,
    comparisonId: comparison.id,
    dataSourceIds: [examSource.id, courseworkSource.id],
    outsideClassroomId: outsideClassroom.id,
    outsideMembershipId: outsideMembership.id,
    preferenceIds: {
      scorer: scorerPreference.id,
      outsider: outsiderPreference.id,
    },
  }
}
