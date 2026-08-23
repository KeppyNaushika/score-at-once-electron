/**
 * 概要ページのその場編集が、実際に DB へ着地することの検査（段階66）。
 *
 * 画面側（`entityOverviewPage.test.tsx`）は「打鍵ごとに書きに行く」ことを固定するが、
 * その先が本当に書けているかは main 側でしか確かめられない。ここで見るのは2つ。
 *
 * 1. **renderer が振った id で作られること。** 作成ダイアログを畳んだ結果、一覧は
 *    `crypto.randomUUID()` で決めた id へ**そのまま `router.push` する**。main が
 *    別の id を振っていたら、作った直後に 404 に落ちる（型検査には掛からない）
 * 2. **名前・日付・説明が1行の更新で書けること。** 概要はこの3つを毎回まとめて
 *    渡すので、片方だけを消す・入れるが両方とも通る必要がある
 */
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../data/test-database.db")

vi.mock("../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import {
  createCoursework,
  updateCoursework,
} from "@/electron-src/lib/prisma/coursework"
import { createExam } from "@/electron-src/lib/prisma/exam"
import { createGrade, updateGrade } from "@/electron-src/lib/prisma/grade"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  createTestUser,
  disconnectTestPrisma,
} from "../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

beforeEach(async () => {
  await cleanupTestDatabase()
})

afterAll(async () => {
  await testPrisma.$disconnect()
  await disconnectTestPrisma()
})

describe("新規作成は renderer が振った id で作る", () => {
  it("資料: 渡した id がそのまま主キーになる", async () => {
    const courseworkId = crypto.randomUUID()

    const created = await createCoursework({
      id: courseworkId,
      name: "新しい資料",
    })

    expect(created.id).toBe(courseworkId)
    const stored = await testPrisma.coursework.findUnique({
      where: { id: courseworkId },
    })
    expect(stored?.name).toBe("新しい資料")
    // 既定値で作る（日付も説明も概要ページで後から入れる）
    expect(stored?.referenceDate).toBeNull()
    expect(stored?.description).toBeNull()
  })

  it("成績算出: 渡した id がそのまま主キーになる", async () => {
    const gradeId = crypto.randomUUID()

    const created = await createGrade({ id: gradeId, name: "新しい成績" })

    expect(created.id).toBe(gradeId)
    const stored = await testPrisma.grade.findUnique({
      where: { id: gradeId },
    })
    expect(stored?.name).toBe("新しい成績")
    expect(stored?.referenceDate).toBeNull()
  })

  it("試験: 渡した id がそのまま主キーになる", async () => {
    const examId = crypto.randomUUID()
    const user = await createTestUser()

    const created = await createExam(
      { id: examId, examName: "新しい試験" },
      user.id
    )

    expect(created.id).toBe(examId)
    const stored = await testPrisma.exam.findUnique({ where: { id: examId } })
    expect(stored?.examName).toBe("新しい試験")
    // 既定値で作る（試験日も説明も概要ページで後から入れる）
    expect(stored?.referenceDate).toBeNull()
    expect(stored?.description).toBeNull()
    // 作った人は必ず OWNER として結び付く（作成直後に自分の試験として開ける）
    const userExams = await testPrisma.userExam.findMany({ where: { examId } })
    expect(userExams.map((userExam) => userExam.role)).toEqual(["OWNER"])
  })

  it("id を渡さない経路（取り込み・テスト）はこれまで通り自動採番", async () => {
    const created = await createCoursework({ name: "採番される資料" })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe("概要ページのその場編集が DB へ着地する", () => {
  it("資料: 名前・実施日・説明をまとめて書ける", async () => {
    const courseworkId = crypto.randomUUID()
    await createCoursework({ id: courseworkId, name: "新しい資料" })

    await updateCoursework(courseworkId, {
      name: "1学期 提出物",
      referenceDate: "2026-05-01",
      description: "毎週の提出物",
    })

    const stored = await testPrisma.coursework.findUnique({
      where: { id: courseworkId },
    })
    expect(stored?.name).toBe("1学期 提出物")
    expect(stored?.description).toBe("毎週の提出物")
    expect(stored?.referenceDate?.toISOString()).toBe(
      new Date("2026-05-01").toISOString()
    )
  })

  it("資料: 日付と説明を空へ戻せる（消したことが書ける）", async () => {
    const courseworkId = crypto.randomUUID()
    await createCoursework({
      id: courseworkId,
      name: "資料",
      referenceDate: "2026-05-01",
      description: "説明",
    })

    await updateCoursework(courseworkId, {
      name: "資料",
      referenceDate: null,
      description: null,
    })

    const stored = await testPrisma.coursework.findUnique({
      where: { id: courseworkId },
    })
    expect(stored?.referenceDate).toBeNull()
    expect(stored?.description).toBeNull()
  })

  it("成績算出: 名前・成績算出日・説明をまとめて書ける", async () => {
    const gradeId = crypto.randomUUID()
    await createGrade({ id: gradeId, name: "新しい成績" })

    await updateGrade(gradeId, {
      name: "1学期末評定",
      referenceDate: "2026-07-20",
      description: "1学期の評定",
    })

    const stored = await testPrisma.grade.findUnique({ where: { id: gradeId } })
    expect(stored?.name).toBe("1学期末評定")
    expect(stored?.description).toBe("1学期の評定")
    expect(stored?.referenceDate?.toISOString()).toBe(
      new Date("2026-07-20").toISOString()
    )
  })
})
