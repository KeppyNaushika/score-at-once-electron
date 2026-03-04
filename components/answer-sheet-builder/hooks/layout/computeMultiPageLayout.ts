/**
 * 複数ページレイアウト計算
 *
 * AnswerSheetDefinition → ComputedMultiPageLayout への変換を行う。
 * 大問単位でのページ分割に対応する。
 */

import type {
  AnswerSheetDefinition,
  MajorQuestion,
} from "@/types/answerSheetDefinition.types"
import type {
  ComputedCell,
  ComputedLine,
  ComputedMultiPageLayout,
  ComputedNumberLabel,
  ComputedPageLayout,
} from "@/types/answerSheetLayout.types"

import {
  computeMajorHeight,
  computeManuscriptGrid,
  computeSubHeight,
  createCell,
} from "./cellBuilder"
import {
  buildSubGridLayout,
  computeGridRowLeftEdges,
  computeGridRowRightEdges,
  gridTotalHeight,
  isGridHorizontal,
} from "./gridBuilder"
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

/** AnswerSheetDefinition から複数ページの ComputedMultiPageLayout を計算する */
export function computeMultiPageLayoutFromDefinition(
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

  interface PageData {
    cells: ComputedCell[]
    lines: ComputedLine[]
    numberLabels: ComputedNumberLabel[]
    verticalRanges: { top: number; bottom: number }[]
    branchVerticalRanges: { top: number; bottom: number }[]
    /** 横配置大問のY範囲（大問番号列縦線セグメント化用） */
    horizontalMajorRanges: { top: number; bottom: number }[]
    rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
    rowLeftEdges: { yTop: number; yBottom: number; leftX: number }[]
    /** 大問ごとのレイアウト範囲（大問間スペーシング時の個別外枠描画用） */
    majorLayoutRanges: Array<{
      startY: number
      endY: number
      rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
      rowLeftEdges: { yTop: number; yBottom: number; leftX: number }[]
    }>
    contentBottomY: number
  }

  function newPageData(): PageData {
    return {
      cells: [],
      lines: [],
      numberLabels: [],
      verticalRanges: [],
      branchVerticalRanges: [],
      horizontalMajorRanges: [],
      rowRightEdges: [],
      rowLeftEdges: [],
      majorLayoutRanges: [],
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
    const horizontalAreaX = majorNumX + majorNumWidth
    const horizontalAreaWidth = contentRight - horizontalAreaX
    const majorHeight = computeMajorHeight(
      major,
      baseRowHeight,
      horizontalAreaWidth,
      subNumWidth
    )

    // 大問番号ラベル
    page.numberLabels.push({
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
      for (const gc of gridCells) {
        const cellX = horizontalAreaX + gc.x * horizontalAreaWidth
        const cellWidth = gc.width * horizontalAreaWidth
        const cellY = majorStartY + gc.y * baseRowHeight
        const cellHeight = gc.height * baseRowHeight
        const sub = gc.item
        const hasBranches = sub.branchQuestions.length > 0
        const effSubNumW = sub.label === "" ? 0 : subNumWidth

        if (effSubNumW > 0) {
          page.numberLabels.push({
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
          const cellBranchNumX = cellX + effSubNumW
          const cellBranchNumWidth = branchNumWidth
          const cellAnswerX = cellBranchNumX + cellBranchNumWidth
          const cellAnswerWidth = cellWidth - effSubNumW - cellBranchNumWidth
          const cellRight = cellX + cellWidth
          renderBranchQuestions(
            sub,
            mi,
            gc.itemIndex,
            major.label,
            cellY,
            pageIdx,
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
            page.cells,
            page.lines,
            page.numberLabels,
            page.rowRightEdges
          )
        } else {
          let ansX = cellX + effSubNumW
          let ansW = cellWidth - effSubNumW
          if (sub.manuscriptPaper?.enabled) {
            const cellSz = cellHeight / sub.manuscriptPaper.rows
            const gridW = cellSz * sub.manuscriptPaper.columns
            ansW = gridW
          }
          page.cells.push(
            createCell(
              [mi, gc.itemIndex],
              ansX,
              cellY,
              ansW,
              cellHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              "answer",
              pageIdx,
              computeManuscriptGrid(sub, ansX, cellY, ansW, cellHeight),
              sub.omrConfig,
              sub.imageElements
            )
          )
        }

        // 番号ラベル右側の区切り線
        if (effSubNumW > 0) {
          page.lines.push({
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

      // rowRightEdges
      for (const edge of computeGridRowRightEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )) {
        page.rowRightEdges.push(edge)
      }

      // rowLeftEdges
      for (const edge of computeGridRowLeftEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )) {
        page.rowLeftEdges.push({
          yTop: edge.yTop,
          yBottom: edge.yBottom,
          leftX: edge.leftX,
        })
      }

      // グリッドセル間の区切り線
      renderGridDividerLines(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight,
        settings,
        page.lines,
        "sub"
      )

      const majorEndY = majorStartY + gridTotalHeight(gridCells) * baseRowHeight

      // セルと空白スペースの境界線を補完
      const subRightEdges = computeGridRowRightEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )
      const subLeftEdges = computeGridRowLeftEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )
      renderGridCompletionLines(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight,
        settings,
        page.lines,
        "sub",
        {
          top: majorStartY,
          bottom: majorEndY,
          rightEdges: subRightEdges,
          leftEdges: subLeftEdges,
        }
      )

      // 横配置モード: 大問番号枠を独立した長方形として描画
      const outerSw = getLineWidth("outer", settings.borderConfig)
      page.lines.push(
        {
          x1: contentLeft,
          y1: majorStartY,
          x2: contentLeft,
          y2: majorEndY,
          style: settings.borderConfig.outerBorder,
          strokeWidth: outerSw,
          lineType: "outer",
        },
        {
          x1: horizontalAreaX,
          y1: majorStartY,
          x2: horizontalAreaX,
          y2: majorEndY,
          style: settings.borderConfig.outerBorder,
          strokeWidth: outerSw,
          lineType: "outer",
        },
        {
          x1: contentLeft,
          y1: majorStartY,
          x2: horizontalAreaX,
          y2: majorStartY,
          style: settings.borderConfig.outerBorder,
          strokeWidth: outerSw,
          lineType: "outer",
        },
        {
          x1: contentLeft,
          y1: majorEndY,
          x2: horizontalAreaX,
          y2: majorEndY,
          style: settings.borderConfig.outerBorder,
          strokeWidth: outerSw,
          lineType: "outer",
        }
      )

      page.horizontalMajorRanges.push({ top: majorStartY, bottom: majorEndY })

      localY = majorEndY
    } else {
      // === 縦配置モード ===
      const vertSegStart = localY

      const subRightEdges = major.subQuestions.map((sub) => {
        const hb = sub.branchQuestions.length > 0
        if (hb || !sub.manuscriptPaper?.enabled) return contentRight
        const sh = computeSubHeight(sub, baseRowHeight)
        const esnw = sub.label === "" ? 0 : subNumWidth
        const eax = subNumX + esnw + branchNumWidth
        return (
          eax + (sh / sub.manuscriptPaper.rows) * sub.manuscriptPaper.columns
        )
      })

      major.subQuestions.forEach((sub, si) => {
        const subStartY = localY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = computeSubHeight(sub, baseRowHeight)
        const effSubNumW = sub.label === "" ? 0 : subNumWidth
        const effBranchNumX = subNumX + effSubNumW
        const effAnswerX = effBranchNumX + branchNumWidth
        const effAnswerWidth = contentRight - effAnswerX

        if (effSubNumW > 0) {
          page.numberLabels.push({
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
            mi,
            si,
            major.label,
            subStartY,
            pageIdx,
            subNumX,
            effSubNumW,
            effBranchNumX,
            branchNumWidth,
            effAnswerX,
            effAnswerWidth,
            subRightEdges[si],
            baseRowHeight,
            paper,
            settings,
            page.cells,
            page.lines,
            page.numberLabels,
            page.rowRightEdges
          )

          // 枝問番号列のセグメント（ラベルのある枝問のみ）
          if (!isGridHorizontal(sub.branchQuestions)) {
            let branchSegStart: number | null = null
            let branchY = subStartY
            for (const bq of sub.branchQuestions) {
              const bqH = bq.heightMultiplier * baseRowHeight
              if (bq.label !== "") {
                if (branchSegStart === null) branchSegStart = branchY
              } else {
                if (branchSegStart !== null) {
                  page.branchVerticalRanges.push({
                    top: branchSegStart,
                    bottom: branchY,
                  })
                  branchSegStart = null
                }
              }
              branchY += bqH
            }
            if (branchSegStart !== null) {
              page.branchVerticalRanges.push({
                top: branchSegStart,
                bottom: branchY,
              })
            }
          }
        } else {
          let ansW = effAnswerWidth
          if (sub.manuscriptPaper?.enabled) {
            const cellSz = subHeight / sub.manuscriptPaper.rows
            const gridW = cellSz * sub.manuscriptPaper.columns
            ansW = gridW
          }
          page.cells.push(
            createCell(
              [mi, si],
              effAnswerX,
              subStartY,
              ansW,
              subHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              "answer",
              pageIdx,
              computeManuscriptGrid(
                sub,
                effAnswerX,
                subStartY,
                ansW,
                subHeight
              ),
              sub.omrConfig,
              sub.imageElements
            )
          )
        }

        // vertical-sub行の右端
        page.rowRightEdges.push({
          yTop: subStartY,
          yBottom: subStartY + subHeight,
          rightX: subRightEdges[si],
        })
        page.rowLeftEdges.push({
          yTop: subStartY,
          yBottom: subStartY + subHeight,
          leftX: contentLeft,
        })

        localY += subHeight

        // 行間の区切り線（最後の行以外）
        if (si < major.subQuestions.length - 1) {
          const dividerRightX = Math.max(
            subRightEdges[si],
            subRightEdges[si + 1]
          )
          page.lines.push({
            x1: subNumX,
            y1: localY,
            x2: dividerRightX,
            y2: localY,
            style: settings.borderConfig.subDivider,
            lineType: "sub",
            strokeWidth: getLineWidth("sub", settings.borderConfig),
          })
        }
      })

      // 小問番号列セグメント: ラベルのある小問の区間だけ
      {
        let subSegStart: number | null = null
        let subTrackY = vertSegStart
        for (const sub of major.subQuestions) {
          const subH = computeSubHeight(sub, baseRowHeight)
          if (sub.label !== "") {
            if (subSegStart === null) subSegStart = subTrackY
          } else {
            if (subSegStart !== null) {
              page.verticalRanges.push({ top: subSegStart, bottom: subTrackY })
              subSegStart = null
            }
          }
          subTrackY += subH
        }
        if (subSegStart !== null) {
          page.verticalRanges.push({ top: subSegStart, bottom: subTrackY })
        }
      }
    }

    return localY
  }

  // 大問を順番に配置
  for (let mi = 0; mi < majorQuestions.length; mi++) {
    const major = majorQuestions[mi]
    const pgHorizontalAreaWidth = contentRight - majorNumX - majorNumWidth
    const majorHeight = computeMajorHeight(
      major,
      baseRowHeight,
      pgHorizontalAreaWidth,
      subNumWidth
    )
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

    const majorStartY = currentY
    const page = pagesData[currentPageIdx]
    const rightEdgesBefore = page.rowRightEdges.length
    const leftEdgesBefore = page.rowLeftEdges.length

    currentY = layoutMajorOnPage(page, major, mi, currentY, currentPageIdx)

    page.majorLayoutRanges.push({
      startY: majorStartY,
      endY: currentY,
      rowRightEdges: page.rowRightEdges.slice(rightEdgesBefore),
      rowLeftEdges: page.rowLeftEdges.slice(leftEdgesBefore),
    })

    if (spacing.majorQuestionSpacing === 0 && mi < majorQuestions.length - 1) {
      page.lines.push({
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

    // 外枠線（ステップ形状対応）
    if (spacing.majorQuestionSpacing > 0 && pd.majorLayoutRanges.length > 1) {
      for (const range of pd.majorLayoutRanges) {
        addSteppedBorderLines(
          pd.lines,
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
      addSteppedBorderLines(
        pd.lines,
        contentLeft,
        contentTop,
        contentRight,
        pageContentBottom,
        settings.borderConfig.outerBorder,
        settings.borderConfig,
        pd.rowRightEdges,
        pd.rowLeftEdges
      )
    }

    // 大問番号列の縦線
    {
      const majorNcSwPage = getLineWidth(
        "majorNumberColumn",
        settings.borderConfig
      )
      const majorNumLineX = majorNumX + majorNumWidth
      const majorColExcludeRanges = [...pd.horizontalMajorRanges]
      if (spacing.majorQuestionSpacing > 0) {
        for (let i = 0; i < pd.majorLayoutRanges.length - 1; i++) {
          majorColExcludeRanges.push({
            top: pd.majorLayoutRanges[i].endY,
            bottom: pd.majorLayoutRanges[i + 1].startY,
          })
        }
        majorColExcludeRanges.sort((a, b) => a.top - b.top)
      }
      let segStart = contentTop
      for (const range of majorColExcludeRanges) {
        if (segStart < range.top - 0.01) {
          pd.lines.push({
            x1: majorNumLineX,
            y1: segStart,
            x2: majorNumLineX,
            y2: range.top,
            style: settings.borderConfig.majorNumberDivider,
            lineType: "majorNumberColumn",
            strokeWidth: majorNcSwPage,
          })
        }
        segStart = range.bottom
      }
      if (segStart < pageContentBottom - 0.01) {
        pd.lines.push({
          x1: majorNumLineX,
          y1: segStart,
          x2: majorNumLineX,
          y2: pageContentBottom,
          style: settings.borderConfig.majorNumberDivider,
          lineType: "majorNumberColumn",
          strokeWidth: majorNcSwPage,
        })
      }
    }

    // 小問番号列の縦線
    {
      const subNcSwPage = getLineWidth("subNumberColumn", settings.borderConfig)
      for (const range of pd.verticalRanges) {
        const clipped = clipRangeToMajorLayouts(range, pd.majorLayoutRanges)
        for (const cr of clipped) {
          pd.lines.push({
            x1: subNumX + subNumWidth,
            y1: cr.top,
            x2: subNumX + subNumWidth,
            y2: cr.bottom,
            style: settings.borderConfig.subNumberDivider,
            lineType: "subNumberColumn",
            strokeWidth: subNcSwPage,
          })
        }
      }
    }

    // 枝問番号列の縦線
    if (hasBranch) {
      const branchNcSwPage = getLineWidth(
        "branchNumberColumn",
        settings.borderConfig
      )
      for (const range of pd.branchVerticalRanges) {
        const clipped = clipRangeToMajorLayouts(range, pd.majorLayoutRanges)
        for (const cr of clipped) {
          pd.lines.push({
            x1: branchNumX + branchNumWidth,
            y1: cr.top,
            x2: branchNumX + branchNumWidth,
            y2: cr.bottom,
            style: settings.borderConfig.branchNumberDivider,
            lineType: "branchNumberColumn",
            strokeWidth: branchNcSwPage,
          })
        }
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
