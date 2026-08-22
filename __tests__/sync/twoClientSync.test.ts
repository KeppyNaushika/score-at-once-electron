/**
 * 2端末同期の結合テスト（本物の sqlite-nas-sync × 本物の schema.prisma）
 *
 * ライブラリ側のテストは自前の小さなスキーマ（`tags` / `tag_notes`）で書かれている。
 * ここで確かめるのは **アプリのスキーマを繋いだとき**に同じ結末になるかで、
 * 具体的には `Tag.name` の UNIQUE と `ExamStudent(examId, studentId)` の UNIQUE が
 * 起こす「畳み」を、実機2台を用意せずに再現する。
 *
 * 畳み = 別の id なのに同じユニークキーを持つ行が出会ったとき、LWW で片方を勝たせ、
 * 負けた行の子を勝った行へ付け替えてから負けた行を消すこと。
 * 直っていなかった頃の壊れ方は2つで、どちらもここで踏む形になっている:
 *
 * - **名前を直しただけで同期が永久に止まる** — ユニーク違反で取り込みが落ち、
 *   その相手の changelog を1件も先へ進められなくなる（`blockingWarnings` で見る）
 * - **採点データが消える** — 負けた ExamStudent を消すときに、その子の
 *   QuestionScore を道連れにする（行数と付け替え先で見る）
 *
 * 画面は通していない。畳みが renderer と監査ログへ出る経路は
 * `syncServiceFoldIntegration.test.ts` が syncService ごと動かして見る。
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import type { SyncInstance } from "sqlite-nas-sync"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  blockingWarnings,
  createClientDatabase,
  createSyncInstance,
  deleteTag,
  examStudentRows,
  idMergeRows,
  insertExamStudent,
  insertQuestionScore,
  insertTag,
  isoMinutesAgo,
  questionScoreRows,
  renameTag,
  seedScoringSkeleton,
  tagRows,
  tombstoneRows,
  withDatabase,
} from "./twoClientHarness"

const TEST_ROOT = path.join(os.tmpdir(), "score-at-once-two-client-sync")
const NAS_DIR = path.join(TEST_ROOT, "nas")
const DB_A = path.join(TEST_ROOT, "client-a", "database.db")
const DB_B = path.join(TEST_ROOT, "client-b", "database.db")

/** 両端末で同じ値でなければ相手がスキーマ不一致でスキップされる */
const SCHEMA_VERSION = "two-client-sync-test"

let syncA: SyncInstance
let syncB: SyncInstance

/**
 * 1巡回す。**同期を止める警告が出ていないこと**を毎回見るのがこの関数の主目的で、
 * 「畳みは起きたが、その相手からは以後何も届かない」状態を通過させない。
 */
const syncRound = async (label: string, instance: SyncInstance) => {
  const result = await instance.syncNow()
  expect(blockingWarnings(result.warnings), label).toEqual([])
  return result
}

const countRows = (dbPath: string, tableName: string): number =>
  withDatabase(dbPath, (db) => {
    const row = db
      .prepare<[], { count: number }>(
        `SELECT COUNT(*) AS count FROM "${tableName}"`
      )
      .get()
    return row === undefined ? 0 : row.count
  })

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(NAS_DIR, { recursive: true })
  createClientDatabase(DB_A)
  createClientDatabase(DB_B)
  syncA = createSyncInstance(DB_A, "client-a", NAS_DIR, SCHEMA_VERSION)
  syncB = createSyncInstance(DB_B, "client-b", NAS_DIR, SCHEMA_VERSION)
})

