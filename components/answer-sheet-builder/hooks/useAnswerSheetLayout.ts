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
  ComputedCell,
  ComputedLayout,
  ComputedLine,
  ComputedNumberLabel,
  ComputedOMRMarker,
  GlobalSettings,
  LineStyle,
  MajorQuestion,
  SubQuestion,
} from "@/types/answerSheetBuilder.types"

import { PAPER_SIZES } from "../constants"

function getPaperDimensions(settings: GlobalSettings) {
  const base = PAPER_SIZES[settings.paperSize] ?? PAPER_SIZES.A4
  if (settings.orientation === "landscape") {
    return { width: base.height, height: base.width }
  }
  return { width: base.width, height: base.height }
}

interface HorizontalRowAssignment {
  subs: { sub: SubQuestion; subIndex: number; colStart: number; span: number }[]
  columns: number
}

function assignSubsToRows(
  subQuestions: SubQuestion[],
  columnsPerRow: number[] | undefined
): HorizontalRowAssignment[] {
  const rows: HorizontalRowAssignment[] = []
  let rowIdx = 0
  let usedCols = 0
  const defaultCols = subQuestions.length

  for (let si = 0; si < subQuestions.length; si++) {
    const sub = subQuestions[si]
    const span = sub.colSpan ?? 1
    const maxCols =
      columnsPerRow && columnsPerRow.length > 0
        ? (columnsPerRow[rowIdx] ??
          columnsPerRow[columnsPerRow.length - 1] ??
          defaultCols)
        : defaultCols

    if (!rows[rowIdx]) {
      rows[rowIdx] = { subs: [], columns: maxCols }
    }

    if (usedCols + span > maxCols && usedCols > 0) {
      rowIdx++
      usedCols = 0
      const nextMaxCols =
        columnsPerRow && columnsPerRow.length > 0
          ? (columnsPerRow[rowIdx] ??
            columnsPerRow[columnsPerRow.length - 1] ??
            defaultCols)
          : defaultCols
      rows[rowIdx] = { subs: [], columns: nextMaxCols }
    }

    rows[rowIdx].subs.push({ sub, subIndex: si, colStart: usedCols, span })
    usedCols += span

    const currentMaxCols = rows[rowIdx].columns
    if (usedCols >= currentMaxCols) {
      rowIdx++
      usedCols = 0
    }
  }

  return rows
}

