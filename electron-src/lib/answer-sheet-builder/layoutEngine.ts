/**
 * 解答用紙レイアウトエンジン
 *
 * AnswerSheetDefinition → ComputedLayout 変換を行う。
 * フロントエンド（プレビュー）とElectron（PDF/PNG出力）の両方で使用。
 */

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
} from "../../../types/answerSheetBuilder.types"

// 用紙サイズ定義（mmで直接持つ: Electron側ではcomponents/をimportしない）
const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  B5: { width: 182, height: 257 },
  B4: { width: 257, height: 364 },
  A3: { width: 297, height: 420 },
}

/** 用紙の実効サイズ（向き適用後）を取得 */
function getPaperDimensions(settings: GlobalSettings): {
  width: number
  height: number
} {
  const base = PAPER_SIZES[settings.paperSize] ?? PAPER_SIZES.A4
  if (settings.orientation === "landscape") {
    return { width: base.height, height: base.width }
  }
  return { width: base.width, height: base.height }
}

/** レイアウト計算のメイン関数 */
export function computeLayout(
  definition: AnswerSheetDefinition
): ComputedLayout {
  const { settings, majorQuestions } = definition
  const paper = getPaperDimensions(settings)
  const { margins, baseRowHeight, columnWidths, spacing } = settings

  const contentLeft = margins.left
  const contentRight = paper.width - margins.right

  // 各列のX座標を計算
  const majorNumX = contentLeft
  const majorNumWidth = columnWidths.majorNumber
  const subNumX = majorNumX + majorNumWidth
  const subNumWidth = columnWidths.subNumber

  // 枝問番号列は使われる場合のみ
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

  // 各大問を処理
  majorQuestions.forEach((major, mi) => {
    // 大問前スペーシング
    if (major.spacingBefore && mi > 0) {
      currentY += spacing.majorQuestionSpacing
    }

    const majorStartY = currentY
    const majorHeight = computeMajorHeight(major, baseRowHeight)

    // 大問番号セル
    if (major.numberDisplayMode === "multirow") {
      numberLabels.push({
        text: major.label,
        x: majorNumX,
        y: majorStartY,
        width: majorNumWidth,
        height: majorHeight,
        fontSize: settings.fonts.numberSize,
        displayMode: "multirow",
      })
    } else {
      // boxed-top: 最初の小問の上端に四角囲み
      numberLabels.push({
        text: major.label,
        x: majorNumX,
        y: majorStartY,
        width: majorNumWidth,
        height: baseRowHeight,
        fontSize: settings.fonts.numberSize,
        displayMode: "boxed-top",
      })
    }

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
              "answer"
            )
          )

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
      // 各小問を処理（縦配置）
      major.subQuestions.forEach((sub, si) => {
        const subStartY = currentY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = hasBranches
          ? sub.branchQuestions.reduce(
              (sum, bq) => sum + bq.heightMultiplier * baseRowHeight,
              0
            )
          : sub.heightMultiplier * baseRowHeight

        // 小問番号ラベル
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
          // 枝問あり: 各枝問のセルを作成
          let branchY = subStartY
          sub.branchQuestions.forEach((branch, bi) => {
            const branchHeight = branch.heightMultiplier * baseRowHeight

            // 枝問番号ラベル
            numberLabels.push({
              text: branch.label,
              x: branchNumX,
              y: branchY,
              width: branchNumWidth,
              height: branchHeight,
              fontSize: settings.fonts.numberSize - 1,
              displayMode: "branch",
            })

            // 解答セル
            cells.push(
              createCell(
                [mi, si, bi],
                answerX,
                branchY,
                answerWidth,
                branchHeight,
                paper,
                `${major.label}-${sub.label}-${branch.label}`,
                branch.points,
                branch.textElements,
                branch.modelAnswer,
                "answer"
              )
            )

            // 枝問の区切り線（最後以外）
            if (bi < sub.branchQuestions.length - 1) {
              lines.push({
                x1: branchNumX,
                y1: branchY + branchHeight,
                x2: contentRight,
                y2: branchY + branchHeight,
                style: settings.borderConfig.branchDivider,
                lineType: "branch",
              })
            }

            branchY += branchHeight
          })
        } else {
          // 枝問なし: 小問のセルを直接作成
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
              "answer"
            )
          )
        }

        currentY += subHeight

        // 小問の区切り線（最後以外）
        if (si < major.subQuestions.length - 1) {
          lines.push({
            x1: subNumX,
            y1: currentY,
            x2: contentRight,
            y2: currentY,
            style: settings.borderConfig.subDivider,
            lineType: "sub",
          })
        }
      })
    }

    // 大問の区切り線（最後以外）
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

  // 外枠線
  addOuterBorderLines(
    lines,
    contentLeft,
    margins.top + spacing.headerHeight,
    contentRight,
    contentBottom,
    settings.borderConfig.outerBorder
  )

  // 縦配置の大問のY範囲を収集（番号列セグメント化用）
  const verticalRanges: { top: number; bottom: number }[] = []
  {
    let trackY = margins.top + spacing.headerHeight
    majorQuestions.forEach((mq, mi2) => {
      if (mq.spacingBefore && mi2 > 0) {
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
  addNumberColumnLines(
    lines,
    majorNumX + majorNumWidth,
    margins.top + spacing.headerHeight,
    contentBottom,
    settings.borderConfig.numberColumnDivider
  )

  // 小問/枝問番号列の縦線 → 縦配置のセグメントのみ
  for (const range of verticalRanges) {
    addNumberColumnLines(
      lines,
      subNumX + subNumWidth,
      range.top,
      range.bottom,
      settings.borderConfig.numberColumnDivider
    )
    if (hasBranch) {
      addNumberColumnLines(
        lines,
        branchNumX + branchNumWidth,
        range.top,
        range.bottom,
        settings.borderConfig.numberColumnDivider
      )
    }
  }

  // OMRマーカー
  const omrMarkerPositions = computeOMRMarkers(settings, paper)

  const overflow = contentBottom > paper.height - margins.bottom

  return {
    pageWidthMm: paper.width,
    pageHeightMm: paper.height,
    cells,
    lines,
    numberLabels,
    omrMarkerPositions,
    overflow,
    contentHeightMm: contentBottom - margins.top,
  }
}

// =====================
// ヘルパー関数
// =====================

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
  cellType: ComputedCell["cellType"]
): ComputedCell {
  return {
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
  }
}

function addOuterBorderLines(
  lines: ComputedLine[],
  left: number,
  top: number,
  right: number,
  bottom: number,
  style: LineStyle
): void {
  // 上
  lines.push({
    x1: left,
    y1: top,
    x2: right,
    y2: top,
    style,
    lineType: "outer",
  })
  // 下
  lines.push({
    x1: left,
    y1: bottom,
    x2: right,
    y2: bottom,
    style,
    lineType: "outer",
  })
  // 左
  lines.push({
    x1: left,
    y1: top,
    x2: left,
    y2: bottom,
    style,
    lineType: "outer",
  })
  // 右
  lines.push({
    x1: right,
    y1: top,
    x2: right,
    y2: bottom,
    style,
    lineType: "outer",
  })
}

function addNumberColumnLines(
  lines: ComputedLine[],
  x: number,
  top: number,
  bottom: number,
  style: LineStyle
): void {
  lines.push({
    x1: x,
    y1: top,
    x2: x,
    y2: bottom,
    style,
    lineType: "numberColumn",
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
    {
      x: offsetMm,
      y: paper.height - offsetMm - sizeMm,
      size: sizeMm,
    },
    {
      x: paper.width - offsetMm - sizeMm,
      y: paper.height - offsetMm - sizeMm,
      size: sizeMm,
    },
  ]
}
