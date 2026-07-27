/**
 * GradeConstraint（観点間の制約ルール）の CRUD 統合テスト
 *
 * issue #1063 で設定JSONをリレーションへ正規化した際の、renderer 境界を跨ぐ形と
 * 書き込みの原子性を検証する。評価ロジック単体のテストは
 * __tests__/grades/gradeConstraints.test.ts にある。
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
  createGradeConstraint,
  getGradeConstraints,
  updateGradeConstraint,
} from "@/electron-src/lib/prisma/gradeConstraint"
import type { GradeConstraintInput } from "@/types/grade.types"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

async function createGradeWithItems() {
  const grade = await testPrisma.grade.create({
    data: { name: `制約テスト_${Date.now()}` },
  })
  const knowledge = await testPrisma.gradeItem.create({
    data: { gradeId: grade.id, name: "知識・技能", order: 0 },
  })
  const hyotei = await testPrisma.gradeItem.create({
    data: { gradeId: grade.id, name: "評定", order: 1 },
  })
  return { grade, knowledge, hyotei }
}

function buildInput(
  overrides: Partial<GradeConstraintInput> = {}
): GradeConstraintInput {
  return {
    name: "評定と観点の整合",
    kind: "consistency",
    targetGradeItemId: null,
    aggregate: "average",
    tolerance: 1.5,
    viewpointGradeItemIds: [],
    labelValues: { A: 5, B: 3, C: 1 },
    exclusionLabels: [],
    expression: "",
    color: "#fecaca",
    message: null,
    enabled: true,
    order: 0,
    ...overrides,
  }
}

describe("GradeConstraint の renderer 境界（issue #1063）", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  // Decimal のまま返すと IPC で {s,e,d} のオブジェクトになり、renderer 側の
  // 数値比較（tolerance との差分判定・ラベル値の加算）が黙って壊れる。
  // GradeConstraintData は number と宣言しているので型では捕まらない。
  it("tolerance と labelValues.value を number で返す（Decimal を漏らさない）", async () => {
    const { grade, knowledge, hyotei } = await createGradeWithItems()

    const created = await createGradeConstraint({
      gradeId: grade.id,
      constraint: buildInput({
        targetGradeItemId: hyotei.id,
        viewpointGradeItemIds: [knowledge.id],
      }),
    })
    expect(created.success).toBe(true)
    expect(typeof created.constraint!.tolerance).toBe("number")
    expect(created.constraint!.tolerance).toBe(1.5)
    for (const labelValue of created.constraint!.labelValues) {
      expect(typeof labelValue.value).toBe("number")
    }
    expect(
      created.constraint!.labelValues.map((labelValue) => [
        labelValue.label,
        labelValue.value,
      ])
    ).toEqual([
      ["A", 5],
      ["B", 3],
      ["C", 1],
    ])

    const listed = await getGradeConstraints(grade.id)
    expect(typeof listed.constraints![0].tolerance).toBe("number")
    expect(typeof listed.constraints![0].labelValues[0].value).toBe("number")

    const updated = await updateGradeConstraint({
      id: created.constraint!.id,
      constraint: { tolerance: 2.25 },
    })
    expect(typeof updated.constraint!.tolerance).toBe("number")
    expect(updated.constraint!.tolerance).toBe(2.25)
  })

  // 本体だけ作られて設定リレーションが入らないと、viewpoints ゼロ＝
  // 「比較先以外の全項目」という設定していないルールとして動き出す。
  it("設定リレーションの書き込みに失敗したら制約ごと作られない", async () => {
    const { grade, hyotei } = await createGradeWithItems()

    const result = await createGradeConstraint({
      gradeId: grade.id,
      constraint: buildInput({
        targetGradeItemId: hyotei.id,
        // 存在しない評価項目を集計対象に指定 → FK違反で設定の書き込みが失敗する
        viewpointGradeItemIds: ["gi-does-not-exist"],
      }),
    })

    expect(result.success).toBe(false)
    const remaining = await testPrisma.gradeConstraint.findMany({
      where: { gradeId: grade.id },
    })
    expect(remaining).toEqual([])
  })

  // 同一idの delete → create は NAS 同期の tombstone に抑止されて相手側で行が消える。
  // 据え置く行は更新で通し、実際に外れた行だけ削除する。
  it("設定を更新しても据え置く行は作り直さない", async () => {
    const { grade, knowledge, hyotei } = await createGradeWithItems()
    const attitude = await testPrisma.gradeItem.create({
      data: { gradeId: grade.id, name: "態度", order: 2 },
    })

    const created = await createGradeConstraint({
      gradeId: grade.id,
      constraint: buildInput({
        targetGradeItemId: hyotei.id,
        viewpointGradeItemIds: [knowledge.id, attitude.id],
      }),
    })
    const before = await testPrisma.gradeConstraintViewpoint.findMany({
      where: { constraintId: created.constraint!.id },
      orderBy: { order: "asc" },
    })
    const knowledgeRowCreatedAt = before.find(
      (viewpoint) => viewpoint.gradeItemId === knowledge.id
    )!.createdAt

    // 態度を外して知識・技能だけにする
    await updateGradeConstraint({
      id: created.constraint!.id,
      constraint: { viewpointGradeItemIds: [knowledge.id] },
    })

    const after = await testPrisma.gradeConstraintViewpoint.findMany({
      where: { constraintId: created.constraint!.id },
    })
    expect(after).toHaveLength(1)
    expect(after[0].gradeItemId).toBe(knowledge.id)
    // 据え置いた行は作り直されていない（createdAt が保たれる）
    expect(after[0].createdAt.getTime()).toBe(knowledgeRowCreatedAt.getTime())
  })

  it("ラベル値の入れ替えで外れたラベルだけ消える", async () => {
    const { grade, knowledge, hyotei } = await createGradeWithItems()
    const created = await createGradeConstraint({
      gradeId: grade.id,
      constraint: buildInput({
        targetGradeItemId: hyotei.id,
        viewpointGradeItemIds: [knowledge.id],
        labelValues: { A: 5, B: 3, C: 1 },
      }),
    })
    const beforeA = await testPrisma.gradeConstraintLabelValue.findFirst({
      where: { constraintId: created.constraint!.id, label: "A" },
    })

    await updateGradeConstraint({
      id: created.constraint!.id,
      constraint: { labelValues: { A: 4, B: 3 } },
    })

    const after = await testPrisma.gradeConstraintLabelValue.findMany({
      where: { constraintId: created.constraint!.id },
      orderBy: { order: "asc" },
    })
    expect(after.map((labelValue) => labelValue.label)).toEqual(["A", "B"])
    expect(Number(after[0].value)).toBe(4)
    // A は値だけ変わって行は据え置き
    expect(after[0].createdAt.getTime()).toBe(beforeA!.createdAt.getTime())
  })
})