afterEach(() => {
  syncA.stop()
  syncB.stop()
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("ふつうの同期", () => {
  it("作成・更新・削除が相手へ届く", async () => {
    // 作成
    insertTag(DB_A, {
      id: "tag-math",
      name: "数学",
      updatedAt: isoMinutesAgo(60),
    })
    await syncRound("A 作成の送出", syncA)
    const inserted = await syncRound("B 作成の取り込み", syncB)
    expect(inserted.inserted).toBe(1)
    expect(tagRows(DB_B)).toEqual([{ id: "tag-math", name: "数学" }])

    // 更新
    renameTag(DB_A, {
      id: "tag-math",
      name: "数学I",
      updatedAt: isoMinutesAgo(40),
    })
    await syncRound("A 更新の送出", syncA)
    const updated = await syncRound("B 更新の取り込み", syncB)
    expect(updated.updated).toBe(1)
    expect(tagRows(DB_B)).toEqual([{ id: "tag-math", name: "数学I" }])

    // 削除
    deleteTag(DB_A, "tag-math")
    await syncRound("A 削除の送出", syncA)
    const deleted = await syncRound("B 削除の取り込み", syncB)
    expect(deleted.deleted).toBe(1)
    expect(tagRows(DB_B)).toEqual([])
  })
})

describe("同じ id の行の LWW", () => {
  it("両端末が同じ行を直したら、新しい方が残る", async () => {
    insertTag(DB_A, {
      id: "tag-math",
      name: "数学",
      updatedAt: isoMinutesAgo(60),
    })
    await syncRound("A 初回送出", syncA)
    await syncRound("B 初回取り込み", syncB)

    // A の方が古い改名、B の方が新しい改名（どちらもまだ相手を知らない）
    renameTag(DB_A, {
      id: "tag-math",
      name: "数学A",
      updatedAt: isoMinutesAgo(30),
    })
    renameTag(DB_B, {
      id: "tag-math",
      name: "数学B",
      updatedAt: isoMinutesAgo(10),
    })

    await syncRound("A 送出", syncA)
    const bResult = await syncRound("B 取り込み(自分が新しい)", syncB)
    // 届いた A の更新は古いので捨てる
    expect(bResult.skipped).toBe(1)
    expect(bResult.updated).toBe(0)

    await syncRound("B 送出", syncB)
    const aResult = await syncRound("A 取り込み(相手が新しい)", syncA)
    expect(aResult.updated).toBe(1)

    expect(tagRows(DB_A)).toEqual([{ id: "tag-math", name: "数学B" }])
    expect(tagRows(DB_B)).toEqual([{ id: "tag-math", name: "数学B" }])
  })
})

describe("畳み（別 id・同一ユニークキー）", () => {
  /**
   * A が持っていたタグを改名し、B は独立に同じ名前のタグを作る。
   * `Tag.name` は UNIQUE なので、この2行は同居できない。
   */
  const seedTagNameCollision = async (): Promise<void> => {
    insertTag(DB_A, {
      id: "tag-math",
      name: "数学",
      updatedAt: isoMinutesAgo(60),
    })
    await syncRound("A 初回送出", syncA)
    await syncRound("B 初回取り込み", syncB)
    expect(tagRows(DB_B)).toEqual([{ id: "tag-math", name: "数学" }])

    // A: 「数学」→「国語」へ改名（古い方）
    renameTag(DB_A, {
      id: "tag-math",
      name: "国語",
      updatedAt: isoMinutesAgo(30),
    })
    await syncRound("A 改名の送出", syncA)

    // B: 相手を知らないまま、独立に「国語」を作る（新しい方 → B が勝つ）
    insertTag(DB_B, {
      id: "tag-japanese",
      name: "国語",
      updatedAt: isoMinutesAgo(10),
    })
  }

  it("改名がぶつかると1つへ畳まれ、両端末が同じ答えへ収束する", async () => {
    await seedTagNameCollision()

    // B 側で畳みが起きる（届いた tag-math が、ローカルの新しい tag-japanese に負ける）
    const foldResult = await syncRound("B 畳み", syncB)
    expect(foldResult.folds).toEqual([
      {
        tableName: "Tag",
        losingId: "tag-math",
        winningId: "tag-japanese",
        removedLocalRow: true,
      },
    ])
    // 畳みは行が1つ消える操作なので、消えた数にも出る
    expect(foldResult.deleted).toBe(1)
    expect(tagRows(DB_B)).toEqual([{ id: "tag-japanese", name: "国語" }])

    // 畳み先は墓標に載る。ここが空だと、受け取った側は tag-math をただ消すだけになる
    expect(tombstoneRows(DB_B, "Tag")).toEqual([
      { recordId: "tag-math", mergedInto: "tag-japanese" },
    ])
    expect(idMergeRows(DB_B, "Tag")).toEqual([
      { losingId: "tag-math", winningId: "tag-japanese" },
    ])

    // A は自分の tag-math をまだ持っている。畳みの決定が伝わって初めて揃う
    await syncRound("B 送出", syncB)
    await syncRound("A 畳みの受け取り", syncA)

    expect(tagRows(DB_A)).toEqual([{ id: "tag-japanese", name: "国語" }])
    expect(tagRows(DB_B)).toEqual([{ id: "tag-japanese", name: "国語" }])
  })

  it("畳みが起きても次の巡回が正常に走り、あとの変更も届く", async () => {
    await seedTagNameCollision()

    await syncRound("B 畳み", syncB)
    await syncRound("B 送出", syncB)
    await syncRound("A 畳みの受け取り", syncA)

    // 畳みの直後から3巡。新たな畳みが起き続けたら（= 端末どうしが相手を畳み合って
    // いたら）収束していない。警告は syncRound が毎回見ている
    for (let round = 1; round <= 3; round++) {
      const resultA = await syncRound(`A ${round}巡目`, syncA)
      const resultB = await syncRound(`B ${round}巡目`, syncB)
      expect(resultA.clientsSynced, `A ${round}巡目`).toBe(1)
      expect(resultB.clientsSynced, `B ${round}巡目`).toBe(1)
      expect(resultA.folds, `A ${round}巡目`).toEqual([])
      expect(resultB.folds, `B ${round}巡目`).toEqual([])
    }

    // 畳みのあとに作った行がちゃんと相手へ届く（＝止まっていない）
    insertTag(DB_A, {
      id: "tag-science",
      name: "理科",
      updatedAt: isoMinutesAgo(1),
    })
    await syncRound("A 追加の送出", syncA)
    await syncRound("B 追加の取り込み", syncB)

    expect(tagRows(DB_B)).toEqual([
      { id: "tag-japanese", name: "国語" },
      { id: "tag-science", name: "理科" },
    ])
  })
})

describe("畳まれた行の子（採点データ）", () => {
  /**
   * 同じ試験・同じ生徒の ExamStudent を、両端末が別々の id で作った状態を仕込む。
   * `@@unique([examId, studentId])` があるので2行は同居できず、必ず畳まれる。
   * 各端末はその ExamStudent にぶら下げた QuestionScore を1件ずつ持っている。
   */
  const seedExamStudentCollision = async (): Promise<void> => {
    const skeleton = seedScoringSkeleton(DB_A, isoMinutesAgo(60))
    await syncRound("A 骨組みの送出", syncA)
    await syncRound("B 骨組みの取り込み", syncB)
    expect(countRows(DB_B, "CropRegion")).toBe(1)

    // A: 自分で受験生徒を作って採点した（古い方）
    insertExamStudent(DB_A, {
      id: "exam-student-a",
      examId: skeleton.examId,
      studentId: skeleton.studentId,
      updatedAt: isoMinutesAgo(40),
    })
    insertQuestionScore(DB_A, {
      id: "question-score-a",
      cropRegionId: skeleton.cropRegionId,
      examStudentId: "exam-student-a",
      userId: skeleton.userId,
      status: "correct",
      updatedAt: isoMinutesAgo(40),
    })

    // B: 相手を知らないまま、同じ生徒を受験生徒として作って採点した（新しい方）
    insertExamStudent(DB_B, {
      id: "exam-student-b",
      examId: skeleton.examId,
      studentId: skeleton.studentId,
      updatedAt: isoMinutesAgo(20),
    })
    insertQuestionScore(DB_B, {
      id: "question-score-b",
      cropRegionId: skeleton.cropRegionId,
      examStudentId: "exam-student-b",
      userId: skeleton.userId,
      status: "incorrect",
      updatedAt: isoMinutesAgo(20),
    })
  }

  it("受験生徒が1行へ畳まれても、両端末の採点が勝った行へ移って消えない", async () => {
    await seedExamStudentCollision()

    // A が自分の行を NAS へ出す（syncNow はコピーの送出と取り込みを両方やる）
    await syncRound("A 送出", syncA)

    // ローカルが勝つ側（B）— 届いた exam-student-a が負ける。
    // 敗者の行を B は元々持っていないので removedLocalRow は false
    const foldOnB = await syncRound("B 畳み", syncB)
    expect(foldOnB.folds).toEqual([
      {
        tableName: "ExamStudent",
        losingId: "exam-student-a",
        winningId: "exam-student-b",
        removedLocalRow: false,
      },
    ])
    // 敗者にぶら下がっていた採点は、B のローカルでも勝者へ向け直されて入る
    expect(questionScoreRows(DB_B)).toEqual([
      {
        id: "question-score-a",
        examStudentId: "exam-student-b",
        status: "correct",
      },
      {
        id: "question-score-b",
        examStudentId: "exam-student-b",
        status: "incorrect",
      },
    ])

    // 届いた行が勝つ側（A）— ローカルの exam-student-a が消え、その採点は移る
    const foldOnA = await syncRound("A 畳み", syncA)
    expect(foldOnA.folds).toEqual([
      {
        tableName: "ExamStudent",
        losingId: "exam-student-a",
        winningId: "exam-student-b",
        removedLocalRow: true,
      },
    ])

    // 残りを行き渡らせる
    for (let round = 1; round <= 2; round++) {
      await syncRound(`A ${round}巡目`, syncA)
      await syncRound(`B ${round}巡目`, syncB)
    }

    const clients: Array<{ label: string; dbPath: string }> = [
      { label: "A", dbPath: DB_A },
      { label: "B", dbPath: DB_B },
    ]
    for (const { label, dbPath } of clients) {
      expect(examStudentRows(dbPath), `client-${label}`).toEqual([
        {
          id: "exam-student-b",
          examId: "exam-collision",
          studentId: "student-collision",
        },
      ])
      // 2件とも生きていて、どちらも勝った受験生徒にぶら下がっている
      expect(questionScoreRows(dbPath), `client-${label}`).toEqual([
        {
          id: "question-score-a",
          examStudentId: "exam-student-b",
          status: "correct",
        },
        {
          id: "question-score-b",
          examStudentId: "exam-student-b",
          status: "incorrect",
        },
      ])
    }
  })

  it("採点データを巻き込む畳みのあとも同期が止まらない", async () => {
    await seedExamStudentCollision()

    for (let round = 1; round <= 4; round++) {
      const resultA = await syncRound(`A ${round}巡目`, syncA)
      const resultB = await syncRound(`B ${round}巡目`, syncB)
      expect(resultA.clientsSynced, `A ${round}巡目`).toBe(1)
      expect(resultB.clientsSynced, `B ${round}巡目`).toBe(1)
      // 3巡目以降は新たな畳みが起きない（起き続けるなら収束していない）
      if (round >= 3) {
        expect(resultA.folds, `A ${round}巡目`).toEqual([])
        expect(resultB.folds, `B ${round}巡目`).toEqual([])
      }
    }

    // 畳みのあとに付けた採点が相手へ届く
    insertQuestionScore(DB_B, {
      id: "question-score-after-fold",
      cropRegionId: "crop-region-collision",
      examStudentId: "exam-student-b",
      userId: "user-collision",
      status: "partial",
      updatedAt: isoMinutesAgo(1),
    })
    await syncRound("B 追加の送出", syncB)
    await syncRound("A 追加の取り込み", syncA)

    expect(questionScoreRows(DB_A).map((row) => row.id)).toEqual([
      "question-score-a",
      "question-score-after-fold",
      "question-score-b",
    ])
    expect(countRows(DB_A, "ExamStudent")).toBe(1)
  })
})
