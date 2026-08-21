import { describe, expect, it } from "vitest"

import {
  DEFAULT_MANUSCRIPT_PAPER,
  DEFAULT_SETTINGS,
} from "@/components/answer-sheet-builder/constants"
import { computeLayoutFromDefinition } from "@/components/answer-sheet-builder/hooks/layout/computeLayout"
import { buildSubGridLayout } from "@/components/answer-sheet-builder/hooks/layout/gridBuilder"
import {
  columnContentWidth,
  manuscriptCellSize,
  maxManuscriptColumns,
  requiredBranchAreaWidth,
  subManuscriptAreaWidth,
  withRequiredSubQuestionWidths,
} from "@/components/answer-sheet-builder/hooks/layout/manuscriptWidth"
import type {
  AnswerSheetDefinition,
  BranchQuestion,
  GlobalSettings,
  ManuscriptPaper,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"
import type {
  ComputedCell,
  ComputedLayout,
} from "@/types/answerSheetLayout.types"

// ─── テスト用ヘルパー ───

const settings: GlobalSettings = DEFAULT_SETTINGS
const { baseRowHeight, columnWidths, margins } = settings
const contentLeft = margins.left
/** 段の中身の右端。A4縦・左右余白10mm なので 200mm */
const contentRight = contentLeft + columnContentWidth(settings)
/** 小問の解答欄が始まるX（大問番号欄＋小問番号欄の右） */
const subAnswerX =
  contentLeft + columnWidths.majorNumber + columnWidths.subNumber
/** 枝問の解答欄が始まるX（さらに枝問番号欄の右） */
const branchAnswerX = subAnswerX + columnWidths.branchNumber
/** 小問が並ぶ横配置領域（大問番号欄の右から段の右端まで） */
const horizontalAreaX = contentLeft + columnWidths.majorNumber
const horizontalAreaWidth = contentRight - horizontalAreaX

function manuscriptPaper(columns: number, rows: number): ManuscriptPaper {
  return {
    ...DEFAULT_MANUSCRIPT_PAPER,
    id: `manuscript-paper-${columns}x${rows}`,
    enabled: true,
    columns,
    rows,
    charGuides: [],
  }
}

function branchQuestion(
  label: string,
  paper: ManuscriptPaper | undefined
): BranchQuestion {
  return {
    id: `branch-${label}`,
    label,
    heightMultiplier: 1,
    points: 5,
    textElements: [],
    manuscriptPaper: paper,
  }
}

function subQuestion(
  label: string,
  paper: ManuscriptPaper | undefined,
  branchQuestions: BranchQuestion[] = []
): SubQuestion {
  return {
    id: `sub-${label}`,
    label,
    heightMultiplier: 1,
    points: 10,
    branchQuestions,
    textElements: [],
    manuscriptPaper: paper,
  }
}

function definitionOf(subQuestions: SubQuestion[]): AnswerSheetDefinition {
  return {
    id: "definition-manuscript-width",
    name: "原稿用紙の幅",
    settings,
    majorQuestions: [{ id: "major-1", label: "1", subQuestions }],
  }
}

/** 囲み枠（外枠）がいちばん右まで届いているX */
function outerRightEdge(layout: ComputedLayout): number {
  return Math.max(
    ...layout.lines
      .filter((line) => line.lineType === "outer")
      .flatMap((line) => [line.x1, line.x2])
  )
}

function cellAt(layout: ComputedLayout, questionPath: number[]): ComputedCell {
  const cell = layout.cells.find(
    (candidate) =>
      candidate.questionPath.length === questionPath.length &&
      candidate.questionPath.every((part, i) => part === questionPath[i])
  )
  if (!cell) throw new Error(`セルが見つからない: ${questionPath.join("-")}`)
  return cell
}

/** 検査する列数。段幅に収まる数と、収まらない数の両方を通す */
const COLUMN_COUNTS = [3, 8, 14, 20]

// ─── 小問の原稿用紙 ───

describe("小問の原稿用紙：割り当て幅・描画幅・囲み枠の右端", () => {
  it.each(COLUMN_COUNTS)("列数 %i で3つが一致する", (columns) => {
    const sub = subQuestion("(1)", manuscriptPaper(columns, 2))
    const layout = computeLayoutFromDefinition(definitionOf([sub]))

    const cellSize = manuscriptCellSize(sub, baseRowHeight)
    const drawnWidth = cellSize * columns

    // 割り当て：グリッドが小問に割り当てた幅（番号欄込み）
    const gridCells = buildSubGridLayout(
      withRequiredSubQuestionWidths(
        [sub],
        baseRowHeight,
        horizontalAreaWidth,
        columnWidths.subNumber,
        0
      ),
      baseRowHeight,
      0
    )
    expect(gridCells[0].width * horizontalAreaWidth).toBeCloseTo(
      columnWidths.subNumber + drawnWidth
    )

    // 描画：マス目そのものの幅
    const cell = cellAt(layout, [0, 0])
    expect(cell.manuscriptGrid?.gridWidth).toBeCloseTo(drawnWidth)
    expect(cell.manuscriptGrid?.gridX).toBeCloseTo(subAnswerX)

    // 囲み枠の右端
    expect(cell.x + cell.width).toBeCloseTo(subAnswerX + drawnWidth)
    expect(outerRightEdge(layout)).toBeCloseTo(subAnswerX + drawnWidth)
  })
})

// ─── 枝問の原稿用紙 ───

describe("枝問の原稿用紙：割り当て幅・描画幅・囲み枠の右端", () => {
  it.each(COLUMN_COUNTS)("列数 %i で3つが一致する", (columns) => {
    const branch = branchQuestion("ア", manuscriptPaper(columns, 2))
    const sub = subQuestion("(1)", undefined, [branch])
    const layout = computeLayoutFromDefinition(definitionOf([sub]))

    const cellSize = manuscriptCellSize(branch, baseRowHeight)
    const drawnWidth = cellSize * columns

    // 割り当て：枝問の必要幅が親の小問へ積み上がる（番号欄込み）
    expect(
      requiredBranchAreaWidth(
        [branch],
        baseRowHeight,
        columnWidths.branchNumber
      )
    ).toBeCloseTo(columnWidths.branchNumber + drawnWidth)

    // 描画：マス目そのものの幅
    const cell = cellAt(layout, [0, 0, 0])
    expect(cell.manuscriptGrid?.gridWidth).toBeCloseTo(drawnWidth)
    expect(cell.manuscriptGrid?.gridX).toBeCloseTo(branchAnswerX)

    // 囲み枠の右端
    expect(cell.x + cell.width).toBeCloseTo(branchAnswerX + drawnWidth)
    expect(outerRightEdge(layout)).toBeCloseTo(branchAnswerX + drawnWidth)
  })

  it("いちばん広い枝問が親の小問の幅を決める", () => {
    const narrow = branchQuestion("ア", manuscriptPaper(4, 2))
    const wide = branchQuestion("イ", manuscriptPaper(9, 2))
    const sub = subQuestion("(1)", undefined, [narrow, wide])
    const layout = computeLayoutFromDefinition(definitionOf([sub]))

    const cellSize = manuscriptCellSize(wide, baseRowHeight)
    const wideRight = branchAnswerX + cellSize * 9
    const narrowRight = branchAnswerX + cellSize * 4

    expect(cellAt(layout, [0, 0, 1]).manuscriptGrid?.gridWidth).toBeCloseTo(
      cellSize * 9
    )
    expect(cellAt(layout, [0, 0, 0]).manuscriptGrid?.gridWidth).toBeCloseTo(
      cellSize * 4
    )
    // 狭い方は親の右端まで届かない。囲み枠は広い方に合わせて立つ
    expect(
      cellAt(layout, [0, 0, 0]).x + cellAt(layout, [0, 0, 0]).width
    ).toBeCloseTo(narrowRight)
    expect(
      cellAt(layout, [0, 0, 1]).x + cellAt(layout, [0, 0, 1]).width
    ).toBeCloseTo(wideRight)
    expect(outerRightEdge(layout)).toBeCloseTo(wideRight)
  })
})

// ─── 列数の上限 ───

describe("列数の上限は段の幅から出る", () => {
  it("小問：上限ちょうどは段に収まり、1つ超えると段からはみ出す", () => {
    const probe = subQuestion("(1)", manuscriptPaper(1, 2))
    const limit = maxManuscriptColumns(
      subManuscriptAreaWidth(settings, probe),
      manuscriptCellSize(probe, baseRowHeight)
    )

    const fitting = computeLayoutFromDefinition(
      definitionOf([subQuestion("(1)", manuscriptPaper(limit, 2))])
    )
    expect(outerRightEdge(fitting)).toBeLessThanOrEqual(contentRight + 1e-9)

    const overflowing = computeLayoutFromDefinition(
      definitionOf([subQuestion("(1)", manuscriptPaper(limit + 1, 2))])
    )
    expect(outerRightEdge(overflowing)).toBeGreaterThan(contentRight)
  })

  it("枝問：上限ちょうどは段に収まり、1つ超えると段からはみ出す", () => {
    const probe = branchQuestion("ア", manuscriptPaper(1, 2))
    const parent = subQuestion("(1)", undefined, [probe])
    const limit = maxManuscriptColumns(
      subManuscriptAreaWidth(settings, parent) - columnWidths.branchNumber,
      manuscriptCellSize(probe, baseRowHeight)
    )

    const fitting = computeLayoutFromDefinition(
      definitionOf([
        subQuestion("(1)", undefined, [
          branchQuestion("ア", manuscriptPaper(limit, 2)),
        ]),
      ])
    )
    expect(outerRightEdge(fitting)).toBeLessThanOrEqual(contentRight + 1e-9)

    const overflowing = computeLayoutFromDefinition(
      definitionOf([
        subQuestion("(1)", undefined, [
          branchQuestion("ア", manuscriptPaper(limit + 1, 2)),
        ]),
      ])
    )
    expect(outerRightEdge(overflowing)).toBeGreaterThan(contentRight)
  })

  it("超えている列数を切り詰めない（そのまま描く）", () => {
    const columns = 30
    const sub = subQuestion("(1)", manuscriptPaper(columns, 2))
    const layout = computeLayoutFromDefinition(definitionOf([sub]))
    const cell = cellAt(layout, [0, 0])

    expect(cell.manuscriptGrid?.columns).toBe(columns)
    expect(cell.manuscriptGrid?.gridWidth).toBeCloseTo(
      manuscriptCellSize(sub, baseRowHeight) * columns
    )
  })
})
