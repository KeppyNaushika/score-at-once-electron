/**
 * 小計まわりの UNIQUE を「uuid どうしの組だけ」に揃えたこと
 * （20260823120000_subtotal_uniques_by_uuid）を、新規インストールの経路で確かめる。
 *
 * 見るのは3つ:
 * - 外した2件（Subtotal(subtotalGroupId, name) / CourseworkLetterScale(courseworkItemId, label)）
 *   を覆うユニーク索引が1本も無く、同じ名前・同じ評語の行を別 id で2つ作れる
 * - 張った1件（CropSubtotal(cropRegionId, subtotalId, assignmentType)）が DB で重複を止め、
 *   区分が違えば別の行として通る
 * - 巻き添えを出していない（CourseworkScore の (評価項目, 対象者) の unique は残っている）
 *
 * Subtotal は表制約の UNIQUE（sqlite_autoindex）で持っている DB があり、DROP INDEX が
 * 効かないので migration が表を作り直している。**作り直しで子を落としていないこと**も
 * ここで見る（DROP TABLE が ON DELETE CASCADE を発火させると割り当てが消える）。
 *
 * 実 DB には触らず、空DBへ init＋全マイグレーションを昇順適用したものを相手にする。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { deployPendingMigrations } from "../../electron-src/lib/prisma/schema/migrationDeployer"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_ROOT = path.join(os.tmpdir(), "subtotal-uniques-by-uuid")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const REAL_MIGRATIONS = path.resolve(__dirname, "../../prisma/migrations")

// deployPendingMigrations の接続先を、この一時DBへ向ける（既定では data/database.db を掴む）
const chainPrisma = { current: createPrismaClientForPath(DB_PATH) }
vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () => DB_PATH,
  createSharedPrismaClient: () => chainPrisma.current,
  initializeDatabase: () => "existing",
}))

type SqliteDatabase = InstanceType<typeof Database>

const withDatabase = <T>(operation: (db: SqliteDatabase) => T): T => {
  const db = new Database(DB_PATH)
  try {
    return operation(db)
  } finally {
    db.close()
  }
}

interface IndexListRow {
  indexName: string
  isUnique: number
}

const isIndexListRow = (row: unknown): row is IndexListRow =>
  typeof row === "object" &&
  row !== null &&
  "indexName" in row &&
  typeof row.indexName === "string" &&
  "isUnique" in row &&
  typeof row.isUnique === "number"

/**
 * ある表のある列を覆う索引を、ユニークかどうかつきで列挙する。
 * 表制約に付いた暗黙の索引（sqlite_autoindex）も pragma_index_list に出るので、
 * 「DROP INDEX し忘れた」以外の形で制約が残っていても見つかる。
 */
const indexesOnColumn = (
  tableName: string,
  columnName: string
): { name: string; unique: boolean }[] =>
  withDatabase((db) =>
    db
      .prepare(
        `SELECT il."name" AS indexName, il."unique" AS isUnique
           FROM pragma_index_list(?) il, pragma_index_info(il."name") ii
          WHERE ii."name" = ?
          ORDER BY il."name"`
      )
      .all(tableName, columnName)
      .filter(isIndexListRow)
      .map((index) => ({ name: index.indexName, unique: index.isUnique === 1 }))
  )

/** 小計点グループ1つと、その中の項目1つ */
const createSubtotalGroupWithSubtotal = async (name: string) => {
  const prisma = chainPrisma.current
  const subtotalGroup = await prisma.subtotalGroup.create({
    data: { name: `${name}グループ` },
  })
  const subtotal = await prisma.subtotal.create({
    data: { subtotalGroupId: subtotalGroup.id, name, order: 0 },
  })
  return { subtotalGroup, subtotal }
}

/** 採点領域1つ（試験→ページ→領域） */
const createCropRegion = async () => {
  const prisma = chainPrisma.current
  const exam = await prisma.exam.create({ data: { examName: "期末考査" } })
  const examPage = await prisma.examPage.create({
    data: { examId: exam.id, pageNumber: 1 },
  })
  return await prisma.cropRegion.create({
    data: {
      examPageId: examPage.id,
      label: "大問1",
      type: "QUESTION_ANSWER",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      points: 10,
    },
  })
}

/** 試験外成績資料の評価項目1つ */
const createCourseworkItem = async () => {
  const prisma = chainPrisma.current
  const coursework = await prisma.coursework.create({
    data: { name: "レポート" },
  })
  return await prisma.courseworkItem.create({
    data: {
      courseworkId: coursework.id,
      name: "第1回",
      order: 0,
      maxScore: 100,
      inputMode: "letter",
    },
  })
}

beforeAll(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(TEST_ROOT, { recursive: true })

  bootstrapSchema(DB_PATH)
  const baselinePrisma = createPrismaClientForPath(DB_PATH)
  try {
    await createBaseline(baselinePrisma)
  } finally {
    await baselinePrisma.$disconnect()
  }
  deployPendingMigrations({ migrationsDir: REAL_MIGRATIONS })

  chainPrisma.current = createPrismaClientForPath(DB_PATH)
})

