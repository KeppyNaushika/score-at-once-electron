/**
 * レイアウト計算hook
 *
 * AnswerSheetDefinition → ComputedLayout をuseMemoで計算。
 * フロントエンドではelectron-srcのlayoutEngineを直接importできないため、
 * 同じアルゴリズムをフロントエンド側にも持つ（共有ロジック）。
 */

import { useMemo } from "react"

import type {
  AnswerSheetDefinition,
  BorderConfig,
  BranchLayoutRow,
  BranchQuestion,
  ComputedCell,
  ComputedLayout,
  ComputedLine,
  ComputedMultiPageLayout,
  ComputedNumberLabel,
  ComputedOMRMarker,
  ComputedPageLayout,
  GlobalSettings,
  LayoutRow,
  LineStyle,
  MajorQuestion,
  ManuscriptGrid,
  SubQuestion,
} from "@/types/answerSheetBuilder.types"
import type {
  ComputedOMRBubble,
  ComputedOMRDigitBox,
  OMRCellConfig,
} from "@/types/omr.types"

import { PAPER_SIZES } from "../constants"

/** lineType から BorderConfig の線幅を取得するヘルパー */
function getLineWidth(lineType: string, borderConfig: BorderConfig): number {
  switch (lineType) {
    case "outer":
      return borderConfig.outerBorderWidth ?? 0.7
    case "major":
      return borderConfig.majorDividerWidth ?? 0.5
    case "sub":
    case "subHorizontalDivider":
      return borderConfig.subDividerWidth ?? 0.4
    case "branch":
      return borderConfig.branchDividerWidth ?? 0.3
    case "numberColumn":
      return borderConfig.numberColumnDividerWidth ?? 0.4
    default:
      return 0.4
  }
}

function getPaperDimensions(settings: GlobalSettings) {
  const base = PAPER_SIZES[settings.paperSize] ?? PAPER_SIZES.A4
  if (settings.orientation === "landscape") {
    return { width: base.height, height: base.width }
  }
  return { width: base.width, height: base.height }
}

function buildLayoutRows(
  subQuestions: SubQuestion[],
  columnsPerRow: number[] | undefined
): LayoutRow[] {
  if (!columnsPerRow || columnsPerRow.length === 0) {
    return subQuestions.map((sub, si) => ({
      type: "vertical-sub" as const,
      sub,
      subIndex: si,
    }))
  }

  const rows: LayoutRow[] = []
  let si = 0
  let specIdx = 0

  while (si < subQuestions.length && specIdx < columnsPerRow.length) {
    const rowSpec = columnsPerRow[specIdx]
    specIdx++

    let consumed = 0
    let batch: {
      sub: SubQuestion
      subIndex: number
      colStart: number
      span: number
    }[] = []
    let batchCols = 0

    const flushBatch = () => {
      if (batch.length > 0) {
        rows.push({ type: "horizontal", subs: batch, columns: batchCols })
        batch = []
        batchCols = 0
      }
    }

    while (consumed < rowSpec && si < subQuestions.length) {
      const sub = subQuestions[si]
      const span = sub.colSpan ?? 1

      if (sub.branchQuestions.length >= 2) {
        flushBatch()
        rows.push({ type: "vertical-sub", sub, subIndex: si })
        si++
        consumed += span
        continue
      }

      batch.push({ sub, subIndex: si, colStart: batchCols, span })
      batchCols += span
      si++
      consumed += span
    }

    flushBatch()
  }

  while (si < subQuestions.length) {
    rows.push({
      type: "vertical-sub",
      sub: subQuestions[si],
      subIndex: si,
    })
    si++
  }

  return rows
}

function buildBranchLayoutRows(
  branchQuestions: BranchQuestion[],
  columnsPerRow: number[] | undefined
): BranchLayoutRow[] {
  if (!columnsPerRow || columnsPerRow.length === 0) {
    return branchQuestions.map((branch, bi) => ({
      type: "vertical-branch" as const,
      branch,
      branchIndex: bi,
    }))
  }

  const rows: BranchLayoutRow[] = []
  let bi = 0
  let specIdx = 0

  while (bi < branchQuestions.length && specIdx < columnsPerRow.length) {
    const rowSpec = columnsPerRow[specIdx]
    specIdx++

    let consumed = 0
    const batch: {
      branch: BranchQuestion
      branchIndex: number
      colStart: number
      span: number
    }[] = []
    let batchCols = 0

    while (consumed < rowSpec && bi < branchQuestions.length) {
      const branch = branchQuestions[bi]
      const span = branch.colSpan ?? 1
      batch.push({ branch, branchIndex: bi, colStart: batchCols, span })
      batchCols += span
      bi++
      consumed += span
    }

    if (batch.length > 0) {
      rows.push({ type: "horizontal", branches: batch, columns: batchCols })
    }
  }

  while (bi < branchQuestions.length) {
    rows.push({
      type: "vertical-branch",
      branch: branchQuestions[bi],
      branchIndex: bi,
    })
    bi++
  }

  return rows
}