function computeMajorHeight(
  major: MajorQuestion,
  baseRowHeight: number
): number {
  const layout = major.subQuestionLayout ?? "vertical"
  if (layout === "horizontal") {
    const rows = assignSubsToRows(
      major.subQuestions,
      major.horizontalColumnsPerRow
    )
    return rows.reduce((sum, row) => {
      const maxH = Math.max(...row.subs.map((s) => s.sub.heightMultiplier), 1)
      return sum + maxH * baseRowHeight
    }, 0)
  }
  return major.subQuestions.reduce((sum, sub) => {
    if (sub.branchQuestions.length > 0) {
      return (
        sum +
        sub.branchQuestions.reduce(
          (bSum, bq) => bSum + bq.heightMultiplier * baseRowHeight,
          0
        )
      )
    }
    return sum + sub.heightMultiplier * baseRowHeight
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
    if (major.spacingBefore && mi > 0) {
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
        major.numberDisplayMode === "multirow" ? majorHeight : baseRowHeight,
      fontSize: settings.fonts.numberSize,
      displayMode: major.numberDisplayMode,
    })

    const isHorizontal =
      (major.subQuestionLayout ?? "vertical") === "horizontal"

    if (isHorizontal) {
      // 横配置: 大問番号列の右端から用紙右マージンまでが利用可能幅
      const horizontalAreaX = majorNumX + majorNumWidth
      const horizontalAreaWidth = contentRight - horizontalAreaX

      const rows = assignSubsToRows(
        major.subQuestions,
        major.horizontalColumnsPerRow
      )

      rows.forEach((row, ri) => {
        const rowMaxH = Math.max(
          ...row.subs.map((s) => s.sub.heightMultiplier),
          1
        )
        const rowHeight = rowMaxH * baseRowHeight
        const unitWidth = horizontalAreaWidth / row.columns

        row.subs.forEach((entry) => {
          const cellX = horizontalAreaX + entry.colStart * unitWidth
          const cellWidth = entry.span * unitWidth

          // 横配置時は小問ラベルをセル内左側に配置
          numberLabels.push({
            text: entry.sub.label,
            x: cellX,
            y: currentY,
            width: cellWidth,
            height: rowHeight,
            fontSize: settings.fonts.numberSize,
            displayMode: "sub-horizontal",
          })

          cells.push({
            questionPath: [mi, entry.subIndex],
            x: cellX,
            y: currentY,
            width: cellWidth,
            height: rowHeight,
            normalizedX: cellX / paper.width,
            normalizedY: currentY / paper.height,
            normalizedW: cellWidth / paper.width,
            normalizedH: rowHeight / paper.height,
            label: `${major.label}-${entry.sub.label}`,
            points: entry.sub.points,
            textElements: entry.sub.textElements,
            modelAnswer: entry.sub.modelAnswer,
            cellType: "answer",
          })

          // 列間の垂直区切り線（セル右端が領域右端でない場合）
          const cellRight = cellX + cellWidth
          if (Math.abs(cellRight - contentRight) > 0.01) {
            lines.push({
              x1: cellRight,
              y1: currentY,
              x2: cellRight,
              y2: currentY + rowHeight,
              style: settings.borderConfig.subDivider,
              lineType: "subHorizontalDivider",
            })
          }
        })

        currentY += rowHeight

        // 行間の水平区切り線（最後の行以外）
        if (ri < rows.length - 1) {
          lines.push({
            x1: horizontalAreaX,
            y1: currentY,
            x2: contentRight,
            y2: currentY,
            style: settings.borderConfig.subDivider,
            lineType: "subHorizontalDivider",
          })
        }
      })
    } else {
      // 縦配置: 既存ロジック
      major.subQuestions.forEach((sub, si) => {
        const subStartY = currentY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = hasBranches
          ? sub.branchQuestions.reduce(
              (sum, bq) => sum + bq.heightMultiplier * baseRowHeight,
              0
            )
          : sub.heightMultiplier * baseRowHeight

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
          let branchY = subStartY
          sub.branchQuestions.forEach((branch, bi) => {
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

            cells.push({
              questionPath: [mi, si, bi],
              x: answerX,
              y: branchY,
              width: answerWidth,
              height: branchHeight,
              normalizedX: answerX / paper.width,
              normalizedY: branchY / paper.height,
              normalizedW: answerWidth / paper.width,
              normalizedH: branchHeight / paper.height,
              label: `${major.label}-${sub.label}-${branch.label}`,
              points: branch.points,
              textElements: branch.textElements,
              modelAnswer: branch.modelAnswer,
              cellType: "answer",
            })

            if (bi < sub.branchQuestions.length - 1) {
              lines.push({
                x1: branchNumX,
                y1: branchY + branchHeight,
                x2: contentRight,
                y2: branchY + branchHeight,
                style: settings.borderConfig.branchDivider,
                lineType: "branch",
                dragInfo: {
                  axis: "horizontal",
                  target: {
                    type: "heightMultiplier",
                    majorIndex: mi,
                    subIndex: si,
                    branchIndex: bi,
                  },
                  currentValueMm: branchHeight,
                  minMm: baseRowHeight * 0.5,
                },
              })
            }

            branchY += branchHeight
          })
        } else {
          cells.push({
            questionPath: [mi, si],
            x: answerX,
            y: subStartY,
            width: answerWidth,
            height: subHeight,
            normalizedX: answerX / paper.width,
            normalizedY: subStartY / paper.height,
            normalizedW: answerWidth / paper.width,
            normalizedH: subHeight / paper.height,
            label: `${major.label}-${sub.label}`,
            points: sub.points,
            textElements: sub.textElements,
            modelAnswer: sub.modelAnswer,
            cellType: "answer",
          })
        }

        currentY += subHeight

        if (si < major.subQuestions.length - 1) {
          lines.push({
            x1: subNumX,
            y1: currentY,
            x2: contentRight,
            y2: currentY,
            style: settings.borderConfig.subDivider,
            lineType: "sub",
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
        }
      })
    }

    if (mi < majorQuestions.length - 1) {
      lines.push({
        x1: contentLeft,
        y1: currentY,
        x2: contentRight,
        y2: currentY,
        style: settings.borderConfig.majorDivider,
        lineType: "major",
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
    settings.borderConfig.outerBorder
  )

  // 縦配置の大問のY範囲を収集（番号列セグメント化用）
  const verticalRanges: { top: number; bottom: number }[] = []
  {
    let trackY = margins.top + spacing.headerHeight
    majorQuestions.forEach((mq, mi) => {
      if (mq.spacingBefore && mi > 0) {
        trackY += spacing.majorQuestionSpacing
      }
      const mh = computeMajorHeight(mq, baseRowHeight)
      if ((mq.subQuestionLayout ?? "vertical") === "vertical") {
        verticalRanges.push({ top: trackY, bottom: trackY + mh })
      }
      trackY += mh
    })
  }

  // 大問番号列の縦線 → 全高（従来通り）
  lines.push({
    x1: majorNumX + majorNumWidth,
    y1: contentTop,
    x2: majorNumX + majorNumWidth,
    y2: contentBottom,
    style: settings.borderConfig.numberColumnDivider,
    lineType: "numberColumn",
    dragInfo: {
      axis: "vertical",
      target: { type: "columnWidth", column: "majorNumber" },
      currentValueMm: majorNumWidth,
      minMm: 5,
    },
  })

  // 小問/枝問番号列の縦線 → 縦配置のセグメントのみ
  for (const range of verticalRanges) {
    lines.push({
      x1: subNumX + subNumWidth,
      y1: range.top,
      x2: subNumX + subNumWidth,
      y2: range.bottom,
      style: settings.borderConfig.numberColumnDivider,
      lineType: "numberColumn",
      dragInfo: {
        axis: "vertical",
        target: { type: "columnWidth", column: "subNumber" },
        currentValueMm: subNumWidth,
        minMm: 5,
      },
    })
    if (hasBranch) {
      lines.push({
        x1: branchNumX + branchNumWidth,
        y1: range.top,
        x2: branchNumX + branchNumWidth,
        y2: range.bottom,
        style: settings.borderConfig.numberColumnDivider,
        lineType: "numberColumn",
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
  style: LineStyle
) {
  lines.push({ x1: l, y1: t, x2: r, y2: t, style, lineType: "outer" })
  lines.push({ x1: l, y1: b, x2: r, y2: b, style, lineType: "outer" })
  lines.push({ x1: l, y1: t, x2: l, y2: b, style, lineType: "outer" })
  lines.push({ x1: r, y1: t, x2: r, y2: b, style, lineType: "outer" })
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

export function useAnswerSheetLayout(
  definition: AnswerSheetDefinition
): ComputedLayout {
  return useMemo(() => computeLayoutFromDefinition(definition), [definition])
}
