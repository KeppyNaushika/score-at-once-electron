/**
 * 原稿用紙の幅の不変条件
 *
 * - **常に** マス目は枠に収まる（`マス目の右端 ≤ 枠の右端`）
 * - **枝問が全員原稿用紙のときだけ** 割り当て幅・描画幅・囲み枠の右端が一致する
 *
 * 「一致」を無条件の約束として書くと、混在（原稿用紙あり＋なし）が検査から抜ける。
 * 混在では枠は普通の枝問に合わせて広くなるので、マス目とは一致しない。
 */

import { describe, expect, it } from "vitest"

import {
  DEFAULT_SETTINGS,
  defaultManuscriptPaperSettings,
} from "@/components/answer-sheet-builder/constants"
import { computeLayoutFromDefinition } from "@/components/answer-sheet-builder/hooks/layout/computeLayout"
import { buildSubGridLayout } from "@/components/answer-sheet-builder/hooks/layout/gridBuilder"
import {
  availableBranchAreaWidth,
  branchManuscriptAreaWidth,
  columnContentWidth,
  manuscriptCellSize,
  maxManuscriptColumns,
  requiredBranchAreaWidth,
  subManuscriptAreaWidth,
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
/** 枝問が並ぶ領域の左端（小問番号欄の右） */
const branchAreaX =
  contentLeft + columnWidths.majorNumber + columnWidths.subNumber

function manuscriptPaper(columns: number, rows: number): ManuscriptPaper {
  return {
    id: `manuscript-paper-${columns}x${rows}`,
    enabled: true,
    columns,
    rows,
    guideFontSize: null,
    guidePosition: null,
    guidePadding: null,
    charGuides: [],
  }
}

function branchQuestion(
  label: string,
  paper: ManuscriptPaper | undefined,
  layoutWidth?: string
): BranchQuestion {
  return {
    id: `branch-${label}`,
    label,
    heightMultiplier: 1,
    points: 5,
    textElements: [],
    manuscriptPaper: paper,
    layoutWidth,
  }
}

function subQuestion(
  label: string,
  paper: ManuscriptPaper | undefined,
  branchQuestions: BranchQuestion[] = [],
  layoutWidth?: string
): SubQuestion {
  return {
    id: `sub-${label}`,
    label,
    heightMultiplier: 1,
    points: 10,
    branchQuestions,
    textElements: [],
    manuscriptPaper: paper,
    layoutWidth,
  }
}

function definitionOf(subQuestions: SubQuestion[]): AnswerSheetDefinition {
  return {
    id: "definition-manuscript-width",
    name: "原稿用紙の幅",
    description: null,
    referenceDate: null,
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

/** マス目の右端 */
function manuscriptGridRight(cell: ComputedCell): number {
  const manuscriptGrid = cell.manuscriptGrid
  if (!manuscriptGrid) throw new Error("マス目が無い")
  return manuscriptGrid.gridX + manuscriptGrid.gridWidth
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
      [sub],
      baseRowHeight,
      horizontalAreaWidth,
      columnWidths.subNumber,
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

describe("枝問が全員原稿用紙：割り当て幅・描画幅・囲み枠の右端", () => {
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
        columnWidths.branchNumber,
        availableBranchAreaWidth(
          sub,
          horizontalAreaWidth,
          columnWidths.subNumber
        )
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

// ─── 原稿用紙あり・なしの混在 ───

describe("混在：原稿用紙を持たない枝問も必要幅を言う", () => {
  /** 枝問領域が、原稿用紙を見ないときに持てる幅（元の規則で決まる幅） */
  const availableWidth = horizontalAreaWidth - columnWidths.subNumber

  it("普通の枝問はマス目の幅に押し込まれない（元の規則どおり全幅）", () => {
    const manuscriptBranch = branchQuestion("ア", manuscriptPaper(4, 2))
    const plainBranch = branchQuestion("イ", undefined)
    const sub = subQuestion("(1)", undefined, [manuscriptBranch, plainBranch])
    const layout = computeLayoutFromDefinition(definitionOf([sub]))

    // 普通の解答欄は段の右端まで届く（マス目の 4 マス幅に縮まない）
    const plainCell = cellAt(layout, [0, 0, 1])
    expect(plainCell.x).toBeCloseTo(branchAnswerX)
    expect(plainCell.x + plainCell.width).toBeCloseTo(contentRight)

    // マス目は自分の必要幅のまま、枠に収まる
    const manuscriptCell = cellAt(layout, [0, 0, 0])
    const cellSize = manuscriptCellSize(manuscriptBranch, baseRowHeight)
    expect(manuscriptCell.manuscriptGrid?.gridWidth).toBeCloseTo(cellSize * 4)
    expect(manuscriptGridRight(manuscriptCell)).toBeLessThanOrEqual(
      outerRightEdge(layout) + 1e-9
    )
    // 枠は普通の枝問に合わせて立つので、マス目とは一致しない
    expect(outerRightEdge(layout)).toBeCloseTo(contentRight)
    expect(outerRightEdge(layout)).toBeGreaterThan(
      manuscriptGridRight(manuscriptCell)
    )
  })

  it("layoutWidth を明示した兄弟は、その分数ぶんの幅を保つ", () => {
    const manuscriptBranch = branchQuestion("ア", manuscriptPaper(4, 2))
    const halfBranch = branchQuestion("イ", undefined, "1/2")
    const sub = subQuestion("(1)", undefined, [manuscriptBranch, halfBranch])
    const layout = computeLayoutFromDefinition(definitionOf([sub]))

    // 元の規則で決まる幅＝領域の半分。そこから枝問番号欄を引いたものが解答欄
    const halfCell = cellAt(layout, [0, 0, 1])
    expect(halfCell.x).toBeCloseTo(branchAnswerX)
    expect(halfCell.width).toBeCloseTo(
      availableWidth / 2 - columnWidths.branchNumber
    )

    // 枠は広い方（半分の枝問）に合わせて立ち、マス目はその中に収まる
    expect(outerRightEdge(layout)).toBeCloseTo(branchAreaX + availableWidth / 2)
    expect(manuscriptGridRight(cellAt(layout, [0, 0, 0]))).toBeLessThanOrEqual(
      outerRightEdge(layout) + 1e-9
    )
  })

  it("横配置：親の小問に明示した layoutWidth を上書きしない", () => {
    const manuscriptBranch = branchQuestion("ア", manuscriptPaper(4, 2))
    const plainBranch = branchQuestion("イ", undefined)
    const half = subQuestion(
      "(1)",
      undefined,
      [manuscriptBranch, plainBranch],
      "1/2"
    )
    const neighbor = subQuestion("(2)", undefined, [], "1/2")
    const layout = computeLayoutFromDefinition(definitionOf([half, neighbor]))

    // 親は横配置領域の半分を保つ（枝問のマス目の幅まで縮まない）
    const parentRight = horizontalAreaX + horizontalAreaWidth / 2
    expect(
      cellAt(layout, [0, 0, 1]).x + cellAt(layout, [0, 0, 1]).width
    ).toBeCloseTo(parentRight)
    // 隣の小問は半分の位置から始まり、段の右端まで届く
    const neighborCell = cellAt(layout, [0, 1])
    expect(neighborCell.x).toBeCloseTo(parentRight + columnWidths.subNumber)
    expect(neighborCell.x + neighborCell.width).toBeCloseTo(contentRight)
    expect(outerRightEdge(layout)).toBeCloseTo(contentRight)
  })

  it("原稿用紙が1つも無ければ幅を要求しない（元の規則がそのまま残る）", () => {
    const half = branchQuestion("ア", undefined, "1/2")
    const plain = branchQuestion("イ", undefined)
    const sub = subQuestion("(1)", undefined, [half, plain])

    expect(
      requiredBranchAreaWidth(
        sub.branchQuestions,
        baseRowHeight,
        columnWidths.branchNumber,
        availableWidth
      )
    ).toBeNull()

    const layout = computeLayoutFromDefinition(definitionOf([sub]))
    expect(cellAt(layout, [0, 0, 0]).width).toBeCloseTo(
      availableWidth / 2 - columnWidths.branchNumber
    )
    expect(
      cellAt(layout, [0, 0, 1]).x + cellAt(layout, [0, 0, 1]).width
    ).toBeCloseTo(contentRight)
    expect(outerRightEdge(layout)).toBeCloseTo(contentRight)
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

  it("小問と枝問で上限が違う（枝問は枝番号欄のぶん狭い）", () => {
    const branch = branchQuestion("ア", undefined)
    const parent = subQuestion("(1)", undefined, [branch])
    const subLimit = maxManuscriptColumns(
      subManuscriptAreaWidth(settings, parent),
      manuscriptCellSize(parent, baseRowHeight)
    )
    const branchLimit = maxManuscriptColumns(
      branchManuscriptAreaWidth(settings, parent, branch),
      manuscriptCellSize(branch, baseRowHeight)
    )

    expect(subLimit).toBe(14)
    expect(branchLimit).toBeLessThan(subLimit)
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

// ─── 行をはじめて作るときの既定 ───

describe("原稿用紙の既定は用紙設定から決まる", () => {
  /** その小問の段幅に収まる上限（画面が入力を止めるのに使う数と同じもの） */
  function subColumnLimit(
    paperSettings: GlobalSettings,
    sub: SubQuestion
  ): number {
    return maxManuscriptColumns(
      subManuscriptAreaWidth(paperSettings, sub),
      manuscriptCellSize(sub, paperSettings.baseRowHeight)
    )
  }

  it("縦書き・A3横は 20×10（200字詰）", () => {
    const verticalA3: GlobalSettings = {
      ...settings,
      paperSize: "A3",
      orientation: "landscape",
      verticalLayout: true,
    }
    const sub = subQuestion("(1)", undefined)
    // 縦組みは短辺が論理的な幅。297 − 余白20 − 大問番号欄10 − 小問番号欄10 = 257mm
    const limit = subColumnLimit(verticalA3, sub)
    expect(limit).toBe(21)

    // 21 マス入るので 200字詰の 20 をそのまま保つ（半端な 21 へ広げない）
    expect(defaultManuscriptPaperSettings(true, limit)).toMatchObject({
      columns: 20,
      rows: 10,
    })
  })

  it("横書き・A4縦は 14×2（20マスは段に入らないので詰める）", () => {
    const sub = subQuestion("(1)", undefined)
    const limit = subColumnLimit(settings, sub)
    expect(limit).toBe(14)

    const initial = defaultManuscriptPaperSettings(false, limit)
    expect(initial).toMatchObject({ columns: 14, rows: 2 })

    // 既定で作った原稿用紙は、作った瞬間にはみ出していない（＝警告が出ない）
    const layout = computeLayoutFromDefinition(
      definitionOf([
        subQuestion("(1)", manuscriptPaper(initial.columns, initial.rows)),
      ])
    )
    expect(outerRightEdge(layout)).toBeLessThanOrEqual(contentRight + 1e-9)
  })

  it("段組み2段のような狭い設定でも上限に収まる", () => {
    const twoColumns: GlobalSettings = {
      ...settings,
      multiColumn: { ...settings.multiColumn, enabled: true, columnCount: 2 },
    }
    const sub = subQuestion("(1)", undefined)
    const limit = subColumnLimit(twoColumns, sub)
    expect(limit).toBeLessThan(20)

    const initial = defaultManuscriptPaperSettings(false, limit)
    expect(initial.columns).toBe(limit)
    expect(initial.rows).toBe(2)
  })

  it("枝問はその枝問の上限に従う（小問より狭い）", () => {
    const branch = branchQuestion("ア", undefined)
    const parent = subQuestion("(1)", undefined, [branch])
    const branchLimit = maxManuscriptColumns(
      branchManuscriptAreaWidth(settings, parent, branch),
      manuscriptCellSize(branch, baseRowHeight)
    )

    expect(branchLimit).toBe(13)
    expect(defaultManuscriptPaperSettings(false, branchLimit)).toMatchObject({
      columns: 13,
      rows: 2,
    })
  })
})