function computeSubHeight(sub: SubQuestion, baseRowHeight: number): number {
  if (sub.branchQuestions.length > 0) {
    const branchRows = buildBranchLayoutRows(
      sub.branchQuestions,
      sub.branchHorizontalColumnsPerRow
    )
    return branchRows.reduce((sum, row) => {
      if (row.type === "horizontal") {
        const maxH = Math.max(
          ...row.branches.map((b) => b.branch.heightMultiplier),
          1
        )
        return sum + maxH * baseRowHeight
      }
      return sum + row.branch.heightMultiplier * baseRowHeight
    }, 0)
  }
  if (sub.manuscriptPaper?.enabled) {
    return sub.manuscriptPaper.rows * sub.manuscriptPaper.cellSizeMm
  }
  return sub.heightMultiplier * baseRowHeight
}

/**
 * OMR choiceセルのバブル位置を計算（0-1正規化座標）
 */
function computeOMRBubbles(
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  paperWidth: number,
  paperHeight: number,
  config: OMRCellConfig & { type: "choice" }
): ComputedOMRBubble[] {
  const bubbles: ComputedOMRBubble[] = []
  const n = config.numChoices

  const maxRadiusMm = Math.min(cellHeight * 0.25, cellWidth / (n * 2.5 + 1))
  const radiusMm = Math.max(1.5, maxRadiusMm)

  if (config.layout === "horizontal") {
    const spacing = cellWidth / (n + 1)
    const cy = cellY + cellHeight / 2

    for (let i = 0; i < n; i++) {
      const cx = cellX + spacing * (i + 1)
      bubbles.push({
        normalizedCx: cx / paperWidth,
        normalizedCy: cy / paperHeight,
        normalizedRadius: radiusMm / paperWidth,
        choiceIndex: i,
        label: config.labels[i] ?? String(i + 1),
      })
    }
  } else {
    const spacing = cellHeight / (n + 1)
    const cx = cellX + cellWidth / 2

    for (let i = 0; i < n; i++) {
      const cy = cellY + spacing * (i + 1)
      bubbles.push({
        normalizedCx: cx / paperWidth,
        normalizedCy: cy / paperHeight,
        normalizedRadius: radiusMm / paperWidth,
        choiceIndex: i,
        label: config.labels[i] ?? String(i + 1),
      })
    }
  }

  return bubbles
}

/**
 * OMR handwritten-digitセルの数字欄位置を計算（0-1正規化座標）
 */
function computeOMRDigitBoxes(
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  paperWidth: number,
  paperHeight: number,
  config: OMRCellConfig & { type: "handwritten-digit" }
): ComputedOMRDigitBox[] {
  const boxes: ComputedOMRDigitBox[] = []
  const n = config.numDigits

  const boxHeight = cellHeight * 0.8
  const boxWidth = Math.min(boxHeight, cellWidth / (n + 0.5))
  const totalWidth = boxWidth * n
  const startX = cellX + (cellWidth - totalWidth) / 2
  const startY = cellY + (cellHeight - boxHeight) / 2

  for (let i = 0; i < n; i++) {
    boxes.push({
      normalizedX: (startX + boxWidth * i) / paperWidth,
      normalizedY: startY / paperHeight,
      normalizedW: boxWidth / paperWidth,
      normalizedH: boxHeight / paperHeight,
      digitIndex: i,
    })
  }

  return boxes
}

/**
 * セルを作成しOMRバブル/数字欄があれば計算する
 */
function createCell(
  questionPath: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  paper: { width: number; height: number },
  label: string,
  points: number,
  textElements: ComputedCell["textElements"],
  modelAnswer: string | undefined,
  cellType: ComputedCell["cellType"],
  pageIndex: number = 0,
  manuscriptGrid?: ManuscriptGrid,
  omrConfig?: OMRCellConfig
): ComputedCell {
  const cell: ComputedCell = {
    questionPath,
    x,
    y,
    width,
    height,
    normalizedX: x / paper.width,
    normalizedY: y / paper.height,
    normalizedW: width / paper.width,
    normalizedH: height / paper.height,
    label,
    points,
    textElements,
    modelAnswer,
    cellType,
    pageIndex,
    ...(manuscriptGrid ? { manuscriptGrid } : {}),
  }

  if (omrConfig?.type === "choice") {
    cell.omrBubbles = computeOMRBubbles(
      x,
      y,
      width,
      height,
      paper.width,
      paper.height,
      omrConfig
    )
  } else if (omrConfig?.type === "handwritten-digit") {
    cell.omrDigitBoxes = computeOMRDigitBoxes(
      x,
      y,
      width,
      height,
      paper.width,
      paper.height,
      omrConfig
    )
  }

  return cell
}

function computeManuscriptGrid(
  sub: SubQuestion,
  cellX: number,
  cellY: number,
  cellWidth: number
): ManuscriptGrid | undefined {
  if (!sub.manuscriptPaper?.enabled) return undefined
  const { columns, rows, cellSizeMm } = sub.manuscriptPaper
  const gridWidth = columns * cellSizeMm
  const gridHeight = rows * cellSizeMm
  return {
    columns,
    rows,
    cellSizeMm,
    gridX: cellX + (cellWidth - gridWidth) / 2,
    gridY: cellY,
    gridWidth,
    gridHeight,
  }
}

