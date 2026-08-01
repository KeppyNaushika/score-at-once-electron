/**
 * 成績値の確定（凍結）の統合テスト
 *
 * 守りたい不変条件は「一度確定した成績値は、あとから参照資料や境界を変えても動かない」。
 * 確定は評価フロー（自動算出 → 手動上書きで調整 → その実効値で固定）を写したものなので、
 * 「上書き後の値が取り込まれること」と「確定値が上書きより優先されること」も併せて固定する。
 *
 * DataSource は coursework 型を使う（CourseworkScore を1行 update するだけで
 * 元資料の変更を再現でき、試験・採点領域の一式を組まずに済むため）。
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
  freezeGradeScores,
  unfreezeGradeScores,
} from "@/electron-src/lib/prisma/gradeFrozenScore"
import { calculateGrades } from "@/electron-src/lib/shared/calculations/gradeCalculator"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

interface Fixture {
  gradeId: string
  gradeItemId: string
  studentId: string
  /** 成績の対象者。上書き・確定値・除外設定の書き込み先はこちら（人の id ではない） */
  gradeStudentId: string
  courseworkItemId: string
}

/**
 * 生徒1名・評価項目1つ・coursework データソース1本の最小構成を作る。
 * 素点 80 / 満点 100 で、境界は A≧80 / B≧60 / C≧0。
 */
async function buildFixture(): Promise<Fixture> {
  const student = await testPrisma.student.create({
    data: {
      studentNumber: "S001",
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
    },
  })

  const coursework = await testPrisma.coursework.create({
    data: { name: "第1回レポート" },
  })
  const courseworkItem = await testPrisma.courseworkItem.create({
    data: {
      courseworkId: coursework.id,
      name: "提出物",
      maxScore: 100,
      inputMode: "numeric",
      order: 0,
    },
  })
  const courseworkStudent = await testPrisma.courseworkStudent.create({
    data: { courseworkId: coursework.id, studentId: student.id },
  })
  await testPrisma.courseworkScore.create({
    data: {
      courseworkItemId: courseworkItem.id,
      courseworkStudentId: courseworkStudent.id,
      score: 80,
    },
  })

  const grade = await testPrisma.grade.create({ data: { name: "1学期成績" } })
  const gradeStudent = await testPrisma.gradeStudent.create({
    data: { gradeId: grade.id, studentId: student.id },
  })
  const gradeItem = await testPrisma.gradeItem.create({
    data: { gradeId: grade.id, name: "知識・技能", order: 0 },
  })
  await testPrisma.gradeDataSource.create({
    data: {
      gradeItemId: gradeItem.id,
      type: "coursework",
      courseworkItemId: courseworkItem.id,
      name: "提出物",
      weight: 1,
      order: 0,
    },
  })

  await testPrisma.gradeItemBoundary.createMany({
    data: [
      {
        gradeItemId: gradeItem.id,
        label: "A",
        minPercentage: 80,
        order: 0,
      },
      {
        gradeItemId: gradeItem.id,
        label: "B",
        minPercentage: 60,
        order: 1,
      },
      {
        gradeItemId: gradeItem.id,
        label: "C",
        minPercentage: 0,
        order: 2,
      },
    ],
  })

  return {
    gradeId: grade.id,
    gradeItemId: gradeItem.id,
    studentId: student.id,
    gradeStudentId: gradeStudent.id,
    courseworkItemId: courseworkItem.id,
  }
}

/** 対象セル（生徒1名・評価項目1つ）の結果を取り出す */
async function readCell(gradeId: string) {
  const calculation = await calculateGrades(gradeId)
  expect(calculation.success).toBe(true)
  const itemResult = calculation.result!.students[0].gradeItemResults[0]
  return itemResult
}

