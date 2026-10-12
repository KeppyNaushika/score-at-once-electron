/**
 * 類型評価の設問の Excel 出力（docs/vlm-grading-design.md §4-8-5・§4-8-8 の S4）。
 *
 * - 出力データは設問が使っている組を、類型の並び順で同梱する（点数は serialize 済み）
 * - 正誤一覧は類型を見せ方に従って出し、点数一覧は点にならない採点を 0 点でなく空欄にする
 * - 問題分析は正答率を出さず（平均にも入れない）、類型ごとの人数を 0 人の類型も含めて出す
 * - S-P 表には入れない
 */

import * as ExcelJS from "exceljs"
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

import { fetchExportData } from "@/electron-src/lib/export/excel/dataFetcher"
import { createItemAnalysisSheet } from "@/electron-src/lib/export/excel/itemAnalysisSheetCreator"
import {
  createResultSheet,
  createScoreSheet,
} from "@/electron-src/lib/export/excel/sheetCreators"
import { createSpTableSheet } from "@/electron-src/lib/export/excel/spTableSheetCreator"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createFullTestExam>>
/** 類型 A=12点（配点 10 を超える）・B=6点・C=2点（B・C は誰にも付けない） */
let levelA: { id: string }

beforeEach(async () => {
  await cleanupTestDatabase()
  // 設問は4問・各10点。1問目だけを類型評価にする
  fixture = await createFullTestExam(testPrisma, {
    studentCount: 3,
    includeScores: false,
  })
  const scoreScale = await testPrisma.scoreScale.create({
    data: {
      examId: fixture.exam.id,
      name: "記述",
      levels: {
        // 作る順と並び順を逆にして、並び順で読むことを確かめる
        create: [
          { label: "C", score: 2, sortOrder: 2 },
          { label: "B", score: 6, sortOrder: 1 },
          { label: "A", score: 12, sortOrder: 0 },
        ],
      },
    },
    include: { levels: { orderBy: { sortOrder: "asc" } } },
  })
  ;[levelA] = scoreScale.levels
  await testPrisma.cropRegion.update({
    where: { id: fixture.cropRegions[0].id },
    data: { scoringMethod: "scale", scoreScaleId: scoreScale.id },
  })
})

afterAll(async () => {
  await cleanupTestDatabase()
  await testPrisma.$disconnect()
  await disconnectTestPrisma()
})

const writeScore = (
  studentIndex: number,
  cropRegionIndex: number,
  data: { status: string; scaleLevelId?: string }
) =>
  testPrisma.questionScore.create({
    data: {
      cropRegionId: fixture.cropRegions[cropRegionIndex].id,
      examStudentId: fixture.examStudents[studentIndex].id,
      userId: fixture.user.id,
      status: data.status,
      scaleLevelId: data.scaleLevelId,
    },
  })

/** 1・2人目に A、3人目に方式と合わない正答。点の設問（問2）は全員採点する */
const writeScores = async () => {
  await writeScore(0, 0, { status: "evaluated", scaleLevelId: levelA.id })
  await writeScore(1, 0, { status: "evaluated", scaleLevelId: levelA.id })
  await writeScore(2, 0, { status: "correct" })
  await writeScore(0, 1, { status: "correct" })
  await writeScore(1, 1, { status: "incorrect" })
  await writeScore(2, 1, { status: "correct" })
}

/** シートの中から、1列目が label の行を探す */
const findRow = (worksheet: ExcelJS.Worksheet, label: string) => {
  const rows = worksheet.getRows(1, worksheet.rowCount) ?? []
  const row = rows.find((candidate) => candidate.getCell(1).value === label)
  if (!row) throw new Error(`${label} の行がありません`)
  return row
}

describe("出力データ", () => {
  it("設問が使っている組を類型の並び順で同梱し、点数は数になっている", async () => {
    await writeScores()
    const exportData = await fetchExportData(fixture.exam.id, [])
    expect(exportData.scoreScales).toHaveLength(1)
    const levels = exportData.scoreScales[0].levels
    expect(levels.map((level) => level.label)).toEqual(["A", "B", "C"])
    expect(levels.map((level) => level.score)).toEqual([12, 6, 2])

    const firstStudent = exportData.scoringData.find(
      (scoringData) => scoringData.examStudentId === fixture.examStudents[0].id
    )!
    expect(firstStudent.scores[0]).toMatchObject({
      scoringMethod: "scale",
      scaleLevel: { id: levelA.id, label: "A", score: 12 },
    })
  })
})