function computeMajorHeight(
  major: MajorQuestion,
  baseRowHeight: number
): number {
  const layoutRows = buildLayoutRows(
    major.subQuestions,
    major.horizontalColumnsPerRow
  )
  return layoutRows.reduce((sum, row) => {
    if (row.type === "horizontal") {
      const maxH = Math.max(...row.subs.map((s) => s.sub.heightMultiplier), 1)
      return sum + maxH * baseRowHeight
    }
    return sum + computeSubHeight(row.sub, baseRowHeight)
  }, 0)
}

function computeLayoutFromDefinition(
  definition: AnswerSheetDefinition
): ComputedLayout {
  const { settings, majorQuestions } = definition
  const paper = getPaperDimensions(settings)
  const { margins, baseRowHeight, columnWidths, spacing } = settings

  const contentLeft = margins.left
  const contentRight = paper.width - margins.right

  const majorNumX = contentLeft
  const majorNumWidth = columnWidths.majorNumber
  const subNumX = majorNumX + majorNumWidth
  const subNumWidth = columnWidths.subNumber

  const hasBranch = majorQuestions.some((mq) =>
    mq.subQuestions.some((sq) => sq.branchQuestions.length > 0)
  )
  const branchNumX = subNumX + subNumWidth
  const branchNumWidth = hasBranch ? columnWidths.branchNumber : 0

  const answerX = branchNumX + branchNumWidth
  const answerWidth = contentRight - answerX

  const cells: ComputedCell[] = []
  const lines: ComputedLine[] = []
  const numberLabels: ComputedNumberLabel[] = []

  let currentY = margins.top + spacing.headerHeight

  majorQuestions.forEach((major, mi) => {
    if (mi > 0) {
      currentY += spacing.majorQuestionSpacing
    }

    const majorStartY = currentY
    const majorHeight = computeMajorHeight(major, baseRowHeight)

    numberLabels.push({
      text: major.label,
      x: majorNumX,
      y: majorStartY,
      width: majorNumWidth,
      height:
        settings.numberDisplayMode === "multirow" ? majorHeight : baseRowHeight,
      fontSize: settings.fonts.numberSize,
      displayMode: settings.numberDisplayMode,
    })

    const layoutRows = buildLayoutRows(
      major.subQuestions,
      major.horizontalColumnsPerRow
    )
    const horizontalAreaX = majorNumX + majorNumWidth
    const horizontalAreaWidth = contentRight - horizontalAreaX

    layoutRows.forEach((row, ri) => {
      if (row.type === "horizontal") {
        const rowMaxH = Math.max(
          ...row.subs.map((s) => s.sub.heightMultiplier),
          1
        )
        const rowHeight = rowMaxH * baseRowHeight
        const unitWidth = horizontalAreaWidth / row.columns

        row.subs.forEach((entry) => {
          const cellX = horizontalAreaX + entry.colStart * unitWidth
          const cellWidth = entry.span * unitWidth

          numberLabels.push({
            text: entry.sub.label,
            x: cellX,
            y: currentY,
            width: cellWidth,
            height: rowHeight,
            fontSize: settings.fonts.numberSize,
            displayMode: "sub-horizontal",
          })

          cells.push(
            createCell(
              [mi, entry.subIndex],
              cellX,
              currentY,
              cellWidth,
              rowHeight,
              paper,
              `${major.label}-${entry.sub.label}`,
              entry.sub.points,
              entry.sub.textElements,
              entry.sub.modelAnswer,
              "answer",
              0,
              computeManuscriptGrid(entry.sub, cellX, currentY, cellWidth),
              entry.sub.omrConfig
            )
          )

          const cellRight = cellX + cellWidth
          if (Math.abs(cellRight - contentRight) > 0.01) {
            lines.push({
              x1: cellRight,
              y1: currentY,
              x2: cellRight,
              y2: currentY + rowHeight,
              style: settings.borderConfig.subDivider,
              lineType: "subHorizontalDivider",
              strokeWidth: getLineWidth(
                "subHorizontalDivider",
                settings.borderConfig
              ),
            })
          }
        })

        currentY += rowHeight
      } else {
        // vertical-sub
        const sub = row.sub
        const si = row.subIndex
        const subStartY = currentY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = computeSubHeight(sub, baseRowHeight)

        numberLabels.push({
          text: sub.label,
          x: subNumX,
          y: subStartY,
          width: subNumWidth,
          height: subHeight,
          fontSize: settings.fonts.numberSize,
          displayMode: "sub",
        })

        if (hasBranches) {
          const branchRows = buildBranchLayoutRows(
            sub.branchQuestions,
            sub.branchHorizontalColumnsPerRow
          )
          const branchAreaX = subNumX + subNumWidth
          const branchAreaWidth = contentRight - branchAreaX
          let branchY = subStartY

          branchRows.forEach((bRow, bri) => {
            if (bRow.type === "horizontal") {
              const rowMaxH = Math.max(
                ...bRow.branches.map((b) => b.branch.heightMultiplier),
                1
              )
              const bRowHeight = rowMaxH * baseRowHeight
              const unitWidth = branchAreaWidth / bRow.columns

              bRow.branches.forEach((entry) => {
                const cellX = branchAreaX + entry.colStart * unitWidth
                const cellWidth = entry.span * unitWidth

                numberLabels.push({
                  text: entry.branch.label,
                  x: cellX,
                  y: branchY,
                  width: cellWidth,
                  height: bRowHeight,
                  fontSize: settings.fonts.numberSize - 1,
                  displayMode: "branch-horizontal",
                })

                cells.push(
                  createCell(
                    [mi, si, entry.branchIndex],
                    cellX,
                    branchY,
                    cellWidth,
                    bRowHeight,
                    paper,
                    `${major.label}-${sub.label}-${entry.branch.label}`,
                    entry.branch.points,
                    entry.branch.textElements,
                    entry.branch.modelAnswer,
                    "answer",
                    0,
                    undefined,
                    entry.branch.omrConfig
                  )
                )

                const cellRight = cellX + cellWidth
                if (Math.abs(cellRight - contentRight) > 0.01) {
                  lines.push({
                    x1: cellRight,
                    y1: branchY,
                    x2: cellRight,
                    y2: branchY + bRowHeight,
                    style: settings.borderConfig.branchDivider,
                    lineType: "branch",
                    strokeWidth: getLineWidth("branch", settings.borderConfig),
                  })
                }
              })

              branchY += bRowHeight
            } else {
              const branch = bRow.branch
              const branchHeight = branch.heightMultiplier * baseRowHeight

              numberLabels.push({
                text: branch.label,
                x: branchNumX,
                y: branchY,
                width: branchNumWidth,
                height: branchHeight,
                fontSize: settings.fonts.numberSize - 1,
                displayMode: "branch",
              })

              cells.push(
                createCell(
                  [mi, si, bRow.branchIndex],
                  answerX,
                  branchY,
                  answerWidth,
                  branchHeight,
                  paper,
                  `${major.label}-${sub.label}-${branch.label}`,
                  branch.points,
                  branch.textElements,
                  branch.modelAnswer,
                  "answer",
                  0,
                  undefined,
                  branch.omrConfig
                )
              )

              if (bri < branchRows.length - 1) {
                lines.push({
                  x1: branchNumX,
                  y1: branchY + branchHeight,
                  x2: contentRight,
                  y2: branchY + branchHeight,
                  style: settings.borderConfig.branchDivider,
                  lineType: "branch",
                  strokeWidth: getLineWidth("branch", settings.borderConfig),
                  dragInfo: {
                    axis: "horizontal",
                    target: {
                      type: "heightMultiplier",
                      majorIndex: mi,
                      subIndex: si,
                      branchIndex: bRow.branchIndex,
                    },
                    currentValueMm: branchHeight,
                    minMm: baseRowHeight * 0.5,
                  },
                })
              }

              branchY += branchHeight
            }

            // 枝問行間の区切り線（横配置行が関わる場合）
            if (
              bri < branchRows.length - 1 &&
              (bRow.type === "horizontal" ||
                branchRows[bri + 1].type === "horizontal")
            ) {
              const nextBRow = branchRows[bri + 1]
              const lineX =
                bRow.type === "horizontal" || nextBRow.type === "horizontal"
                  ? branchAreaX
                  : branchNumX
              lines.push({
                x1: lineX,
                y1: branchY,
                x2: contentRight,
                y2: branchY,
                style: settings.borderConfig.branchDivider,
                lineType: "branch",
                strokeWidth: getLineWidth("branch", settings.borderConfig),
              })
            }
          })
        } else {
          cells.push(
            createCell(
              [mi, si],
              answerX,
              subStartY,
              answerWidth,
              subHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              sub.modelAnswer,
              "answer",
              0,
              computeManuscriptGrid(sub, answerX, subStartY, answerWidth),
              sub.omrConfig
            )
          )
        }

        currentY += subHeight
      }

      // 行間の区切り線（最後の行以外）
      if (ri < layoutRows.length - 1) {
        const nextRow = layoutRows[ri + 1]
        if (row.type === "horizontal" && nextRow.type === "horizontal") {
          lines.push({
            x1: horizontalAreaX,
            y1: currentY,
            x2: contentRight,
            y2: currentY,
            style: settings.borderConfig.subDivider,
            lineType: "subHorizontalDivider",
            strokeWidth: getLineWidth(
              "subHorizontalDivider",
              settings.borderConfig
            ),
          })
        } else if (row.type === "vertical-sub") {
          const sub = row.sub
          const si = row.subIndex
          const hasBranches = sub.branchQuestions.length > 0
          lines.push({
            x1: subNumX,
            y1: currentY,
            x2: contentRight,
            y2: currentY,
            style: settings.borderConfig.subDivider,
            lineType: "sub",
            strokeWidth: getLineWidth("sub", settings.borderConfig),
            dragInfo: {
              axis: "horizontal",
              target: {
                type: "heightMultiplier",
                majorIndex: mi,
                subIndex: si,
              },
              currentValueMm: hasBranches
                ? sub.branchQuestions.reduce(
                    (s, bq) => s + bq.heightMultiplier * baseRowHeight,
                    0
                  )
                : sub.heightMultiplier * baseRowHeight,
              minMm: baseRowHeight * 0.5,
            },
          })
        } else {
          lines.push({
            x1: horizontalAreaX,
            y1: currentY,
            x2: contentRight,
            y2: currentY,
            style: settings.borderConfig.subDivider,
            lineType: "sub",
            strokeWidth: getLineWidth("sub", settings.borderConfig),
          })
        }
      }
    })

    if (mi < majorQuestions.length - 1) {
      lines.push({
        x1: contentLeft,
        y1: currentY,
        x2: contentRight,
        y2: currentY,
        style: settings.borderConfig.majorDivider,
        lineType: "major",
        strokeWidth: getLineWidth("major", settings.borderConfig),
      })
    }
  })

  const contentBottom = currentY
  const contentTop = margins.top + spacing.headerHeight

  // 外枠
  addBorderLines(
    lines,
    contentLeft,
    contentTop,
    contentRight,
    contentBottom,
    settings.borderConfig.outerBorder,
    settings.borderConfig
  )

  // vertical-sub 行のY範囲を収集（小問番号列セグメント化用）
  // branchVerticalRanges: vertical-branch行のY範囲（枝問番号列用）
  const verticalRanges: { top: number; bottom: number }[] = []
  const branchVerticalRanges: { top: number; bottom: number }[] = []
  {
    let trackY = margins.top + spacing.headerHeight
    for (let mi2 = 0; mi2 < majorQuestions.length; mi2++) {
      const mq = majorQuestions[mi2]
      if (mi2 > 0) {
        trackY += spacing.majorQuestionSpacing
      }
      const rows = buildLayoutRows(mq.subQuestions, mq.horizontalColumnsPerRow)
      let segStart: number | null = null
      for (const r of rows) {
        if (r.type === "vertical-sub") {
          if (segStart === null) segStart = trackY
          // 枝問番号列のセグメント: vertical-branch行のみ
          if (r.sub.branchQuestions.length > 0) {
            const bRows = buildBranchLayoutRows(
              r.sub.branchQuestions,
              r.sub.branchHorizontalColumnsPerRow
            )
            let bTrackY = trackY
            let bSegStart: number | null = null
            for (const br of bRows) {
              if (br.type === "vertical-branch") {
                if (bSegStart === null) bSegStart = bTrackY
                bTrackY += br.branch.heightMultiplier * baseRowHeight
              } else {
                if (bSegStart !== null) {
                  branchVerticalRanges.push({ top: bSegStart, bottom: bTrackY })
                  bSegStart = null
                }
                const maxH = Math.max(
                  ...br.branches.map((b) => b.branch.heightMultiplier),
                  1
                )
                bTrackY += maxH * baseRowHeight
              }
            }
            if (bSegStart !== null) {
              branchVerticalRanges.push({ top: bSegStart, bottom: bTrackY })
            }
          }
          trackY += computeSubHeight(r.sub, baseRowHeight)
        } else {
          if (segStart !== null) {
            verticalRanges.push({ top: segStart, bottom: trackY })
            segStart = null
          }
          const maxH = Math.max(...r.subs.map((s) => s.sub.heightMultiplier), 1)
          trackY += maxH * baseRowHeight
        }
      }
      if (segStart !== null) {
        verticalRanges.push({ top: segStart, bottom: trackY })
      }
    }
  }

  // 大問番号列の縦線 → 全高（従来通り）
  const ncSw = getLineWidth("numberColumn", settings.borderConfig)
  lines.push({
    x1: majorNumX + majorNumWidth,
    y1: contentTop,
    x2: majorNumX + majorNumWidth,
    y2: contentBottom,
    style: settings.borderConfig.numberColumnDivider,
    lineType: "numberColumn",
    strokeWidth: ncSw,
    dragInfo: {
      axis: "vertical",
      target: { type: "columnWidth", column: "majorNumber" },
      currentValueMm: majorNumWidth,
      minMm: 5,
    },
  })

  // 小問番号列の縦線 → 縦配置のセグメントのみ
  for (const range of verticalRanges) {
    lines.push({
      x1: subNumX + subNumWidth,
      y1: range.top,
      x2: subNumX + subNumWidth,
      y2: range.bottom,
      style: settings.borderConfig.numberColumnDivider,
      lineType: "numberColumn",
      strokeWidth: ncSw,
      dragInfo: {
        axis: "vertical",
        target: { type: "columnWidth", column: "subNumber" },
        currentValueMm: subNumWidth,
        minMm: 5,
      },
    })
  }

  // 枝問番号列の縦線 → vertical-branchセグメントのみ
  if (hasBranch) {
    for (const range of branchVerticalRanges) {
      lines.push({
        x1: branchNumX + branchNumWidth,
        y1: range.top,
        x2: branchNumX + branchNumWidth,
        y2: range.bottom,
        style: settings.borderConfig.numberColumnDivider,
        lineType: "numberColumn",
        strokeWidth: ncSw,
        dragInfo: {
          axis: "vertical",
          target: { type: "columnWidth", column: "branchNumber" },
          currentValueMm: branchNumWidth,
          minMm: 5,
        },
      })
    }
  }

  // OMRマーカー
  const omrMarkerPositions = computeOMRMarkers(settings, paper)

  return {
    pageWidthMm: paper.width,
    pageHeightMm: paper.height,
    cells,
    lines,
    numberLabels,
    omrMarkerPositions,
    overflow: contentBottom > paper.height - margins.bottom,
    contentHeightMm: contentBottom - margins.top,
  }
}

