/**
 * 成績から生徒を外すとセル3種も消えることの統合テスト（#962 Phase C）。
 *
 * 配線変更前、上書き・確定値・除外設定は (gradeId, studentId) の2列で人を直に指しており、
 * GradeStudent を参照する子テーブルが1つも無かった。そのため学級ごと外しても設定は残り、
 * 同じ生徒を再び追加した瞬間に過去の設定が甦っていた。特に確定（凍結）した成績値が
 * 教員の知らないうちに復活するのは実害が大きい。
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import {
  addStudentsFromClassroomToGrade,
  removeClassroomFromGrade,
} from "@/electron-src/lib/prisma/gradeStudent"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

interface Fixture {
  gradeId: string
  gradeItemId: string
  classroomId: string
  /** 学級を外すと一緒に消える生徒（その学級にしか所属しない） */
  removedStudentId: string
  removedGradeStudentId: string
  /** 別の学級にも所属していて残る生徒 */
  keptStudentId: string
  keptGradeStudentId: string
}

/**
 * 生徒2名・評価項目1つの成績を作り、両名にセル3種（上書き・確定値・除外設定）を付ける。
 * removed 側はこの学級にのみ所属し、kept 側は別学級にも所属する（＝専属でないので残る）。
 */
async function buildFixture(): Promise<Fixture> {
  const suffix = Date.now()
  const classroom = await testPrisma.classroom.create({
    data: { name: `3年A組_${suffix}` },
  })
  const otherClassroom = await testPrisma.classroom.create({
    data: { name: `3年B組_${suffix}` },
  })

  const createStudent = async (studentNumber: string, classroomIds: string[]) =>
    testPrisma.student.create({
      data: {
        studentNumber,
        lastName: "山田",
        firstName: "太郎",
        lastNameKana: "ヤマダ",
        firstNameKana: "タロウ",
        memberships: {
          create: classroomIds.map((classroomId) => ({ classroomId })),
        },
      },
    })

  const removedStudent = await createStudent(`SR${suffix}`, [classroom.id])
  const keptStudent = await createStudent(`SK${suffix}`, [
    classroom.id,
    otherClassroom.id,
  ])

  const grade = await testPrisma.grade.create({ data: { name: "1学期成績" } })
  await testPrisma.gradeClassroom.createMany({
    data: [
      { gradeId: grade.id, classroomId: classroom.id, order: 0 },
      { gradeId: grade.id, classroomId: otherClassroom.id, order: 1 },
    ],
  })
  const gradeItem = await testPrisma.gradeItem.create({
    data: { gradeId: grade.id, name: "知識・技能", order: 0 },
  })

  const gradeStudents = new Map<string, string>()
  for (const student of [removedStudent, keptStudent]) {
    const gradeStudent = await testPrisma.gradeStudent.create({
      data: { gradeId: grade.id, studentId: student.id },
    })
    gradeStudents.set(student.id, gradeStudent.id)

    await testPrisma.gradeOverride.create({
      data: {
        gradeStudentId: gradeStudent.id,
        gradeItemId: gradeItem.id,
        overrideLabel: "A",
      },
    })
    await testPrisma.gradeFrozenScore.create({
      data: {
        gradeStudentId: gradeStudent.id,
        gradeItemId: gradeItem.id,
        weightedScore: 0.8,
        weightedMaxScore: 1,
        percentage: 80,
        gradeLabel: "A",
      },
    })
    await testPrisma.gradeItemExclusion.create({
      data: { gradeStudentId: gradeStudent.id, gradeItemId: gradeItem.id },
    })
  }

  return {
    gradeId: grade.id,
    gradeItemId: gradeItem.id,
    classroomId: classroom.id,
    removedStudentId: removedStudent.id,
    removedGradeStudentId: gradeStudents.get(removedStudent.id)!,
    keptStudentId: keptStudent.id,
    keptGradeStudentId: gradeStudents.get(keptStudent.id)!,
  }
}

/** その対象者に紐づくセル3種の件数 */
async function countCells(gradeStudentId: string) {
  const [overrides, frozenScores, itemExclusions] = await Promise.all([
    testPrisma.gradeOverride.count({ where: { gradeStudentId } }),
    testPrisma.gradeFrozenScore.count({ where: { gradeStudentId } }),
    testPrisma.gradeItemExclusion.count({ where: { gradeStudentId } }),
  ])
  return { overrides, frozenScores, itemExclusions }
}

describe("成績から生徒を外したときのセルの削除", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("学級ごと外すと、その生徒の上書き・確定値・除外設定が全て消える", async () => {
    const fixture = await buildFixture()

    await removeClassroomFromGrade(fixture.gradeId, fixture.classroomId, true)

    expect(await countCells(fixture.removedGradeStudentId)).toEqual({
      overrides: 0,
      frozenScores: 0,
      itemExclusions: 0,
    })
  })

  it("他の生徒のセルは巻き添えにならない", async () => {
    const fixture = await buildFixture()

    await removeClassroomFromGrade(fixture.gradeId, fixture.classroomId, true)

    // kept は別学級にも所属するため専属ではなく、対象者として残る
    expect(await countCells(fixture.keptGradeStudentId)).toEqual({
      overrides: 1,
      frozenScores: 1,
      itemExclusions: 1,
    })
  })

  it("外した生徒を再び追加しても、以前の確定値・上書き・除外は復元されない", async () => {
    const fixture = await buildFixture()

    await removeClassroomFromGrade(fixture.gradeId, fixture.classroomId, true)
    await addStudentsFromClassroomToGrade(fixture.gradeId, fixture.classroomId)

    const readded = await testPrisma.gradeStudent.findFirstOrThrow({
      where: { gradeId: fixture.gradeId, studentId: fixture.removedStudentId },
    })
    // 再追加された対象者は別の行（id が違う）で、セルは付いていない
    expect(readded.id).not.toBe(fixture.removedGradeStudentId)
    expect(await countCells(readded.id)).toEqual({
      overrides: 0,
      frozenScores: 0,
      itemExclusions: 0,
    })
  })
})
