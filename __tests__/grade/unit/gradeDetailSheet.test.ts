/**
 * Excel「詳細」シートの列構成（createDetailSheet）の検証。
 *
 * 守りたい不変条件は「ヘッダー行と各生徒の行のセル数が常に一致すること」。
 * 列は評価項目の dataSources が決めるべきもので、特定の生徒の sourceScores から
 * 導いてはならない — 除外された生徒は sourceScores が空になるため、基準にした生徒が
 * 除外だと行のほうが長くなり、以降の点数が別の評価項目のヘッダーの下へずれる。
 * ずれた表は「整った表」に見えるので、気づかれないまま誤読される。
 */

import * as ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"

import { createDetailSheet } from "@/electron-src/lib/export/gradeExcel/gradeSheetCreator"
import type {
  GradeCalculationResult,
  GradeItemResult,
  SourceScoreResult,
  StudentGradeResult,
} from "@/types/grade.types"

const GRADE_ITEMS: GradeCalculationResult["gradeItems"] = [
  {
    id: "gi-knowledge",
    name: "知識・技能",
    order: 0,
    dataSources: [
      { id: "ds-mid", name: "中間" },
      { id: "ds-final", name: "期末" },
    ],
    boundaries: [],
  },
  {
    id: "gi-thinking",
    name: "思考・判断・表現",
    order: 1,
    dataSources: [{ id: "ds-report", name: "レポート" }],
    boundaries: [],
  },
]

function makeSourceScore(
  dataSourceId: string,
  dataSourceName: string,
  weightedScore: number
): SourceScoreResult {
  return {
    dataSourceId,
    dataSourceName,
    type: "coursework",
    rawScore: weightedScore,
    maxScore: 100,
    weight: 50,
    weightedScore,
    isEstimated: false,
    estimation: null,
    letterValue: null,
    adjustment: null,
    adjustmentReason: null,
    comment: null,
  }
}

function makeItemResult(
  gradeItem: GradeCalculationResult["gradeItems"][number],
  options: { excluded?: boolean } = {}
): GradeItemResult {
  const excluded = options.excluded ?? false
  return {
    gradeItemId: gradeItem.id,
    gradeItemName: gradeItem.name,
    isExcluded: excluded,
    isAllMissing: false,
    // 除外された生徒は算出側で sourceScores が空になる（gradeCalculator の除外分岐）
    sourceScores: excluded
      ? []
      : gradeItem.dataSources.map((dataSource, index) =>
          makeSourceScore(dataSource.id, dataSource.name, 10 + index)
        ),
    weightedScore: excluded ? null : 42,
    weightedMaxScore: excluded ? 0 : 100,
    percentage: excluded ? null : 42,
    gradeLabel: excluded ? null : "B",
    originalGradeLabel: excluded ? null : "B",
    overrideGradeLabel: null,
    frozen: null,
  }
}

function makeStudent(
  id: string,
  excludedItemIds: string[] = []
): StudentGradeResult {
  return {
    gradeStudentId: `gs:${id}`,
    studentId: id,
    studentNumber: id,
    lastName: id,
    firstName: "",
    attendanceNumber: 1,
    className: null,
    gradeItemResults: GRADE_ITEMS.map((gradeItem) =>
      makeItemResult(gradeItem, {
        excluded: excludedItemIds.includes(gradeItem.id),
      })
    ),
  }
}

function makeResult(students: StudentGradeResult[]): GradeCalculationResult {
  return {
    gradeId: "g1",
    gradeName: "1学期成績",
    classNames: [],
    gradeItems: GRADE_ITEMS,
    students,
  }
}

/** 詳細シートを生成し、ヘッダー行と各データ行のセル数を返す */
function cellCounts(result: GradeCalculationResult): {
  header: number
  rows: number[]
} {
  const workbook = new ExcelJS.Workbook()
  createDetailSheet(workbook, result)
  const sheet = workbook.getWorksheet("詳細")!
  const header = sheet.getRow(1).cellCount
  const rows: number[] = []
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    rows.push(sheet.getRow(rowNumber).cellCount)
  }
  return { header, rows }
}

