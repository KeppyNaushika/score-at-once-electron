/**
 * 2端末同期の結合テスト（本物の sqlite-nas-sync × 本物の schema.prisma）
 *
 * ライブラリ側のテストは自前の小さなスキーマで書かれている。
 * ここで確かめるのは **アプリのスキーマを繋いだとき**に同じ結末になるかで、
 * 具体的には `Tag.name` の UNIQUE と `ExamStudent(examId, studentId)` の UNIQUE が
 * 起こす「かぶり」を、実機2台を用意せずに再現する。
 *
 * かぶり = 別の id なのに同じユニークキーを持つ行が出会うこと。sqlite-nas-sync は
 * 版の順序の強い方をアプリの表に置き、弱い方を**隠す**（v0.19.0 までは弱い方を消して
 * 子を付け替える「畳み」だった）。隠れた行の事実は残り、かぶりが解ければ表へ戻る。
 * ただし**勝っている行を消したときは、隠れている方にも削除が書かれる**（v0.21.0 の原則3。
 * 利用者から見れば1行なので、片方だけ残ると消したはずのものが姿を変えて現れる）。
 * ここで踏む壊れ方は3つ:
 *
 * - **名前を直しただけで同期が止まる** — 取り込みがユニーク違反で落ちる（`blockingWarnings`）
 * - **採点データが見えなくなる** — 隠れた受験生徒にぶら下がる採点が、表に置けず外れる
 *   （`Unplaceable` の警告と行数で見る）
 * - **隠れた行が戻らない** — かぶりが解けても、隠れていた行が表に現れない
 *
 * 画面は通していない。隠れた・戻ったことが renderer と監査ログへ出る経路は
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
  insertExamStudent,
  insertQuestionScore,
  insertTag,
  isoMinutesAgo,
  questionScoreRows,
  renameTag,
  seedScoringSkeleton,
  tagRows,
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
 * 1巡回す。**同期を止める警告・行が表から外れた警告が出ていないこと**を毎回見るのが
 * この関数の主目的で、「かぶりは片付いたが、その先で行が黙って消えた」状態を通過させない。
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

describe("かぶり（別 id・同一ユニークキー）", () => {
  /**
   * A が持っていたタグを改名し、B は独立に同じ名前のタグを作る。
   * `Tag.name` は UNIQUE なので、この2行は同時には表示できない。
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

  it("改名がぶつかると片方が隠れ、両端末が同じ答えへ収束する", async () => {
    await seedTagNameCollision()

    // B 側でかぶりが起きる（届いた tag-math の改名が、ローカルの新しい tag-japanese に負ける）
    const hideResult = await syncRound("B かぶり", syncB)
    expect(hideResult.folds).toEqual([
      { tableName: "Tag", losingId: "tag-math", winningId: "tag-japanese" },
    ])
    // B が表示していた「数学」（tag-math）は表から外れる。隠れた行も消えた数に入る
    expect(hideResult.deleted).toBe(1)
    expect(tagRows(DB_B)).toEqual([{ id: "tag-japanese", name: "国語" }])

    // A は自分の tag-math を表示している。B の tag-japanese が届いて初めて揃う
    await syncRound("B 送出", syncB)
    const hideOnA = await syncRound("A かぶりの受け取り", syncA)
    expect(hideOnA.folds).toEqual([
      { tableName: "Tag", losingId: "tag-math", winningId: "tag-japanese" },
    ])

    expect(tagRows(DB_A)).toEqual([{ id: "tag-japanese", name: "国語" }])
    expect(tagRows(DB_B)).toEqual([{ id: "tag-japanese", name: "国語" }])
  })

  it("隠れた行ができても次の巡回が正常に走り、あとの変更も届く", async () => {
    await seedTagNameCollision()

    await syncRound("B かぶり", syncB)
    await syncRound("B 送出", syncB)
    await syncRound("A かぶりの受け取り", syncA)

    // かぶりの直後から3巡。新たに隠れる行が出続けたら（= 端末どうしが相手を隠し合って
    // いたら）収束していない。警告は syncRound が毎回見ている
    for (let round = 1; round <= 3; round++) {
      const resultA = await syncRound(`A ${round}巡目`, syncA)
      const resultB = await syncRound(`B ${round}巡目`, syncB)
      expect(resultA.clientsSynced, `A ${round}巡目`).toBe(1)
      expect(resultB.clientsSynced, `B ${round}巡目`).toBe(1)
      expect(resultA.folds, `A ${round}巡目`).toEqual([])
      expect(resultB.folds, `B ${round}巡目`).toEqual([])
    }

    // かぶりのあとに作った行がちゃんと相手へ届く（＝止まっていない）
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

  it("表示している方を消すと、隠れていた方も一緒に消える", async () => {
    await seedTagNameCollision()
    await syncRound("B かぶり", syncB)
    await syncRound("B 送出", syncB)
    await syncRound("A かぶりの受け取り", syncA)

    // B で勝った「国語」（tag-japanese）を消す。かぶって隠れている2行は利用者から見れば
    // 1つのタグなので、v0.21.0 からは隠れていた tag-math にも削除が書かれる（原則3）。
    // v0.20.0 では tag-math だけが表へ戻り、消したはずの名前のタグが残っていた。
    deleteTag(DB_B, "tag-japanese")
    const deleteOnB = await syncRound("B 削除の送出", syncB)
    expect(deleteOnB.restores).toEqual([])
    expect(tagRows(DB_B)).toEqual([])

    const deleteOnA = await syncRound("A 削除の受け取り", syncA)
    expect(deleteOnA.restores).toEqual([])
    expect(tagRows(DB_A)).toEqual([])
  })

  it("表示している方の名前を変えると、隠れていた行が両端末で表示に戻る", async () => {
    await seedTagNameCollision()
    await syncRound("B かぶり", syncB)
    await syncRound("B 送出", syncB)
    await syncRound("A かぶりの受け取り", syncA)

    // 勝っている tag-japanese を別の名前にすると、かぶりが解ける。隠れていた tag-math の
    // 事実は残っているので、次の作り直しで「国語」として表へ戻る
    renameTag(DB_B, {
      id: "tag-japanese",
      name: "現代文",
      updatedAt: isoMinutesAgo(1),
    })
    const restoreOnB = await syncRound("B 改名の送出", syncB)
    expect(restoreOnB.restores).toEqual([
      { tableName: "Tag", losingId: "tag-math", winningId: "tag-japanese" },
    ])
    expect(tagRows(DB_B)).toEqual([
      { id: "tag-japanese", name: "現代文" },
      { id: "tag-math", name: "国語" },
    ])

    const restoreOnA = await syncRound("A 改名の受け取り", syncA)
    expect(restoreOnA.restores).toEqual([
      { tableName: "Tag", losingId: "tag-math", winningId: "tag-japanese" },
    ])
    expect(tagRows(DB_A)).toEqual([
      { id: "tag-japanese", name: "現代文" },
      { id: "tag-math", name: "国語" },
    ])
  })
})

describe("隠れた行の子（採点データ）", () => {
  /**
   * 同じ試験・同じ生徒の ExamStudent を、両端末が別々の id で作った状態を仕込む。
   * `@@unique([examId, studentId])` があるので2行は同時に表示できず、片方が隠れる。
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

  it("受験生徒の片方が隠れても、両端末の採点は表示している受験生徒の下に見えて消えない", async () => {
    await seedExamStudentCollision()

    // A が自分の行を NAS へ出す（syncNow はコピーの送出と取り込みを両方やる）
    await syncRound("A 送出", syncA)

    // ローカルが勝つ側（B）— 届いた exam-student-a が隠れる
    const hideOnB = await syncRound("B かぶり", syncB)
    expect(hideOnB.folds).toEqual([
      {
        tableName: "ExamStudent",
        losingId: "exam-student-a",
        winningId: "exam-student-b",
      },
    ])
    // 隠れた受験生徒にぶら下がる採点は、表示上は勝った受験生徒の下に置かれる
    // （ライブラリが外部キーを勝者へ読み替える。事実の側の examStudentId は書き換えない）
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

    // 届いた行が勝つ側（A）— ローカルの exam-student-a が隠れる
    const hideOnA = await syncRound("A かぶり", syncA)
    expect(hideOnA.folds).toEqual([
      {
        tableName: "ExamStudent",
        losingId: "exam-student-a",
        winningId: "exam-student-b",
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
      // 2件とも見えていて、どちらも表示している受験生徒にぶら下がっている
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

  it("採点データを巻き込むかぶりのあとも同期が止まらない", async () => {
    await seedExamStudentCollision()

    for (let round = 1; round <= 4; round++) {
      const resultA = await syncRound(`A ${round}巡目`, syncA)
      const resultB = await syncRound(`B ${round}巡目`, syncB)
      expect(resultA.clientsSynced, `A ${round}巡目`).toBe(1)
      expect(resultB.clientsSynced, `B ${round}巡目`).toBe(1)
      // 3巡目以降は新たに隠れる行が出ない（出続けるなら収束していない）
      if (round >= 3) {
        expect(resultA.folds, `A ${round}巡目`).toEqual([])
        expect(resultB.folds, `B ${round}巡目`).toEqual([])
      }
    }

    // かぶりのあとに付けた採点が相手へ届く
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
