/**
 * 単一ページレイアウト計算
 *
 * AnswerSheetDefinition → ComputedLayout への変換を行う。
 * 全大問を1ページに収めるレイアウトを計算する。
 */

import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"
import type {
  ComputedCell,
  ComputedHeaderField,
  ComputedLayout,
  ComputedLine,
  ComputedNumberLabel,
} from "@/types/answerSheetLayout.types"

import {
  computeMajorHeight,
  computeManuscriptGrid,
  computeSubHeight,
  createCell,
} from "./cellBuilder"
import { computeMultiPageLayoutFromDefinition } from "./computeMultiPageLayout"
import {
  buildBranchGridLayout,
  buildSubGridLayout,
  computeGridRowLeftEdges,
  computeGridRowRightEdges,
  gridTotalHeight,
  isGridHorizontal,
  mergeAbsoluteRightEdges,
} from "./gridBuilder"
import { computeHeaderFieldLayout } from "./headerFieldLayout"
import {
  clipRangeToMajorLayouts,
  getLineWidth,
  getPaperDimensions,
} from "./layoutUtils"
import {
  addSteppedBorderLines,
  computeOMRMarkers,
  renderBranchQuestions,
  renderGridCompletionLines,
  renderGridDividerLines,
} from "./lineRenderer"
import { transformLayoutToVertical } from "./verticalTransform"