function addBorderLines(
  lines: ComputedLine[],
  l: number,
  t: number,
  r: number,
  b: number,
  style: LineStyle,
  borderConfig: BorderConfig
) {
  const sw = getLineWidth("outer", borderConfig)
  lines.push({
    x1: l,
    y1: t,
    x2: r,
    y2: t,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })
  lines.push({
    x1: l,
    y1: b,
    x2: r,
    y2: b,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })
  lines.push({
    x1: l,
    y1: t,
    x2: l,
    y2: b,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })
  lines.push({
    x1: r,
    y1: t,
    x2: r,
    y2: b,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })
}

function computeOMRMarkers(
  settings: GlobalSettings,
  paper: { width: number; height: number }
): ComputedOMRMarker[] {
  if (!settings.omrMarkers.enabled) return []
  const { sizeMm, offsetMm } = settings.omrMarkers
  return [
    { x: offsetMm, y: offsetMm, size: sizeMm },
    { x: paper.width - offsetMm - sizeMm, y: offsetMm, size: sizeMm },
    { x: offsetMm, y: paper.height - offsetMm - sizeMm, size: sizeMm },
    {
      x: paper.width - offsetMm - sizeMm,
      y: paper.height - offsetMm - sizeMm,
      size: sizeMm,
    },
  ]
}

