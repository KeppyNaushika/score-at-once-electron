/**
 * 監査ログ 統合テスト
 *
 * recordAuditLog（操作者補完・ベストエフォート・対象の記録）、集約（同一キーの上書き）、
 * getAuditLogs（フィルタ/ページネーション。行はそのまま返す）、getAuditLogScopes（選択肢）、
 * pruneAuditLogs を検証する。
 * Electron依存を回避するため prisma/client をテスト用クライアントでモックする。
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

// 操作者の自動補完（認証ストア）は常に null を返すようにして、テストを決定的にする
vi.mock("../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => null,
}))

import { parseAuditMetadata } from "@/app/(app)/audit-logs/auditLogRow"
import {
  diffFields,
  mergeCoalescedChanges,
  recordAuditLog,
} from "@/electron-src/lib/prisma/auditLog"
import {
  getAuditLogs,
  getAuditLogScopes,
  pruneAuditLogs,
} from "@/electron-src/lib/prisma/auditQuery"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  createTestUser,
  disconnectTestPrisma,
} from "../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

describe("監査ログ recordAuditLog", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
    await testPrisma.$disconnect()
  })

  it("1件記録し、getAuditLogsで行のまま取得できる（カテゴリは記録時に列へ入る）", async () => {
    await recordAuditLog({
      action: "exam.create",
      userId: null,
      entityType: "Exam",
      entityId: "exam-1",
      scopeId: "exam-1",
      scopeLabel: "数学 期末",
      target: "数学 期末",
    })

    const page = await getAuditLogs()
    expect(page.total).toBe(1)
    const log = page.logs[0]
    expect(log.action).toBe("exam.create")
    expect(log.category).toBe("exam")
    expect(log.scopeLabel).toBe("数学 期末")
    expect(log.targets).toEqual([])
    expect(parseAuditMetadata(log.metadata).occurrences).toBeUndefined()
    expect(log.summary).toContain("数学 期末")
  })

  it("操作者は userId のまま返す（名前の解決は renderer が利用者一覧で行う）", async () => {
    const user = await createTestUser({ name: "山田 太郎" })
    await recordAuditLog({
      action: "exam.update",
      userId: user.id,
      entityType: "Exam",
      entityId: "exam-1",
    })

    const page = await getAuditLogs()
    expect(page.logs[0].userId).toBe(user.id)
  })

  it("対象（生徒・採点領域）を子行として記録し、行と一緒に返す", async () => {
    await recordAuditLog({
      action: "exam.score.propose",
      userId: null,
      entityType: "QuestionScore",
      entityId: "score-1",
      targets: [
        {
          targetType: "Student",
          targetId: "student-1",
          targetLabel: "山田 太郎",
        },
        { targetType: "CropRegion", targetId: "region-1", targetLabel: "1-1" },
      ],
    })

    const page = await getAuditLogs()
    expect(
      page.logs[0].targets
        .map((target) => [
          target.targetType,
          target.targetId,
          target.targetLabel,
        ])
        .sort()
    ).toEqual([
      ["CropRegion", "region-1", "1-1"],
      ["Student", "student-1", "山田 太郎"],
    ])
  })

  it("集約した行には、まだ付いていない対象だけを足す", async () => {
    const key = "compound_score:answer-1:u-1"
    const record = (studentId: string) =>
      recordAuditLog({
        action: "exam.compound_answer.update",
        userId: "u-1",
        entityType: "CompoundAnswerScore",
        entityId: `score-${studentId}`,
        coalesceKey: key,
        targets: [
          {
            targetType: "Student",
            targetId: studentId,
            targetLabel: studentId,
          },
        ],
      })
    await record("student-1")
    await record("student-1")
    await record("student-2")

    const page = await getAuditLogs()
    expect(page.total).toBe(1)
    expect(
      page.logs[0].targets.map((target) => target.targetId).sort()
    ).toEqual(["student-1", "student-2"])
  })

  it("未知のアクションでも例外を投げず、category は system にフォールバックする", async () => {
    await expect(
      recordAuditLog({
        action: "totally.unknown.action",
        userId: null,
        entityType: "X",
        entityId: "x-1",
      })
    ).resolves.toBeUndefined()

    const page = await getAuditLogs()
    expect(page.total).toBe(1)
    expect(page.logs[0].category).toBe("system")
  })

  it("changes は metadata に格納される", async () => {
    await recordAuditLog({
      action: "exam.update",
      userId: null,
      entityType: "Exam",
      entityId: "exam-1",
      changes: [
        { field: "examName", label: "試験名", before: "旧", after: "新" },
      ],
    })
    const page = await getAuditLogs()
    const changes = parseAuditMetadata(page.logs[0].metadata).changes
    expect(changes?.[0].before).toBe("旧")
    expect(changes?.[0].after).toBe("新")
  })
})

describe("監査ログ 集約（coalesce）", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  it("同一キー・同一操作者の連続操作は1行に集約され、occurrences が増え after が上書きされる", async () => {
    const key = "annotation.update:mark-1"
    await recordAuditLog({
      action: "exam.annotation.update",
      userId: "u-1",
      entityType: "DrawingAnnotation",
      entityId: "mark-1",
      coalesceKey: key,
      changes: [{ field: "text", label: "テキスト", before: null, after: "A" }],
    })
    await recordAuditLog({
      action: "exam.annotation.update",
      userId: "u-1",
      entityType: "DrawingAnnotation",
      entityId: "mark-1",
      coalesceKey: key,
      changes: [{ field: "text", label: "テキスト", before: null, after: "B" }],
    })

    const page = await getAuditLogs()
    expect(page.total).toBe(1)
    const metadata = parseAuditMetadata(page.logs[0].metadata)
    expect(metadata.occurrences).toBe(2)
    expect(metadata.changes?.[0].after).toBe("B") // after は最新で上書き
  })

  it("複数項目の連続操作は、項目ごとに before は初回・after は最新になる", async () => {
    const key = "omr_config:region-1"
    await recordAuditLog({
      action: "exam.omr_config.update",
      userId: "u-1",
      entityType: "CropRegionOmrConfig",
      entityId: "config-1",
      coalesceKey: key,
      changes: [
        { field: "a", before: 1, after: 2 },
        { field: "b", before: "x", after: "y" },
      ],
    })
    await recordAuditLog({
      action: "exam.omr_config.update",
      userId: "u-1",
      entityType: "CropRegionOmrConfig",
      entityId: "config-1",
      coalesceKey: key,
      changes: [
        { field: "a", before: 2, after: 3 },
        { field: "b", before: "y", after: "z" },
      ],
    })

    const page = await getAuditLogs()
    expect(page.total).toBe(1)
    expect(parseAuditMetadata(page.logs[0].metadata).changes).toEqual([
      { field: "a", before: 1, after: 3 },
      { field: "b", before: "x", after: "z" },
    ])
  })

  it("まとめた行は最後の操作の時刻（updatedAt）で並ぶ", async () => {
    const key = "annotation.update:mark-1"
    const record = (entityId: string, coalesceKey?: string) =>
      recordAuditLog({
        action: "exam.annotation.update",
        userId: "u-1",
        entityType: "DrawingAnnotation",
        entityId,
        coalesceKey,
      })
    // 集約される行を先に作り、別の行を挟んでから、最初の行へもう一度集約する
    await record("mark-1", key)
    const earlier = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    await testPrisma.$executeRawUnsafe(
      `UPDATE "AuditLog" SET "createdAt" = ?, "updatedAt" = ? WHERE "coalesceKey" = ?`,
      earlier,
      earlier,
      key
    )
    await record("mark-2")
    const middle = new Date(Date.now() - 60 * 1000).toISOString()
    await testPrisma.$executeRawUnsafe(
      `UPDATE "AuditLog" SET "createdAt" = ?, "updatedAt" = ? WHERE "entityId" = 'mark-2'`,
      middle,
      middle
    )
    await record("mark-1", key)

    const page = await getAuditLogs()
    expect(page.logs.map((log) => log.entityId)).toEqual(["mark-1", "mark-2"])
    expect(parseAuditMetadata(page.logs[0].metadata).occurrences).toBe(2)
  })

  it("操作者が異なれば別行になる", async () => {
    const key = "annotation.update:mark-1"
    await recordAuditLog({
      action: "exam.annotation.update",
      userId: "u-1",
      entityType: "DrawingAnnotation",
      entityId: "mark-1",
      coalesceKey: key,
    })
    await recordAuditLog({
      action: "exam.annotation.update",
      userId: "u-2",
      entityType: "DrawingAnnotation",
      entityId: "mark-1",
      coalesceKey: key,
    })
    const page = await getAuditLogs()
    expect(page.total).toBe(2)
  })

  it("coalesceKey が無ければ毎回新規行になる", async () => {
    for (let i = 0; i < 3; i++) {
      await recordAuditLog({
        action: "exam.annotation.create",
        userId: "u-1",
        entityType: "DrawingAnnotation",
        entityId: `mark-${i}`,
      })
    }
    const page = await getAuditLogs()
    expect(page.total).toBe(3)
  })

  it("時間窓を過ぎた同一キーは集約せず新規行になる", async () => {
    const key = "marking_format:exam-1"
    await recordAuditLog({
      action: "exam.marking_format.update",
      userId: "u-1",
      entityType: "ExamMarkingFormat",
      entityId: "exam-1",
      coalesceKey: key,
    })
    // 既存行の updatedAt を6分前に後退させる（窓=5分）
    const past = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    await testPrisma.$executeRawUnsafe(
      `UPDATE "AuditLog" SET "updatedAt" = ? WHERE "coalesceKey" = ?`,
      past,
      key
    )
    await recordAuditLog({
      action: "exam.marking_format.update",
      userId: "u-1",
      entityType: "ExamMarkingFormat",
      entityId: "exam-1",
      coalesceKey: key,
    })
    const page = await getAuditLogs()
    expect(page.total).toBe(2)
  })
})

describe("監査ログ getAuditLogs フィルタ/ページネーション", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
    await recordAuditLog({
      action: "exam.create",
      userId: "u-1",
      entityType: "Exam",
      entityId: "e1",
      summary: "試験Aを作成しました",
    })
    await recordAuditLog({
      action: "grade.create",
      userId: "u-2",
      entityType: "Grade",
      entityId: "g1",
      summary: "成績Bを作成しました",
    })
    await recordAuditLog({
      action: "student.create",
      userId: "u-1",
      entityType: "Student",
      entityId: "s1",
      summary: "生徒Cを登録しました",
    })
  })

  it("カテゴリで絞り込める", async () => {
    const page = await getAuditLogs({ category: "grade" })
    expect(page.total).toBe(1)
    expect(page.logs[0].action).toBe("grade.create")
  })

  it("操作者で絞り込める", async () => {
    const page = await getAuditLogs({ userId: "u-1" })
    expect(page.total).toBe(2)
  })

  it("サマリ部分一致で検索できる", async () => {
    const page = await getAuditLogs({ search: "成績B" })
    expect(page.total).toBe(1)
  })

  it("検索は空白（全角・半角・無し）を区別しない", async () => {
    await recordAuditLog({
      action: "student.update",
      userId: "u-1",
      entityType: "Student",
      entityId: "s2",
      summary: "山田 太郎を更新しました",
    })
    await recordAuditLog({
      action: "student.update",
      userId: "u-1",
      entityType: "Student",
      entityId: "s3",
      summary: `山田${"　"}太郎の所属を変更しました`,
    })
    for (const search of ["山田太郎", "山田 太郎", `山田${"　"}太郎`]) {
      const page = await getAuditLogs({ search })
      expect(page.total).toBe(2)
      expect(page.logs.map((log) => log.entityId).sort()).toEqual(["s2", "s3"])
    }
  })

  it("検索しながら他の条件とページ分けも効き、並びは新しい順のまま", async () => {
    const page = await getAuditLogs({ search: "を作成", userId: "u-1" }, 1, 0)
    expect(page.total).toBe(1)
    expect(page.logs.map((log) => log.entityId)).toEqual(["e1"])
  })

  it("検索語の % や _ は文字として扱う", async () => {
    const page = await getAuditLogs({ search: "%" })
    expect(page.total).toBe(0)
  })

  it("limit/offset でページングでき、total は全件数を返す", async () => {
    const page1 = await getAuditLogs({}, 2, 0)
    expect(page1.total).toBe(3)
    expect(page1.logs).toHaveLength(2)
    const page2 = await getAuditLogs({}, 2, 2)
    expect(page2.logs).toHaveLength(1)
  })

  it("limit/offset は範囲に収めた実効値を返す", async () => {
    const page = await getAuditLogs({}, 1000, -3)
    expect(page.limit).toBe(200)
    expect(page.offset).toBe(0)
  })

  it("アクションの集合で絞り込め、空の集合は何にも一致しない（検索の有無で同じ）", async () => {
    for (const search of [undefined, "作成"]) {
      const page = await getAuditLogs({
        actions: ["exam.create", "grade.create"],
        search,
      })
      expect(page.logs.map((log) => log.action).sort()).toEqual([
        "exam.create",
        "grade.create",
      ])
      expect((await getAuditLogs({ actions: [], search })).total).toBe(0)
    }
  })
})

describe("監査ログ 対象・作業領域での絞り込みと選択肢", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
    // 試験Aで山田と鈴木を採点し、試験Bで山田を採点する（採点領域は試験ごとに別）
    const score = (
      entityId: string,
      scopeId: string,
      scopeLabel: string,
      studentId: string,
      studentLabel: string,
      cropRegionId: string
    ) =>
      recordAuditLog({
        action: "exam.score.propose",
        userId: "u-1",
        entityType: "QuestionScore",
        entityId,
        scopeId,
        scopeLabel,
        summary: `「${studentLabel}」の「1-1」の採点を提案しました`,
        targets: [
          {
            targetType: "Student",
            targetId: studentId,
            targetLabel: studentLabel,
          },
          {
            targetType: "CropRegion",
            targetId: cropRegionId,
            targetLabel: "1-1",
          },
        ],
      })
    await score(
      "q1",
      "exam-a",
      "試験A",
      "student-yamada",
      "山田 太郎",
      "region-a"
    )
    await score(
      "q2",
      "exam-a",
      "試験A",
      "student-suzuki",
      "鈴木 花子",
      "region-a"
    )
    await score(
      "q3",
      "exam-b",
      "試験B",
      "student-yamada",
      "山田 太郎",
      "region-b"
    )
  })

  it("生徒で絞ると、試験をまたいでその生徒のログだけが残る（検索の有無で同じ）", async () => {
    for (const search of [undefined, "採点"]) {
      const page = await getAuditLogs({
        targets: [{ targetType: "Student", targetId: "student-yamada" }],
        search,
      })
      expect(page.logs.map((log) => log.entityId).sort()).toEqual(["q1", "q3"])
    }
  })

  it("対象を複数指定すると、すべてを持つログだけが残る（検索の有無で同じ）", async () => {
    for (const search of [undefined, "採点"]) {
      const page = await getAuditLogs({
        targets: [
          { targetType: "Student", targetId: "student-yamada" },
          { targetType: "CropRegion", targetId: "region-a" },
        ],
        search,
      })
      expect(page.logs.map((log) => log.entityId)).toEqual(["q1"])
    }
  })

  it("作業領域で絞り込める", async () => {
    const page = await getAuditLogs({ scopeId: "exam-b" })
    expect(page.logs.map((log) => log.entityId)).toEqual(["q3"])
  })

  it("選択肢は作業領域と対象を重複なく返し、対象には現れた作業領域を添える", async () => {
    const { scopes, targets } = await getAuditLogScopes()
    expect(
      scopes.map((scope) => [scope.scopeId, scope.scopeLabel]).sort()
    ).toEqual([
      ["exam-a", "試験A"],
      ["exam-b", "試験B"],
    ])
    expect(
      targets
        .filter((target) => target.targetType === "Student")
        .map((target) => [target.targetId, target.scopeId])
        .sort()
    ).toEqual([
      ["student-suzuki", "exam-a"],
      ["student-yamada", "exam-a"],
      ["student-yamada", "exam-b"],
    ])
    expect(
      targets
        .filter((target) => target.targetType === "CropRegion")
        .map((target) => [target.targetId, target.scopeLabel])
        .sort()
    ).toEqual([
      ["region-a", "試験A"],
      ["region-b", "試験B"],
    ])
  })

  it("ログを消すと対象も一緒に消える", async () => {
    await testPrisma.auditLog.deleteMany({ where: { entityId: "q1" } })
    expect(await testPrisma.auditLogTarget.count()).toBe(4)
  })
})

describe("監査ログ pruneAuditLogs", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  it("保持期間より古い行を削除する", async () => {
    await recordAuditLog({
      action: "exam.create",
      userId: null,
      entityType: "Exam",
      entityId: "old",
    })
    await recordAuditLog({
      action: "exam.create",
      userId: null,
      entityType: "Exam",
      entityId: "new",
    })
    // 1件を400日前に後退
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
    await testPrisma.$executeRawUnsafe(
      `UPDATE "AuditLog" SET "updatedAt" = ? WHERE "entityId" = 'old'`,
      old
    )

    const deleted = await pruneAuditLogs(365)
    expect(deleted).toBe(1)
    const page = await getAuditLogs()
    expect(page.total).toBe(1)
    expect(page.logs[0].entityId).toBe("new")
  })

  it("retentionDays が不正なら何もしない", async () => {
    await recordAuditLog({
      action: "exam.create",
      userId: null,
      entityType: "Exam",
      entityId: "e1",
    })
    expect(await pruneAuditLogs(0)).toBe(0)
    expect(await pruneAuditLogs(-5)).toBe(0)
    const page = await getAuditLogs()
    expect(page.total).toBe(1)
  })
})

describe("diffFields", () => {
  it("変化したフィールドのみ返す", () => {
    const changes = diffFields(
      { a: 1, b: "x", c: true },
      { a: 2, b: "x", c: false },
      [
        { field: "a", label: "A" },
        { field: "b", label: "B" },
        { field: "c", label: "C" },
      ]
    )
    expect(changes.map((change) => change.field).sort()).toEqual(["a", "c"])
  })

  it("変化が無ければ空配列", () => {
    const changes = diffFields({ a: 1 }, { a: 1 }, [{ field: "a" }])
    expect(changes).toHaveLength(0)
  })
})

describe("mergeCoalescedChanges", () => {
  it("同じ項目は before を初回のまま、after を今回の値にする", () => {
    const merged = mergeCoalescedChanges(
      [
        { field: "a", label: "A", before: 1, after: 2 },
        { field: "b", label: "B", before: "x", after: "y" },
      ],
      [
        { field: "a", label: "A", before: 2, after: 3 },
        { field: "b", label: "B", before: "y", after: "z" },
      ]
    )
    expect(merged).toEqual([
      { field: "a", label: "A", before: 1, after: 3 },
      { field: "b", label: "B", before: "x", after: "z" },
    ])
  })

  it("今回初めて変わった項目は足し、今回触れなかった項目は残す", () => {
    const merged = mergeCoalescedChanges(
      [{ field: "a", before: 1, after: 2 }],
      [{ field: "b", before: "x", after: "y" }]
    )
    expect(merged).toEqual([
      { field: "a", before: 1, after: 2 },
      { field: "b", before: "x", after: "y" },
    ])
  })

  it("既存行に changes が無ければ今回の changes をそのまま使う", () => {
    const incoming = [{ field: "a", before: 1, after: 2 }]
    expect(mergeCoalescedChanges(undefined, incoming)).toEqual(incoming)
  })

  it("既存の配列を書き換えない", () => {
    const existing = [{ field: "a", before: 1, after: 2 }]
    mergeCoalescedChanges(existing, [{ field: "a", before: 2, after: 3 }])
    expect(existing[0].after).toBe(2)
  })
})
