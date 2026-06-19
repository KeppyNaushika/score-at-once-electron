/**
 * ReturnSnapshot（答案返却版スナップショット）統合テスト
 *
 * captureReturnSnapshot / getReturnDiff の差分検出を検証する:
 * - 記録直後は差分なし
 * - スコア変更（status）を検知し before→after を返す
 * - 注釈の編集・削除を annotationChanged で検知する
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
  captureReturnSnapshot,
  getReturnDiff,
} from "@/electron-src/lib/prisma/returnSnapshot"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

describe("ReturnSnapshot capture/diff", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("記録直後は差分が無い", async () => {
    const fx = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeAnnotations: true,
    })
    const studentIds = fx.students.map((s) => s.id)

    const cap = await captureReturnSnapshot({
      examId: fx.exam.id,
      studentIds,
    })
    expect(cap.success).toBe(true)
    expect(cap.capturedCount).toBe(studentIds.length)

    const diff = await getReturnDiff(fx.exam.id)
    expect(diff.success).toBe(true)
    expect(diff.hasAnySnapshot).toBe(true)
    for (const d of diff.diffs) {
      expect(d.hasSnapshot).toBe(true)
      expect(d.changed).toBe(false)
      expect(d.scoreChanges).toHaveLength(0)
      expect(d.annotationChanged).toBe(false)
    }
  })

  it("スコア変更を before→after で検知する", async () => {
    const fx = await createFullTestExam(testPrisma, { includeScores: true })
    const studentIds = fx.students.map((s) => s.id)
    await captureReturnSnapshot({ examId: fx.exam.id, studentIds })

    // 1件の採点を correct → incorrect に変更
    const target = fx.questionScores[0]
    await testPrisma.questionScore.update({
      where: { id: target.id },
      data: { status: "incorrect", updatedAt: new Date() },
    })

    const diff = await getReturnDiff(fx.exam.id)
    const changed = diff.diffs.filter((d) => d.changed)
    expect(changed).toHaveLength(1)

    const d = changed[0]
    expect(d.studentId).toBe(target.studentId)
    const cell = d.scoreChanges.find(
      (c) => c.cropRegionId === target.cropRegionId
    )
    expect(cell).toBeDefined()
    expect(cell?.before?.status).toBe("correct")
    expect(cell?.before?.value).toBe(10)
    expect(cell?.after?.status).toBe("incorrect")
    expect(cell?.after?.value).toBe(0)
    expect(d.annotationChanged).toBe(false)
  })

  it("注釈の編集を annotationChanged で検知する", async () => {
    const fx = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeAnnotations: true,
    })
    const studentIds = fx.students.map((s) => s.id)
    await captureReturnSnapshot({ examId: fx.exam.id, studentIds })

    // 注釈のテキストを変更
    const annotation = fx.drawingAnnotations[0]
    await testPrisma.drawingAnnotation.update({
      where: { id: annotation.id },
      data: { text: "変更後コメント", updatedAt: new Date() },
    })

    const diff = await getReturnDiff(fx.exam.id)
    const changed = diff.diffs.filter((d) => d.changed)
    expect(changed).toHaveLength(1)
    expect(changed[0].annotationChanged).toBe(true)
    expect(changed[0].scoreChanges).toHaveLength(0)
  })

  it("注釈の削除を annotationChanged で検知する", async () => {
    const fx = await createFullTestExam(testPrisma, {
      includeScores: true,
      includeAnnotations: true,
    })
    const studentIds = fx.students.map((s) => s.id)
    await captureReturnSnapshot({ examId: fx.exam.id, studentIds })

    await testPrisma.drawingAnnotation.delete({
      where: { id: fx.drawingAnnotations[0].id },
    })

    const diff = await getReturnDiff(fx.exam.id)
    const changed = diff.diffs.filter((d) => d.changed)
    expect(changed).toHaveLength(1)
    expect(changed[0].annotationChanged).toBe(true)
  })

  it("スナップショット未記録の生徒は hasSnapshot=false", async () => {
    const fx = await createFullTestExam(testPrisma, { includeScores: true })
    // 1人だけ返却版として記録する
    const [first, ...rest] = fx.students.map((s) => s.id)
    await captureReturnSnapshot({ examId: fx.exam.id, studentIds: [first] })

    const diff = await getReturnDiff(fx.exam.id)
    const firstDiff = diff.diffs.find((d) => d.studentId === first)
    expect(firstDiff?.hasSnapshot).toBe(true)
    for (const id of rest) {
      const d = diff.diffs.find((x) => x.studentId === id)
      expect(d?.hasSnapshot).toBe(false)
      expect(d?.changed).toBe(false)
    }
  })
})