function computeMultiPageLayoutFromDefinition(
  definition: AnswerSheetDefinition
): ComputedMultiPageLayout {
  const { settings, majorQuestions } = definition
  const paper = getPaperDimensions(settings)
  const { margins, baseRowHeight, columnWidths, spacing } = settings

  const contentLeft = margins.left
  const contentRight = paper.width - margins.right
  const contentTop = margins.top + spacing.headerHeight
  const contentMaxY = paper.height - margins.bottom

  const majorNumX = contentLeft
  const majorNumWidth = columnWidths.majorNumber
  const subNumX = majorNumX + majorNumWidth
  const subNumWidth = columnWidths.subNumber

  const hasBranch = majorQuestions.some((mq) =>
    mq.subQuestions.some((sq) => sq.branchQuestions.length > 0)
  )
  const branchNumX = subNumX + subNumWidth
  const branchNumWidth = hasBranch ? columnWidths.branchNumber : 0
  const answerX = branchNumX + branchNumWidth
  const answerWidth = contentRight - answerX

  interface PageData {
    cells: ComputedCell[]
    lines: ComputedLine[]
    numberLabels: ComputedNumberLabel[]
    verticalRanges: { top: number; bottom: number }[]
    branchVerticalRanges: { top: number; bottom: number }[]
    contentBottomY: number
  }

  function newPageData(): PageData {
    return {
      cells: [],
      lines: [],
      numberLabels: [],
      verticalRanges: [],
      branchVerticalRanges: [],
      contentBottomY: contentTop,
    }
  }

  const pagesData: PageData[] = [newPageData()]
  let currentPageIdx = 0
  let currentY = contentTop

  function layoutMajorOnPage(
    page: PageData,
    major: MajorQuestion,
    mi: number,
    startY: number,
    pageIdx: number
  ): number {
    let localY = startY
    const majorStartY = localY
    const majorHeight = computeMajorHeight(major, baseRowHeight)

    // 大問番号ラベル
    page.numberLabels.push({
      text: major.label,
      x: majorNumX,
      y: majorStartY,
      width: majorNumWidth,
      height:
        settings.numberDisplayMode === "multirow" ? majorHeight : baseRowHeight,
      fontSize: settings.fonts.numberSize,
      displayMode: settings.numberDisplayMode,
    })

    const layoutRows = buildLayoutRows(
      major.subQuestions,
      major.horizontalColumnsPerRow
    )
    const horizontalAreaX = majorNumX + majorNumWidth
    const horizontalAreaWidth = contentRight - horizontalAreaX

    let vertSegStart: number | null = null

    layoutRows.forEach((row, ri) => {
      if (row.type === "horizontal") {
        if (vertSegStart !== null) {
          page.verticalRanges.push({ top: vertSegStart, bottom: localY })
          vertSegStart = null
        }

        const rowMaxH = Math.max(
          ...row.subs.map((s) => s.sub.heightMultiplier),
          1
        )
        const rowHeight = rowMaxH * baseRowHeight
        const unitWidth = horizontalAreaWidth / row.columns

        row.subs.forEach((entry) => {
          const cellX = horizontalAreaX + entry.colStart * unitWidth
          const cellWidth = entry.span * unitWidth

          page.numberLabels.push({
            text: entry.sub.label,
            x: cellX,
            y: localY,
            width: cellWidth,
            height: rowHeight,
            fontSize: settings.fonts.numberSize,
            displayMode: "sub-horizontal",
          })

          page.cells.push(
            createCell(
              [mi, entry.subIndex],
              cellX,
              localY,
              cellWidth,
              rowHeight,
              paper,
              `${major.label}-${entry.sub.label}`,
              entry.sub.points,
              entry.sub.textElements,
              entry.sub.modelAnswer,
              "answer",
              pageIdx,
              computeManuscriptGrid(entry.sub, cellX, localY, cellWidth),
              entry.sub.omrConfig
            )
          )

          const cellRight = cellX + cellWidth
          if (Math.abs(cellRight - contentRight) > 0.01) {
            page.lines.push({
              x1: cellRight,
              y1: localY,
              x2: cellRight,
              y2: localY + rowHeight,
              style: settings.borderConfig.subDivider,
              lineType: "subHorizontalDivider",
              strokeWidth: getLineWidth(
                "subHorizontalDivider",
                settings.borderConfig
              ),
            })
          }
        })

        localY += rowHeight
      } else {
        if (vertSegStart === null) vertSegStart = localY

        const sub = row.sub
        const si = row.subIndex
        const subStartY = localY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = computeSubHeight(sub, baseRowHeight)

        page.numberLabels.push({
          text: sub.label,
          x: subNumX,
          y: subStartY,
          width: subNumWidth,
          height: subHeight,
          fontSize: settings.fonts.numberSize,
          displayMode: "sub",
        })

        if (hasBranches) {
          const branchRows = buildBranchLayoutRows(
            sub.branchQuestions,
            sub.branchHorizontalColumnsPerRow
          )
          const branchAreaX = subNumX + subNumWidth
          const branchAreaWidth = contentRight - branchAreaX
          let branchY = subStartY
          let bVertSegStart: number | null = null

          branchRows.forEach((bRow, bri) => {
            if (bRow.type === "horizontal") {
              if (bVertSegStart !== null) {
                page.branchVerticalRanges.push({
                  top: bVertSegStart,
                  bottom: branchY,
                })
                bVertSegStart = null
              }

              const rowMaxH = Math.max(
                ...bRow.branches.map((b) => b.branch.heightMultiplier),
                1
              )
              const bRowHeight = rowMaxH * baseRowHeight
              const unitWidth = branchAreaWidth / bRow.columns

              bRow.branches.forEach((entry) => {
                const cellX = branchAreaX + entry.colStart * unitWidth
                const cellWidth = entry.span * unitWidth

                page.numberLabels.push({
                  text: entry.branch.label,
                  x: cellX,
                  y: branchY,
                  width: cellWidth,
                  height: bRowHeight,
                  fontSize: settings.fonts.numberSize - 1,
                  displayMode: "branch-horizontal",
                })

                page.cells.push(
                  createCell(
                    [mi, si, entry.branchIndex],
                    cellX,
                    branchY,
                    cellWidth,
                    bRowHeight,
                    paper,
                    `${major.label}-${sub.label}-${entry.branch.label}`,
                    entry.branch.points,
                    entry.branch.textElements,
                    entry.branch.modelAnswer,
                    "answer",
                    pageIdx,
                    undefined,
                    entry.branch.omrConfig
                  )
                )

                const cellRight = cellX + cellWidth
                if (Math.abs(cellRight - contentRight) > 0.01) {
                  page.lines.push({
                    x1: cellRight,
                    y1: branchY,
                    x2: cellRight,
                    y2: branchY + bRowHeight,
                    style: settings.borderConfig.branchDivider,
                    lineType: "branch",
                    strokeWidth: getLineWidth("branch", settings.borderConfig),
                  })
                }
              })

              branchY += bRowHeight
            } else {
              if (bVertSegStart === null) bVertSegStart = branchY

              const branch = bRow.branch
              const branchHeight = branch.heightMultiplier * baseRowHeight

              page.numberLabels.push({
                text: branch.label,
                x: branchNumX,
                y: branchY,
                width: branchNumWidth,
                height: branchHeight,
                fontSize: settings.fonts.numberSize - 1,
                displayMode: "branch",
              })

              page.cells.push(
                createCell(
                  [mi, si, bRow.branchIndex],
                  answerX,
                  branchY,
                  answerWidth,
                  branchHeight,
                  paper,
                  `${major.label}-${sub.label}-${branch.label}`,
                  branch.points,
                  branch.textElements,
                  branch.modelAnswer,
                  "answer",
                  pageIdx,
                  undefined,
                  branch.omrConfig
                )
              )

              branchY += branchHeight
            }

            // 枝問行間の区切り線
            if (bri < branchRows.length - 1) {
              const nextBRow = branchRows[bri + 1]
              const lineX =
                bRow.type === "horizontal" || nextBRow.type === "horizontal"
                  ? branchAreaX
                  : branchNumX
              page.lines.push({
                x1: lineX,
                y1: branchY,
                x2: contentRight,
                y2: branchY,
                style: settings.borderConfig.branchDivider,
                lineType: "branch",
                strokeWidth: getLineWidth("branch", settings.borderConfig),
              })
            }
          })

          if (bVertSegStart !== null) {
            page.branchVerticalRanges.push({
              top: bVertSegStart,
              bottom: branchY,
            })
          }
        } else {
          page.cells.push(
            createCell(
              [mi, si],
              answerX,
              subStartY,
              answerWidth,
              subHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              sub.modelAnswer,
              "answer",
              pageIdx,
              computeManuscriptGrid(sub, answerX, subStartY, answerWidth),
              sub.omrConfig
            )
          )
        }

        localY += subHeight
      }

      // 行間の区切り線（最後の行以外）
      if (ri < layoutRows.length - 1) {
        const nextRow = layoutRows[ri + 1]
        if (row.type === "horizontal" && nextRow.type === "horizontal") {
          page.lines.push({
            x1: horizontalAreaX,
            y1: localY,
            x2: contentRight,
            y2: localY,
            style: settings.borderConfig.subDivider,
            lineType: "subHorizontalDivider",
            strokeWidth: getLineWidth(
              "subHorizontalDivider",
              settings.borderConfig
            ),
          })
        } else {
          page.lines.push({
            x1: row.type === "horizontal" ? horizontalAreaX : subNumX,
            y1: localY,
            x2: contentRight,
            y2: localY,
            style: settings.borderConfig.subDivider,
            lineType: "sub",
            strokeWidth: getLineWidth("sub", settings.borderConfig),
          })
        }
      }
    })

    if (vertSegStart !== null) {
      page.verticalRanges.push({ top: vertSegStart, bottom: localY })
    }

    return localY
  }

  // 大問を順番に配置
  for (let mi = 0; mi < majorQuestions.length; mi++) {
    const major = majorQuestions[mi]
    const majorHeight = computeMajorHeight(major, baseRowHeight)
    const spacingHeight =
      mi > 0 && currentY > contentTop ? spacing.majorQuestionSpacing : 0

    if (
      currentY + spacingHeight + majorHeight > contentMaxY &&
      currentY > contentTop
    ) {
      pagesData[currentPageIdx].contentBottomY = currentY
      currentPageIdx++
      pagesData.push(newPageData())
      currentY = contentTop
    } else {
      currentY += spacingHeight
    }

    currentY = layoutMajorOnPage(
      pagesData[currentPageIdx],
      major,
      mi,
      currentY,
      currentPageIdx
    )

    if (mi < majorQuestions.length - 1) {
      pagesData[currentPageIdx].lines.push({
        x1: contentLeft,
        y1: currentY,
        x2: contentRight,
        y2: currentY,
        style: settings.borderConfig.majorDivider,
        lineType: "major",
        strokeWidth: getLineWidth("major", settings.borderConfig),
      })
    }
  }

  pagesData[currentPageIdx].contentBottomY = currentY

  // ページごとにborder線・番号列線・OMRマーカーを追加
  const pages: ComputedPageLayout[] = pagesData.map((pd, idx) => {
    const pageContentBottom = pd.contentBottomY

    // ページ末尾の大問区切り線を削除
    const lastLine = pd.lines[pd.lines.length - 1]
    if (
      lastLine &&
      lastLine.lineType === "major" &&
      Math.abs(lastLine.y1 - pageContentBottom) < 0.01
    ) {
      pd.lines.pop()
    }

    // 外枠線
    addBorderLines(
      pd.lines,
      contentLeft,
      contentTop,
      contentRight,
      pageContentBottom,
      settings.borderConfig.outerBorder,
      settings.borderConfig
    )

    // 番号列の縦線
    const ncSwPage = getLineWidth("numberColumn", settings.borderConfig)

    // 大問番号列の縦線
    pd.lines.push({
      x1: majorNumX + majorNumWidth,
      y1: contentTop,
      x2: majorNumX + majorNumWidth,
      y2: pageContentBottom,
      style: settings.borderConfig.numberColumnDivider,
      lineType: "numberColumn",
      strokeWidth: ncSwPage,
    })

    // 小問番号列の縦線（縦配置セグメントのみ）
    for (const range of pd.verticalRanges) {
      pd.lines.push({
        x1: subNumX + subNumWidth,
        y1: range.top,
        x2: subNumX + subNumWidth,
        y2: range.bottom,
        style: settings.borderConfig.numberColumnDivider,
        lineType: "numberColumn",
        strokeWidth: ncSwPage,
      })
    }

    // 枝問番号列の縦線（vertical-branchセグメントのみ）
    if (hasBranch) {
      for (const range of pd.branchVerticalRanges) {
        pd.lines.push({
          x1: branchNumX + branchNumWidth,
          y1: range.top,
          x2: branchNumX + branchNumWidth,
          y2: range.bottom,
          style: settings.borderConfig.numberColumnDivider,
          lineType: "numberColumn",
          strokeWidth: ncSwPage,
        })
      }
    }

    const omrMarkerPositions = computeOMRMarkers(settings, paper)

    return {
      pageIndex: idx,
      cells: pd.cells,
      lines: pd.lines,
      numberLabels: pd.numberLabels,
      omrMarkerPositions,
      contentHeightMm: pageContentBottom - margins.top,
    }
  })

  return {
    pages,
    totalPages: pages.length,
    pageWidthMm: paper.width,
    pageHeightMm: paper.height,
  }
}

/** 単一ページレイアウト（後方互換） */
export function useAnswerSheetLayout(
  definition: AnswerSheetDefinition
): ComputedLayout {
  return useMemo(() => computeLayoutFromDefinition(definition), [definition])
}

/** 複数ページレイアウト */
export function useMultiPageLayout(
  definition: AnswerSheetDefinition
): ComputedMultiPageLayout {
  return useMemo(
    () => computeMultiPageLayoutFromDefinition(definition),
    [definition]
  )
}