describe("Excel のシート", () => {
  it("正誤一覧は類型を見せ方に従い、点数一覧は点にならない採点を空欄にする", async () => {
    await writeScores()
    const exportData = await fetchExportData(fixture.exam.id, [])
    const workbook = new ExcelJS.Workbook()
    const resultSheet = await createResultSheet(
      workbook,
      exportData.questionRegions,
      exportData.subtotalColumns,
      exportData.scoringData,
      "label_points"
    )
    const scoreSheet = await createScoreSheet(
      workbook,
      exportData.questionRegions,
      exportData.subtotalColumns,
      exportData.scoringData
    )
    // 問1の列 = 9（合計の次）+ 小計列の数
    const firstQuestionColumn = 9 + exportData.subtotalColumns.length
    const studentRow = (worksheet: ExcelJS.Worksheet, studentIndex: number) =>
      worksheet.getRow(
        2 +
          exportData.scoringData.findIndex(
            (scoringData) =>
              scoringData.examStudentId ===
              fixture.examStudents[studentIndex].id
          )
      )

    expect(studentRow(resultSheet, 0).getCell(firstQuestionColumn).value).toBe(
      "A (12)"
    )
    expect(studentRow(scoreSheet, 0).getCell(firstQuestionColumn).value).toBe(
      12
    )
    // 方式と合わない正答は未採点と同じ — 正誤一覧も点数一覧も空欄（記号も 0 点も出さない）
    expect(studentRow(resultSheet, 2).getCell(firstQuestionColumn).value).toBe(
      ""
    )
    expect(studentRow(scoreSheet, 2).getCell(firstQuestionColumn).value).toBe(
      ""
    )
  })

  it("問題分析は正答率を出さず、類型ごとの人数を 0 人の類型も含めて出す", async () => {
    await writeScores()
    const exportData = await fetchExportData(fixture.exam.id, [])
    const workbook = new ExcelJS.Workbook()
    const worksheet = await createItemAnalysisSheet(
      workbook,
      exportData.questionRegions,
      exportData.scoreScales,
      exportData.scoringData
    )
    const scaleRow = findRow(worksheet, "問1")
    expect(scaleRow.getCell(3).value).toBe("—")
    expect(scaleRow.getCell(7).value).toBe("A 2・B 0・C 0")
    // 点の設問の正答率は今まで通り。平均は点の設問（問2〜問4。問3・問4 は未採点で 0）だけから出す
    const pointRow = findRow(worksheet, "問2")
    expect(pointRow.getCell(3).value).toBeCloseTo(66.7, 1)
    expect(pointRow.getCell(7).value).toBe("")
    expect(findRow(worksheet, "平均").getCell(3).value).toBeCloseTo(22.2, 1)
  })

  it("点の設問に残った類型は未採点と同じで、問題分析も手を付けていない設問と同じに読む", async () => {
    await writeScores()
    // 問3 にだけ方式と合わない類型を残す（問4 は誰も採点していない）
    await writeScore(0, 2, { status: "evaluated", scaleLevelId: levelA.id })
    const exportData = await fetchExportData(fixture.exam.id, [])
    const firstStudent = exportData.scoringData.find(
      (scoringData) => scoringData.examStudentId === fixture.examStudents[0].id
    )!
    expect(firstStudent.scores[2]).toMatchObject({
      status: "unscored",
      score: null,
      scaleLevel: null,
    })

    const workbook = new ExcelJS.Workbook()
    const worksheet = await createItemAnalysisSheet(
      workbook,
      exportData.questionRegions,
      exportData.scoreScales,
      exportData.scoringData
    )
    const leftoverRow = findRow(worksheet, "問3")
    const untouchedRow = findRow(worksheet, "問4")
    expect(leftoverRow.getCell(3).value).toBe(untouchedRow.getCell(3).value)
    expect(leftoverRow.getCell(4).value).toBe(untouchedRow.getCell(4).value)
  })

  it("S-P 表に類型評価の設問を入れない", async () => {
    await writeScores()
    const exportData = await fetchExportData(fixture.exam.id, [])
    const workbook = new ExcelJS.Workbook()
    const worksheet = await createSpTableSheet(workbook, exportData.scoringData)
    const headerRow = findRow(worksheet, "生徒")
    const headerLabels = (
      Array.isArray(headerRow.values) ? headerRow.values : []
    ).filter((value) => typeof value === "string")
    expect(headerLabels).not.toContain("問1")
    expect(headerLabels).toContain("問2")
  })
})
