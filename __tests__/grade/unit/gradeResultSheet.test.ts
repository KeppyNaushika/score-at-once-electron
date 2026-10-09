/**
 * Excel「成績一覧」シート（createGradeResultSheet）の列構成の検証。
 *
 * 固定したいこと:
 * - 見出しは2段。上の段で評価項目名をその項目の列にまたがって結合する
 * - 比較は渡された列だけが、自分側の評価項目の「(%)」「成績」の右に
 *   「{比較先} 成績」「変化」の2列ずつ並ぶ（渡されない比較＝選択で外した比較は出ない）
 * - 値は対象者 id で引く。渡された値（記号）はそのまま書く（main は計算しない）
 */

import * as ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"

import { createGradeResultSheet } from "@/electron-src/lib/export/gradeExcel/gradeSheetCreator"
import type {
  GradeCalculationResult,
  GradeItemResult,
  StudentGradeResult,
} from "@/types/grade.types"
import type { GradeExcelComparisonColumn } from "@/types/gradeExport.types"

const GRADE_ITEMS: GradeCalculationResult["gradeItems"] = [
  {
    id: "gi-knowledge",
    name: "知識・技能",
    order: 0,
    dataSources: [],
    boundaries: [],
  },
  {
    id: "gi-thinking",
    name: "思考・判断・表現",
    order: 1,
    dataSources: [],
    boundaries: [],
  },
]

function makeItemResult(
  gradeItemId: string,
  gradeLabel: string,
  percentage: number
): GradeItemResult {
  return {
    gradeItemId,
    gradeItemName: gradeItemId,
    isExcluded: false,
    isAllMissing: false,
    sourceScores: [],
    weightedScore: percentage,
    weightedMaxScore: 100,
    percentage,
    gradeLabel,
    originalGradeLabel: gradeLabel,
    overrideGradeLabel: null,
    frozen: null,
  }
}

function makeStudent(
  gradeStudentId: string,
  attendanceNumber: number,
  labels: [string, string]
): StudentGradeResult {
  return {
    gradeStudentId,
    studentId: `student-${gradeStudentId}`,
    studentNumber: gradeStudentId,
    lastName: "山田",
    firstName: gradeStudentId,
    attendanceNumber,
    className: null,
    gradeItemResults: [
      makeItemResult("gi-knowledge", labels[0], 85),
      makeItemResult("gi-thinking", labels[1], 62.25),
    ],
  }
}

const RESULT: GradeCalculationResult = {
  gradeId: "term2",
  gradeName: "2学期",
  classNames: [],
  gradeItems: GRADE_ITEMS,
  students: [
    makeStudent("gs-1", 1, ["A", "B"]),
    makeStudent("gs-2", 2, ["B", "C"]),
  ],
}

/** 知識・技能に付けた比較2つ（1学期と、同じ成績算出の思考） */
const COMPARISON_COLUMNS: GradeExcelComparisonColumn[] = [
  {
    comparisonId: "cmp-first-term",
    gradeItemId: "gi-knowledge",
    comparedTargetName: "1学期 > 知識・技能",
    cells: [
      { gradeStudentId: "gs-1", comparedGradeLabel: "B", symbol: "↑" },
      // 比較先の結果が取れない生徒は「・」（missing）
      { gradeStudentId: "gs-2", comparedGradeLabel: null, symbol: "・" },
    ],
  },
  {
    comparisonId: "cmp-within",
    gradeItemId: "gi-knowledge",
    comparedTargetName: "思考・判断・表現",
    cells: [
      { gradeStudentId: "gs-1", comparedGradeLabel: "B", symbol: "↑" },
      { gradeStudentId: "gs-2", comparedGradeLabel: "C", symbol: "↑" },
    ],
  },
]

function buildSheet(comparisonColumns: GradeExcelComparisonColumn[]) {
  const workbook = new ExcelJS.Workbook()
  createGradeResultSheet(workbook, RESULT, comparisonColumns)
  return workbook.getWorksheet("成績一覧")!
}

/** 結合で隠れたセル（結合の先頭以外）の印 */
const MERGED = "(結合)"

/**
 * 1行のセルを左から読む。ExcelJS は結合で隠れたセルにも先頭のセルの値を返すので、
 * 隠れたセルは `MERGED` にして、結合の範囲が見えるようにする。空のセルは null。
 */
function rowTexts(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const columnCount = sheet.getRow(1).cellCount
  return Array.from({ length: columnCount }, (_, index) => {
    const cell = sheet.getRow(rowNumber).getCell(index + 1)
    if (cell.isMerged && cell.master.address !== cell.address) return MERGED
    return cell.value ?? null
  })
}

describe("createGradeResultSheet: 見出しは2段", () => {
  it("比較が無ければ、各評価項目は (%) と 成績 の2列", () => {
    const sheet = buildSheet([])

    // 上の段: 評価項目名がその項目の列にまたがる
    expect(rowTexts(sheet, 1)).toEqual([
      "番号",
      "氏名",
      "知識・技能",
      MERGED,
      "思考・判断・表現",
      MERGED,
    ])
    // 下の段: 番号・氏名は上の段から縦に結合
    expect(rowTexts(sheet, 2)).toEqual([
      MERGED,
      MERGED,
      "(%)",
      "成績",
      "(%)",
      "成績",
    ])
    // データは3行目から
    expect(rowTexts(sheet, 3)).toEqual([1, "山田 gs-1", 85, "A", 62.3, "B"])
  })

  it("比較1件ごとに「{比較先} 成績」「変化」が自分側の項目の右に並び、項目名がまたがる", () => {
    const sheet = buildSheet(COMPARISON_COLUMNS)

    expect(rowTexts(sheet, 1)).toEqual([
      "番号",
      "氏名",
      "知識・技能",
      MERGED,
      MERGED,
      MERGED,
      MERGED,
      MERGED,
      "思考・判断・表現",
      MERGED,
    ])
    expect(rowTexts(sheet, 2)).toEqual([
      MERGED,
      MERGED,
      "(%)",
      "成績",
      "1学期 > 知識・技能 成績",
      "変化",
      "思考・判断・表現 成績",
      "変化",
      "(%)",
      "成績",
    ])
  })

  it("比較の値は対象者 id で引き、渡された記号をそのまま書く（取れない生徒は「・」）", () => {
    const sheet = buildSheet(COMPARISON_COLUMNS)

    expect(rowTexts(sheet, 3)).toEqual([
      1,
      "山田 gs-1",
      85,
      "A",
      "B",
      "↑",
      "B",
      "↑",
      62.3,
      "B",
    ])
    expect(rowTexts(sheet, 4)).toEqual([
      2,
      "山田 gs-2",
      85,
      "B",
      null,
      "・",
      "C",
      "↑",
      62.3,
      "C",
    ])
  })

  it("渡されない比較（選択で外した比較）は列に出ない", () => {
    const sheet = buildSheet([COMPARISON_COLUMNS[1]])

    expect(rowTexts(sheet, 2)).toEqual([
      MERGED,
      MERGED,
      "(%)",
      "成績",
      "思考・判断・表現 成績",
      "変化",
      "(%)",
      "成績",
    ])
    expect(rowTexts(sheet, 3)).toEqual([
      1,
      "山田 gs-1",
      85,
      "A",
      "B",
      "↑",
      62.3,
      "B",
    ])
  })
})