/** 元資料（coursework の点数）を書き換える＝確定後に資料が変わった状況の再現 */
async function updateSourceScore(
  fixture: Fixture,
  score: number
): Promise<void> {
  await testPrisma.courseworkScore.updateMany({
    where: {
      courseworkItemId: fixture.courseworkItemId,
      courseworkStudent: { studentId: fixture.studentId },
    },
    data: { score },
  })
}

describe("成績値の確定（凍結）", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("確定後に元資料を変えても成績値が動かない（機能の核）", async () => {
    const fixture = await buildFixture()

    const before = await readCell(fixture.gradeId)
    expect(before.percentage).toBe(80)
    expect(before.gradeLabel).toBe("A")
    expect(before.frozen).toBeNull()

    const frozen = await freezeGradeScores({ gradeId: fixture.gradeId })
    expect(frozen.success).toBe(true)
    expect(frozen.frozenCount).toBe(1)

    // 元資料を 80 → 30 に変更。確定していなければ 30% C に落ちる変更。
    await updateSourceScore(fixture, 30)

    const after = await readCell(fixture.gradeId)
    expect(after.percentage).toBe(80)
    expect(after.gradeLabel).toBe("A")
    expect(after.frozen).not.toBeNull()
    // 確定値は固定のまま、ライブ値は追従している
    expect(after.frozen!.livePercentage).toBe(30)
    expect(after.frozen!.liveGradeLabel).toBe("C")
  })

  it("確定後に元資料が変わると stale になり、変わらなければ stale にならない", async () => {
    const fixture = await buildFixture()
    await freezeGradeScores({ gradeId: fixture.gradeId })

    const unchanged = await readCell(fixture.gradeId)
    expect(unchanged.frozen!.isStale).toBe(false)

    await updateSourceScore(fixture, 30)

    const changed = await readCell(fixture.gradeId)
    expect(changed.frozen!.isStale).toBe(true)
  })

  it("確定後に境界を変えても確定値のラベルは動かない", async () => {
    const fixture = await buildFixture()
    await freezeGradeScores({ gradeId: fixture.gradeId })

    // A の閾値を 80 → 90 に上げる。確定していなければ 80% は B に落ちる。
    await testPrisma.gradeItemBoundary.updateMany({
      where: { label: "A" },
      data: { minPercentage: 90 },
    })

    const after = await readCell(fixture.gradeId)
    expect(after.gradeLabel).toBe("A")
    expect(after.frozen!.liveGradeLabel).toBe("B")
    expect(after.frozen!.isStale).toBe(true)
  })

  it("確定は手動上書きを適用した後の実効値を取り込む", async () => {
    const fixture = await buildFixture()

    // 自動算出は A。教員が B へ調整してから確定する。
    await testPrisma.gradeOverride.create({
      data: {
        gradeStudentId: fixture.gradeStudentId,
        gradeItemId: fixture.gradeItemId,
        overrideLabel: "B",
      },
    })

    await freezeGradeScores({ gradeId: fixture.gradeId })

    const stored = await testPrisma.gradeFrozenScore.findFirstOrThrow({
      where: { gradeStudent: { gradeId: fixture.gradeId } },
    })
    expect(stored.gradeLabel).toBe("B")

    const cell = await readCell(fixture.gradeId)
    expect(cell.gradeLabel).toBe("B")
    expect(cell.originalGradeLabel).toBe("A")
  })

  it("確定値は手動上書きより優先される", async () => {
    const fixture = await buildFixture()
    await freezeGradeScores({ gradeId: fixture.gradeId })

    // 確定後に上書きを足しても、確定値（A）が採用され続ける
    await testPrisma.gradeOverride.create({
      data: {
        gradeStudentId: fixture.gradeStudentId,
        gradeItemId: fixture.gradeItemId,
        overrideLabel: "C",
      },
    })

    const cell = await readCell(fixture.gradeId)
    expect(cell.gradeLabel).toBe("A")
    expect(cell.overrideGradeLabel).toBe("C")
    expect(cell.frozen!.liveGradeLabel).toBe("C")
  })

  it("再確定すると現在のライブ値を取り込み直す", async () => {
    const fixture = await buildFixture()
    await freezeGradeScores({ gradeId: fixture.gradeId })
    await updateSourceScore(fixture, 30)

    await freezeGradeScores({
      gradeId: fixture.gradeId,
      targets: [
        {
          gradeStudentId: fixture.gradeStudentId,
          gradeItemId: fixture.gradeItemId,
        },
      ],
    })

    const cell = await readCell(fixture.gradeId)
    expect(cell.percentage).toBe(30)
    expect(cell.gradeLabel).toBe("C")
    expect(cell.frozen!.isStale).toBe(false)
    // 再確定は上書きではなく削除→再作成だが、1セル1行のままであること
    const rows = await testPrisma.gradeFrozenScore.findMany({
      where: { gradeStudent: { gradeId: fixture.gradeId } },
    })
    expect(rows).toHaveLength(1)
  })

  it("確定を解除するとリアルタイム算出値に戻る", async () => {
    const fixture = await buildFixture()
    await freezeGradeScores({ gradeId: fixture.gradeId })
    await updateSourceScore(fixture, 30)

    const unfrozen = await unfreezeGradeScores({ gradeId: fixture.gradeId })
    expect(unfrozen.success).toBe(true)
    expect(unfrozen.unfrozenCount).toBe(1)

    const cell = await readCell(fixture.gradeId)
    expect(cell.percentage).toBe(30)
    expect(cell.gradeLabel).toBe("C")
    expect(cell.frozen).toBeNull()
  })

  it("除外セルは確定対象にならない", async () => {
    const fixture = await buildFixture()
    await testPrisma.gradeItemExclusion.create({
      data: {
        gradeStudentId: fixture.gradeStudentId,
        gradeItemId: fixture.gradeItemId,
      },
    })

    const result = await freezeGradeScores({ gradeId: fixture.gradeId })
    expect(result.success).toBe(true)
    expect(result.frozenCount).toBe(0)

    const cell = await readCell(fixture.gradeId)
    expect(cell.isExcluded).toBe(true)
    expect(cell.frozen).toBeNull()
  })

  it("確定→除外→再確定 で古い確定行が残らない（除外解除で過去の値が甦らない）", async () => {
    const fixture = await buildFixture()
    await freezeGradeScores({ gradeId: fixture.gradeId })

    // 確定後にこの生徒をこの評価項目から除外し、資料も変えたうえで再確定する
    await testPrisma.gradeItemExclusion.create({
      data: {
        gradeStudentId: fixture.gradeStudentId,
        gradeItemId: fixture.gradeItemId,
      },
    })
    await updateSourceScore(fixture, 30)
    await freezeGradeScores({ gradeId: fixture.gradeId })

    // 除外セルは確定対象外なので、確定行は残っていてはならない
    expect(
      await testPrisma.gradeFrozenScore.findMany({
        where: { gradeStudent: { gradeId: fixture.gradeId } },
      })
    ).toHaveLength(0)

    // 除外を解除すると、古い確定値（80% A）ではなく現在値（30% C）が出る
    await testPrisma.gradeItemExclusion.deleteMany({
      where: { gradeStudent: { gradeId: fixture.gradeId } },
    })
    const cell = await readCell(fixture.gradeId)
    expect(cell.frozen).toBeNull()
    expect(cell.percentage).toBe(30)
    expect(cell.gradeLabel).toBe("C")
  })

  it("Grade を削除すると確定行もカスケード削除される", async () => {
    const fixture = await buildFixture()
    await freezeGradeScores({ gradeId: fixture.gradeId })

    await testPrisma.grade.delete({ where: { id: fixture.gradeId } })

    const rows = await testPrisma.gradeFrozenScore.findMany({
      where: { gradeStudent: { gradeId: fixture.gradeId } },
    })
    expect(rows).toHaveLength(0)
  })
})