afterAll(async () => {
  await chainPrisma.current.$disconnect()
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("小計まわりの UNIQUE を uuid の組だけにする", () => {
  it("小計名・評語を覆うユニーク索引が残っていない", () => {
    expect(indexesOnColumn("Subtotal", "name")).toEqual([])
    // 評価項目ごとの索引は残す（ユニークではない）
    expect(indexesOnColumn("CourseworkLetterScale", "label")).toEqual([])
    expect(
      indexesOnColumn("CourseworkLetterScale", "courseworkItemId")
    ).toEqual([
      { name: "CourseworkLetterScale_courseworkItemId_idx", unique: false },
    ])
  })

  it("CropSubtotal の (領域, 小計, 区分) にユニーク索引が張られている", () => {
    expect(indexesOnColumn("CropSubtotal", "assignmentType")).toEqual([
      {
        name: "CropSubtotal_cropRegionId_subtotalId_assignmentType_key",
        unique: true,
      },
    ])
  })

  it("残すと決めた UNIQUE を巻き添えにしていない", () => {
    // 資料の点数は「対象者×評価項目で1行」。同値になるのは必ず同じもの
    expect(
      indexesOnColumn("CourseworkScore", "courseworkStudentId")
    ).toContainEqual({
      name: "CourseworkScore_courseworkItemId_courseworkStudentId_key",
      unique: true,
    })
  })

  it("同じグループに同じ名前の小計を、別 id で2つ作れる", async () => {
    const prisma = chainPrisma.current
    const { subtotalGroup, subtotal } =
      await createSubtotalGroupWithSubtotal("漢字")

    const sameNameSubtotal = await prisma.subtotal.create({
      data: { subtotalGroupId: subtotalGroup.id, name: "漢字", order: 1 },
    })

    expect(sameNameSubtotal.id).not.toBe(subtotal.id)
    expect(
      await prisma.subtotal.count({
        where: { subtotalGroupId: subtotalGroup.id, name: "漢字" },
      })
    ).toBe(2)
  })

  it("同じ評価項目に同じ評語の刻みを、別 id で2つ作れる", async () => {
    const prisma = chainPrisma.current
    const courseworkItem = await createCourseworkItem()

    const first = await prisma.courseworkLetterScale.create({
      data: { courseworkItemId: courseworkItem.id, label: "A", score: 100 },
    })
    const second = await prisma.courseworkLetterScale.create({
      data: { courseworkItemId: courseworkItem.id, label: "A", score: 90 },
    })

    expect(second.id).not.toBe(first.id)
    expect(
      await prisma.courseworkLetterScale.count({
        where: { courseworkItemId: courseworkItem.id, label: "A" },
      })
    ).toBe(2)
  })

  it("同じマスの割り当ては2行目を作れない（区分が違えば作れる）", async () => {
    const prisma = chainPrisma.current
    const { subtotal } = await createSubtotalGroupWithSubtotal("読解")
    const cropRegion = await createCropRegion()

    await prisma.cropSubtotal.create({
      data: {
        cropRegionId: cropRegion.id,
        subtotalId: subtotal.id,
        assignmentType: "QUESTION_ASSIGNMENT",
      },
    })

    await expect(
      prisma.cropSubtotal.create({
        data: {
          cropRegionId: cropRegion.id,
          subtotalId: subtotal.id,
          assignmentType: "QUESTION_ASSIGNMENT",
        },
      })
    ).rejects.toThrow()

    // 区分が違えば別の事実（設問の足し込みと、小計欄がどの小計を表示するか）
    await prisma.cropSubtotal.create({
      data: {
        cropRegionId: cropRegion.id,
        subtotalId: subtotal.id,
        assignmentType: "SUBTOTAL_DEFINITION",
      },
    })

    expect(
      await prisma.cropSubtotal.count({
        where: { cropRegionId: cropRegion.id, subtotalId: subtotal.id },
      })
    ).toBe(2)
  })

  it("Subtotal の作り直しで子を落としていない", async () => {
    // migration は Subtotal を DROP TABLE して作り直す。foreign_keys=ON のままだと
    // 子の ON DELETE CASCADE が発火して割り当てとデータソースが消える
    const prisma = chainPrisma.current
    const { subtotal } = await createSubtotalGroupWithSubtotal("作文")
    const cropRegion = await createCropRegion()
    const cropSubtotal = await prisma.cropSubtotal.create({
      data: {
        cropRegionId: cropRegion.id,
        subtotalId: subtotal.id,
        assignmentType: "QUESTION_ASSIGNMENT",
      },
    })

    // 子から親を辿れる＝作り直した表への外部キーが生きている
    const withSubtotal = await prisma.cropSubtotal.findUniqueOrThrow({
      where: { id: cropSubtotal.id },
      include: { subtotal: true },
    })
    expect(withSubtotal.subtotal.id).toBe(subtotal.id)

    // 親を消せば子も消える（カスケードの向きは保たれている）
    await prisma.subtotal.delete({ where: { id: subtotal.id } })
    expect(
      await prisma.cropSubtotal.findUnique({ where: { id: cropSubtotal.id } })
    ).toBeNull()
  })

  it("外部キーの参照先が1つも壊れていない", () => {
    const violations = withDatabase((db) =>
      db.prepare("PRAGMA foreign_key_check").all()
    )
    expect(violations).toEqual([])
  })
})