/** AnswerSheetDefinition から単一ページの ComputedLayout を計算する */
export function computeLayoutFromDefinition(
  definition: AnswerSheetDefinition
): ComputedLayout {
  const vertical = definition.settings.verticalLayout ?? false
  const settings = definition.settings

  // 段組みが有効な場合はマルチページレイアウトに委譲
  // （縦書きでは論理の左右段が transpose により上下段になる）
  if (settings.multiColumn.enabled && settings.multiColumn.columnCount > 1) {
    const multiPage = computeMultiPageLayoutFromDefinition(definition)
    const page = multiPage.pages[0]
    if (!page) {
      return {
        pageWidthMm: multiPage.pageWidthMm,
        pageHeightMm: multiPage.pageHeightMm,
        cells: [],
        lines: [],
        numberLabels: [],
        omrMarkerPositions: [],
        headerFields: [],
        overflow: false,
        contentHeightMm: 0,
        vertical,
      }
    }
    return {
      pageWidthMm: multiPage.pageWidthMm,
      pageHeightMm: multiPage.pageHeightMm,
      cells: page.cells,
      lines: page.lines,
      numberLabels: page.numberLabels,
      omrMarkerPositions: page.omrMarkerPositions,
      headerFields: page.headerFields,
      overflow: multiPage.totalPages > 1,
      contentHeightMm: page.contentHeightMm,
      vertical: page.vertical,
    }
  }

  const { majorQuestions } = definition
  // 縦組みは「幅高さを入れ替えた論理ページ」で計算し、最終段で transpose して実寸へ写す
  const realPaper = getPaperDimensions(settings)
  const paper = vertical
    ? { width: realPaper.height, height: realPaper.width }
    : realPaper
  const { margins, baseRowHeight, columnWidths, spacing } = settings

  const contentLeft = margins.left
  const contentRight = paper.width - margins.right

  // ヘッダーフィールドレイアウト計算
  const headerLayout = computeHeaderFieldLayout(
    settings,
    contentLeft,
    margins.top,
    contentRight
  )
  const headerFields: ComputedHeaderField[] = headerLayout.fields
  const effectiveHeaderHeight =
    headerLayout.totalHeightMm > 0
      ? headerLayout.totalHeightMm + 2 + spacing.headerHeight
      : spacing.headerHeight

  const majorNumX = contentLeft
  const majorNumWidth = columnWidths.majorNumber
  const subNumX = majorNumX + majorNumWidth
  const subNumWidth = columnWidths.subNumber

  const hasBranch = majorQuestions.some((majorQuestion) =>
    majorQuestion.subQuestions.some(
      (subQuestion) => subQuestion.branchQuestions.length > 0
    )
  )
  const branchNumWidth = hasBranch ? columnWidths.branchNumber : 0

  const cells: ComputedCell[] = []
  const lines: ComputedLine[] = []
  const numberLabels: ComputedNumberLabel[] = []

  // 大問ごとのレイアウト範囲を追跡（外枠描画用）
  const majorLayoutRanges: Array<{
    startY: number
    endY: number
    rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
    rowLeftEdges: { yTop: number; yBottom: number; leftX: number }[]
  }> = []

  let currentY = margins.top + effectiveHeaderHeight

  majorQuestions.forEach((major, majorIndex) => {
    if (majorIndex > 0) {
      currentY += spacing.majorQuestionSpacing
    }

    const majorStartY = currentY
    const horizontalAreaX = majorNumX + majorNumWidth
    const horizontalAreaWidth = contentRight - horizontalAreaX
    const majorHeight = computeMajorHeight(
      major,
      baseRowHeight,
      horizontalAreaWidth,
      subNumWidth
    )
    // 大問ごとの行エッジ追跡
    const majorRightEdges: {
      yTop: number
      yBottom: number
      rightX: number
    }[] = []
    const majorLeftEdges: {
      yTop: number
      yBottom: number
      leftX: number
    }[] = []

    numberLabels.push({
      text: major.label,
      x: majorNumX,
      y: majorStartY,
      width: majorNumWidth,
      height:
        settings.numberDisplayMode === "multirow" ? majorHeight : baseRowHeight,
      fontSize: settings.fonts.majorNumberSize,
      displayMode: settings.numberDisplayMode,
    })

    const subIsHorizontal = isGridHorizontal(major.subQuestions)

    if (subIsHorizontal) {
      // === 横配置（グリッド）モード ===
      // 原稿用紙セルの layoutWidth を必要幅に合わせる
      const subsForGrid = major.subQuestions.map((sub) => {
        if (sub.manuscriptPaper?.enabled && sub.branchQuestions.length === 0) {
          const snw = sub.label === "" ? 0 : subNumWidth
          const reqW =
            baseRowHeight * sub.heightMultiplier * sub.manuscriptPaper.columns +
            snw
          return { ...sub, layoutWidth: String(reqW / horizontalAreaWidth) }
        }
        return sub
      })
      const gridCells = buildSubGridLayout(subsForGrid)
      for (const gridCell of gridCells) {
        const cellX = horizontalAreaX + gridCell.x * horizontalAreaWidth
        const cellWidth = gridCell.width * horizontalAreaWidth
        const cellY = majorStartY + gridCell.y * baseRowHeight
        const cellHeight = gridCell.height * baseRowHeight
        const sub = gridCell.item
        const hasBranches = sub.branchQuestions.length > 0
        const effSubNumW = sub.label === "" ? 0 : subNumWidth

        if (effSubNumW > 0) {
          numberLabels.push({
            text: sub.label,
            x: cellX,
            y: cellY,
            width: effSubNumW,
            height: cellHeight,
            fontSize: settings.fonts.subNumberSize,
            displayMode: "sub-horizontal",
          })
        }

        if (hasBranches) {
          // 枝問をセル内でレンダリング
          const cellBranchNumX = cellX + effSubNumW
          const cellBranchNumWidth = branchNumWidth
          const cellAnswerX = cellBranchNumX + cellBranchNumWidth
          const cellAnswerWidth = cellWidth - effSubNumW - cellBranchNumWidth
          const cellRight = cellX + cellWidth
          renderBranchQuestions(
            sub,
            majorIndex,
            gridCell.itemIndex,
            major.label,
            cellY,
            0,
            cellX,
            effSubNumW,
            cellBranchNumX,
            cellBranchNumWidth,
            cellAnswerX,
            cellAnswerWidth,
            cellRight,
            baseRowHeight,
            paper,
            settings,
            cells,
            lines,
            numberLabels,
            majorRightEdges
          )
        } else {
          let ansX = cellX + effSubNumW
          let ansW = cellWidth - effSubNumW
          if (sub.manuscriptPaper?.enabled) {
            const cellSz = cellHeight / sub.manuscriptPaper.rows
            const gridW = cellSz * sub.manuscriptPaper.columns
            ansW = gridW
          }
          cells.push(
            createCell(
              [majorIndex, gridCell.itemIndex],
              ansX,
              cellY,
              ansW,
              cellHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              "answer",
              0,
              computeManuscriptGrid(
                sub,
                ansX,
                cellY,
                ansW,
                cellHeight,
                settings.borderConfig
              ),
              sub.omrConfig,
              sub.imageElements
            )
          )
        }

        // 番号ラベル右側の区切り線
        if (effSubNumW > 0) {
          lines.push({
            x1: cellX + effSubNumW,
            y1: cellY,
            x2: cellX + effSubNumW,
            y2: cellY + cellHeight,
            style: settings.borderConfig.subNumberDivider,
            lineType: "subNumberColumn",
            strokeWidth: getLineWidth("subNumberColumn", settings.borderConfig),
          })
        }
      }

      // rowRightEdges: Y区間ごとの右端X座標を計算（枝問横配置を考慮）
      const rawRightEdges: { yTop: number; yBottom: number; rightX: number }[] =
        []
      for (const gridCell of gridCells) {
        const subQuestion = gridCell.item
        const gcCellX = horizontalAreaX + gridCell.x * horizontalAreaWidth
        const gcCellW = gridCell.width * horizontalAreaWidth
        const gcCellY = majorStartY + gridCell.y * baseRowHeight
        const gcCellH = gridCell.height * baseRowHeight
        const gcCellRight = gcCellX + gcCellW
        const gcEffSubNumW = subQuestion.label === "" ? 0 : subNumWidth

        if (
          subQuestion.branchQuestions.length > 0 &&
          isGridHorizontal(subQuestion.branchQuestions)
        ) {
          const branchAreaX = gcCellX + gcEffSubNumW
          const branchAreaWidth = gcCellRight - branchAreaX
          const branchCells = buildBranchGridLayout(subQuestion.branchQuestions)
          for (const edge of computeGridRowRightEdges(
            branchCells,
            gcCellY,
            branchAreaX,
            branchAreaWidth,
            baseRowHeight
          )) {
            rawRightEdges.push(edge)
          }
        } else {
          rawRightEdges.push({
            yTop: gcCellY,
            yBottom: gcCellY + gcCellH,
            rightX: gcCellRight,
          })
        }
      }
      for (const edge of mergeAbsoluteRightEdges(rawRightEdges)) {
        majorRightEdges.push(edge)
      }

      // rowLeftEdges: Y区間ごとの左端X座標を計算
      for (const edge of computeGridRowLeftEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )) {
        majorLeftEdges.push({
          yTop: edge.yTop,
          yBottom: edge.yBottom,
          leftX: edge.leftX,
        })
      }

      // グリッドセル間の区切り線（隣接セル間の共有辺）
      renderGridDividerLines(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight,
        settings,
        lines,
        "sub"
      )

      const majorEndY = majorStartY + gridTotalHeight(gridCells) * baseRowHeight

      // セルと空白スペースの境界線を補完（枝問横配置を反映したrightEdgesを使用）
      renderGridCompletionLines(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight,
        settings,
        lines,
        "sub",
        {
          top: majorStartY,
          bottom: majorEndY,
          rightEdges: majorRightEdges,
          leftEdges: majorLeftEdges,
        }
      )

      // 横配置モード: 大問番号枠を独立した長方形として描画
      const outerSw = getLineWidth("outer", settings.borderConfig)
      // 左辺
      lines.push({
        x1: contentLeft,
        y1: majorStartY,
        x2: contentLeft,
        y2: majorEndY,
        style: settings.borderConfig.outerBorder,
        strokeWidth: outerSw,
        lineType: "outer",
      })
      // 右辺
      lines.push({
        x1: horizontalAreaX,
        y1: majorStartY,
        x2: horizontalAreaX,
        y2: majorEndY,
        style: settings.borderConfig.outerBorder,
        strokeWidth: outerSw,
        lineType: "outer",
      })
      // 上辺
      lines.push({
        x1: contentLeft,
        y1: majorStartY,
        x2: horizontalAreaX,
        y2: majorStartY,
        style: settings.borderConfig.outerBorder,
        strokeWidth: outerSw,
        lineType: "outer",
      })
      // 下辺
      lines.push({
        x1: contentLeft,
        y1: majorEndY,
        x2: horizontalAreaX,
        y2: majorEndY,
        style: settings.borderConfig.outerBorder,
        strokeWidth: outerSw,
        lineType: "outer",
      })

      currentY = majorEndY
    } else {
      // === 縦配置モード ===
      // 各小問の右端X座標を事前計算（原稿用紙セルは必要幅に制限）
      const subRightEdges = major.subQuestions.map((sub) => {
        const hb = sub.branchQuestions.length > 0
        if (hb || !sub.manuscriptPaper?.enabled) return contentRight
        const sh = computeSubHeight(sub, baseRowHeight)
        const esnw = sub.label === "" ? 0 : subNumWidth
        const eax = subNumX + esnw
        return (
          eax + (sh / sub.manuscriptPaper.rows) * sub.manuscriptPaper.columns
        )
      })

      major.subQuestions.forEach((sub, subIndex) => {
        const subStartY = currentY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = computeSubHeight(sub, baseRowHeight)
        const effSubNumW = sub.label === "" ? 0 : subNumWidth
        const effBranchNumX = subNumX + effSubNumW
        const effBranchNumW = hasBranches ? branchNumWidth : 0
        const effAnswerX = effBranchNumX + effBranchNumW
        const effAnswerWidth = contentRight - effAnswerX

        if (effSubNumW > 0) {
          numberLabels.push({
            text: sub.label,
            x: subNumX,
            y: subStartY,
            width: effSubNumW,
            height: subHeight,
            fontSize: settings.fonts.subNumberSize,
            displayMode: "sub",
          })
        }

        if (hasBranches) {
          renderBranchQuestions(
            sub,
            majorIndex,
            subIndex,
            major.label,
            subStartY,
            0,
            subNumX,
            effSubNumW,
            effBranchNumX,
            branchNumWidth,
            effAnswerX,
            effAnswerWidth,
            subRightEdges[subIndex],
            baseRowHeight,
            paper,
            settings,
            cells,
            lines,
            numberLabels,
            majorRightEdges
          )
        } else {
          let ansW = effAnswerWidth
          if (sub.manuscriptPaper?.enabled) {
            const cellSz = subHeight / sub.manuscriptPaper.rows
            const gridW = cellSz * sub.manuscriptPaper.columns
            ansW = gridW
          }
          cells.push(
            createCell(
              [majorIndex, subIndex],
              effAnswerX,
              subStartY,
              ansW,
              subHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              "answer",
              0,
              computeManuscriptGrid(
                sub,
                effAnswerX,
                subStartY,
                ansW,
                subHeight,
                settings.borderConfig
              ),
              sub.omrConfig,
              sub.imageElements
            )
          )
        }

        // vertical-sub行の右端（枝問横配置時は枝問グリッドの右端を使用）
        if (hasBranches && isGridHorizontal(sub.branchQuestions)) {
          const branchAreaX = subNumX + effSubNumW
          const branchAreaWidth = subRightEdges[subIndex] - branchAreaX
          const branchCells = buildBranchGridLayout(sub.branchQuestions)
          for (const edge of computeGridRowRightEdges(
            branchCells,
            subStartY,
            branchAreaX,
            branchAreaWidth,
            baseRowHeight
          )) {
            majorRightEdges.push(edge)
          }
        } else {
          majorRightEdges.push({
            yTop: subStartY,
            yBottom: subStartY + subHeight,
            rightX: subRightEdges[subIndex],
          })
        }
        // vertical-sub行の左端は常にcontentLeft
        majorLeftEdges.push({
          yTop: subStartY,
          yBottom: subStartY + subHeight,
          leftX: contentLeft,
        })

        currentY += subHeight

        // 行間の区切り線（最後の行以外）
        if (subIndex < major.subQuestions.length - 1) {
          const dividerRightX = Math.max(
            subRightEdges[subIndex],
            subRightEdges[subIndex + 1]
          )
          lines.push({
            x1: subNumX,
            y1: currentY,
            x2: dividerRightX,
            y2: currentY,
            style: settings.borderConfig.subDivider,
            lineType: "sub",
            strokeWidth: getLineWidth("sub", settings.borderConfig),
            dragInfo: {
              axis: "horizontal",
              target: {
                type: "heightMultiplier",
                majorIndex: majorIndex,
                subIndex: subIndex,
              },
              currentValueMm: hasBranches
                ? sub.branchQuestions.reduce(
                    (sum, branchQuestion) =>
                      sum + branchQuestion.heightMultiplier * baseRowHeight,
                    0
                  )
                : sub.heightMultiplier * baseRowHeight,
              minMm: baseRowHeight * 0.5,
            },
          })
        }
      })
    }

    majorLayoutRanges.push({
      startY: majorStartY,
      endY: currentY,
      rowRightEdges: majorRightEdges,
      rowLeftEdges: majorLeftEdges,
    })

    if (
      spacing.majorQuestionSpacing === 0 &&
      majorIndex < majorQuestions.length - 1
    ) {
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
  const contentTop = margins.top + effectiveHeaderHeight

  // 外枠（ステップ形状対応）
  if (spacing.majorQuestionSpacing > 0 && majorLayoutRanges.length > 1) {
    for (const range of majorLayoutRanges) {
      addSteppedBorderLines(
        lines,
        contentLeft,
        range.startY,
        contentRight,
        range.endY,
        settings.borderConfig.outerBorder,
        settings.borderConfig,
        range.rowRightEdges,
        range.rowLeftEdges
      )
    }
  } else {
    const allRightEdges = majorLayoutRanges.flatMap(
      (range) => range.rowRightEdges
    )
    const allLeftEdges = majorLayoutRanges.flatMap(
      (range) => range.rowLeftEdges
    )
    addSteppedBorderLines(
      lines,
      contentLeft,
      contentTop,
      contentRight,
      contentBottom,
      settings.borderConfig.outerBorder,
      settings.borderConfig,
      allRightEdges,
      allLeftEdges
    )
  }

  // vertical-sub 行のY範囲を収集（小問番号列セグメント化用）
  const verticalRanges: { top: number; bottom: number }[] = []
  const branchVerticalRanges: { top: number; bottom: number; lineX: number }[] =
    []
  const horizontalMajorRanges: { top: number; bottom: number }[] = []
  {
    let trackY = margins.top + effectiveHeaderHeight
    for (let majorIndex = 0; majorIndex < majorQuestions.length; majorIndex++) {
      const majorQuestion = majorQuestions[majorIndex]
      if (majorIndex > 0) {
        trackY += spacing.majorQuestionSpacing
      }

      if (isGridHorizontal(majorQuestion.subQuestions)) {
        const height = computeMajorHeight(
          majorQuestion,
          baseRowHeight,
          contentRight - (majorNumX + majorNumWidth),
          subNumWidth
        )
        horizontalMajorRanges.push({ top: trackY, bottom: trackY + height })
        trackY += height
      } else {
        let subSegStart: number | null = null
        for (const sub of majorQuestion.subQuestions) {
          const subH = computeSubHeight(sub, baseRowHeight)
          if (sub.label !== "") {
            if (subSegStart === null) subSegStart = trackY
          } else {
            if (subSegStart !== null) {
              verticalRanges.push({ top: subSegStart, bottom: trackY })
              subSegStart = null
            }
          }
          if (sub.branchQuestions.length > 0) {
            if (!isGridHorizontal(sub.branchQuestions)) {
              const effSubNumW = sub.label === "" ? 0 : subNumWidth
              const effBranchLineX = subNumX + effSubNumW + branchNumWidth
              let branchSegStart: number | null = null
              let branchY = trackY
              for (const branchQuestion of sub.branchQuestions) {
                const bqH = branchQuestion.heightMultiplier * baseRowHeight
                if (branchQuestion.label !== "") {
                  if (branchSegStart === null) branchSegStart = branchY
                } else {
                  if (branchSegStart !== null) {
                    branchVerticalRanges.push({
                      top: branchSegStart,
                      bottom: branchY,
                      lineX: effBranchLineX,
                    })
                    branchSegStart = null
                  }
                }
                branchY += bqH
              }
              if (branchSegStart !== null) {
                branchVerticalRanges.push({
                  top: branchSegStart,
                  bottom: branchY,
                  lineX: effBranchLineX,
                })
              }
            }
          }
          trackY += subH
        }
        if (subSegStart !== null) {
          verticalRanges.push({ top: subSegStart, bottom: trackY })
        }
      }
    }
  }

  // 大問番号列の縦線 → 横配置大問の範囲とスペーシング部分を除外
  const majorNcSw = getLineWidth("majorNumberColumn", settings.borderConfig)
  const majorNumLineX = majorNumX + majorNumWidth
  {
    const majorColExcludeRanges = [...horizontalMajorRanges]
    if (spacing.majorQuestionSpacing > 0) {
      for (let i = 0; i < majorLayoutRanges.length - 1; i++) {
        majorColExcludeRanges.push({
          top: majorLayoutRanges[i].endY,
          bottom: majorLayoutRanges[i + 1].startY,
        })
      }
      majorColExcludeRanges.sort((rangeA, rangeB) => rangeA.top - rangeB.top)
    }
    let segStart = contentTop
    let isFirst = true
    for (const range of majorColExcludeRanges) {
      if (segStart < range.top - 0.01) {
        lines.push({
          x1: majorNumLineX,
          y1: segStart,
          x2: majorNumLineX,
          y2: range.top,
          style: settings.borderConfig.majorNumberDivider,
          lineType: "majorNumberColumn",
          strokeWidth: majorNcSw,
          ...(isFirst
            ? {
                dragInfo: {
                  axis: "vertical" as const,
                  target: {
                    type: "columnWidth" as const,
                    column: "majorNumber" as const,
                  },
                  currentValueMm: majorNumWidth,
                  minMm: 5,
                },
              }
            : {}),
        })
        isFirst = false
      }
      segStart = range.bottom
    }
    if (segStart < contentBottom - 0.01) {
      lines.push({
        x1: majorNumLineX,
        y1: segStart,
        x2: majorNumLineX,
        y2: contentBottom,
        style: settings.borderConfig.majorNumberDivider,
        lineType: "majorNumberColumn",
        strokeWidth: majorNcSw,
        ...(isFirst
          ? {
              dragInfo: {
                axis: "vertical" as const,
                target: {
                  type: "columnWidth" as const,
                  column: "majorNumber" as const,
                },
                currentValueMm: majorNumWidth,
                minMm: 5,
              },
            }
          : {}),
      })
    }
  }

  // 小問番号列の縦線 → 縦配置のセグメントのみ（大問外枠内にクリップ）
  const subNcSw = getLineWidth("subNumberColumn", settings.borderConfig)
  for (const range of verticalRanges) {
    const clipped = clipRangeToMajorLayouts(range, majorLayoutRanges)
    for (const clippedRange of clipped) {
      lines.push({
        x1: subNumX + subNumWidth,
        y1: clippedRange.top,
        x2: subNumX + subNumWidth,
        y2: clippedRange.bottom,
        style: settings.borderConfig.subNumberDivider,
        lineType: "subNumberColumn",
        strokeWidth: subNcSw,
        dragInfo: {
          axis: "vertical",
          target: { type: "columnWidth", column: "subNumber" },
          currentValueMm: subNumWidth,
          minMm: 5,
        },
      })
    }
  }

  // 枝問番号列の縦線 → vertical-branchセグメントのみ（大問外枠内にクリップ）
  if (hasBranch) {
    const branchNcSw = getLineWidth("branchNumberColumn", settings.borderConfig)
    for (const range of branchVerticalRanges) {
      const clipped = clipRangeToMajorLayouts(range, majorLayoutRanges)
      for (const clippedRange of clipped) {
        lines.push({
          x1: range.lineX,
          y1: clippedRange.top,
          x2: range.lineX,
          y2: clippedRange.bottom,
          style: settings.borderConfig.branchNumberDivider,
          lineType: "branchNumberColumn",
          strokeWidth: branchNcSw,
          dragInfo: {
            axis: "vertical",
            target: { type: "columnWidth", column: "branchNumber" },
            currentValueMm: branchNumWidth,
            minMm: 5,
          },
        })
      }
    }
  }

  // 段組み仕切り線
  const mcDividerLine = settings.multiColumn.dividerLine
  if (settings.multiColumn.enabled && mcDividerLine) {
    const multiColumn = settings.multiColumn
    const singleColumnWidth =
      (contentRight -
        contentLeft -
        (multiColumn.columnCount - 1) * multiColumn.columnGapMm) /
      multiColumn.columnCount
    for (
      let columnIndex = 1;
      columnIndex < multiColumn.columnCount;
      columnIndex++
    ) {
      const dividerX =
        contentLeft +
        columnIndex * singleColumnWidth +
        (columnIndex - 0.5) * multiColumn.columnGapMm
      lines.push({
        x1: dividerX,
        y1: contentTop,
        x2: dividerX,
        y2: contentBottom,
        style: mcDividerLine,
        lineType: "columnDivider",
        strokeWidth: multiColumn.dividerLineWidth,
      })
    }
  }

  // OMRマーカー
  const omrMarkerPositions = computeOMRMarkers(settings, paper)

  const layout: ComputedLayout = {
    pageWidthMm: paper.width,
    pageHeightMm: paper.height,
    cells,
    lines,
    numberLabels,
    omrMarkerPositions,
    headerFields,
    overflow: contentBottom > paper.height - margins.bottom,
    contentHeightMm: contentBottom - margins.top,
  }

  return vertical
    ? transformLayoutToVertical(layout, realPaper.width, realPaper.height)
    : layout
}