describe("createDetailSheet: 列構成", () => {
  // 番号 + 氏名 + (知識2ソース + 合計) + (思考1ソース + 合計) = 7
  const EXPECTED_COLUMNS = 7

  it("ヘッダーは評価項目の dataSources から決まる", () => {
    const workbook = new ExcelJS.Workbook()
    createDetailSheet(workbook, makeResult([makeStudent("s1")]))
    const headerRow = workbook.getWorksheet("詳細")!.getRow(1)

    expect(headerRow.values).toEqual([
      undefined, // ExcelJS は 1-indexed で先頭が空く
      "番号",
      "氏名",
      "知識・技能/中間",
      "知識・技能/期末",
      "知識・技能 合計",
      "思考・判断・表現/レポート",
      "思考・判断・表現 合計",
    ])
  })

  it("1人目の生徒が除外でも、ヘッダーと全行のセル数が一致する", () => {
    // 回帰の核: 以前はヘッダーを students[0] から導いていたため、1人目が除外だと
    // その項目のヘッダーが「合計」1列に縮み、非除外の生徒の行だけが長くなっていた。
    const { header, rows } = cellCounts(
      makeResult([
        makeStudent("s1", ["gi-knowledge"]), // 1人目が知識・技能で除外
        makeStudent("s2"),
        makeStudent("s3"),
      ])
    )

    expect(header).toBe(EXPECTED_COLUMNS)
    expect(rows).toEqual([EXPECTED_COLUMNS, EXPECTED_COLUMNS, EXPECTED_COLUMNS])
  })

  it("全生徒が除外でもヘッダーと行のセル数が一致する", () => {
    const { header, rows } = cellCounts(
      makeResult([
        makeStudent("s1", ["gi-knowledge", "gi-thinking"]),
        makeStudent("s2", ["gi-knowledge", "gi-thinking"]),
      ])
    )

    expect(header).toBe(EXPECTED_COLUMNS)
    expect(rows).toEqual([EXPECTED_COLUMNS, EXPECTED_COLUMNS])
  })

  it("1人目が除外でも、非除外の生徒の点数が正しい列に載る", () => {
    const workbook = new ExcelJS.Workbook()
    createDetailSheet(
      workbook,
      makeResult([makeStudent("s1", ["gi-knowledge"]), makeStudent("s2")])
    )
    const sheet = workbook.getWorksheet("詳細")!

    // s1(3行目ではなく2行目): 知識は除外3セル分、思考は実数
    expect(sheet.getRow(2).values).toEqual([
      undefined,
      1,
      "s1 ",
      "除外",
      "除外",
      "除外",
      10, // 思考/レポート
      42, // 思考 合計
    ])
    // s2: 知識の2ソース + 合計、思考の1ソース + 合計がずれずに並ぶ
    expect(sheet.getRow(3).values).toEqual([
      undefined,
      1,
      "s2 ",
      10, // 知識/中間
      11, // 知識/期末
      42, // 知識 合計
      10, // 思考/レポート
      42, // 思考 合計
    ])
  })

  it("sourceScores の並びが dataSources と違っても id で正しい列に載る", () => {
    // 添字一致に依存していないことの確認（並びは実装詳細であって契約ではない）
    const student = makeStudent("s1")
    const knowledge = student.gradeItemResults[0]
    knowledge.sourceScores = [...knowledge.sourceScores].reverse()

    const workbook = new ExcelJS.Workbook()
    createDetailSheet(workbook, makeResult([student]))
    const sheet = workbook.getWorksheet("詳細")!

    // 中間=10 / 期末=11 が、並べ替え後もそれぞれの列に載る
    // （ExcelJS は 1 始まり: 1=番号, 2=氏名, 3=知識/中間, 4=知識/期末）
    expect(sheet.getRow(2).getCell(3).value).toBe(10)
    expect(sheet.getRow(2).getCell(4).value).toBe(11)
  })
})
