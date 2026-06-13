/**
 * 複数ページレイアウト計算
 *
 * AnswerSheetDefinition → ComputedMultiPageLayout への変換を行う。
 * 大問単位でのページ分割・段組みレイアウトに対応する。
 */

import type {
  AnswerSheetDefinition,
  MajorQuestion,
} from "@/types/answerSheetDefinition.types"
import type {
  ComputedCell,
  ComputedHeaderField,
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
import { transformPageToVertical } from "./verticalTransform"

/** 段組みの各段の座標範囲 */
interface ColBounds {
  contentLeft: number
  contentRight: number
  majorNumX: number
  subNumX: number
  branchNumX: number
}

/** AnswerSheetDefinition から複数ページの ComputedMultiPageLayout を計算する */
export function computeMultiPageLayoutFromDefinition(
  definition: AnswerSheetDefinition
): ComputedMultiPageLayout {
  // 縦書きでは論理（横組み）の左右段が、最終段の transpose により上下段になる
  const vertical = definition.settings.verticalLayout ?? false
  const { settings, majorQuestions } = definition
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

  const contentTop = margins.top + effectiveHeaderHeight
  const contentMaxY = paper.height - margins.bottom

  const majorNumWidth = columnWidths.majorNumber
  const subNumWidth = columnWidths.subNumber

  const hasBranch = majorQuestions.some((mq) =>
    mq.subQuestions.some((sq) => sq.branchQuestions.length > 0)
  )
  const branchNumWidth = hasBranch ? columnWidths.branchNumber : 0

  // ============================
  // 段組み: 各段の座標範囲を計算
  // ============================

  const mc = settings.multiColumn
  const isMultiCol = mc.enabled && mc.columnCount > 1
  const fullContentWidth = contentRight - contentLeft
  const singleColWidth = isMultiCol
    ? (fullContentWidth - (mc.columnCount - 1) * mc.columnGapMm) /
      mc.columnCount
    : fullContentWidth
  const columnCount = isMultiCol ? mc.columnCount : 1

  const colBoundsArr: ColBounds[] = []
  for (let ci = 0; ci < columnCount; ci++) {
    const colLeft = isMultiCol
      ? contentLeft + ci * (singleColWidth + mc.columnGapMm)
      : contentLeft
    const colRight = colLeft + singleColWidth
    colBoundsArr.push({
      contentLeft: colLeft,
      contentRight: colRight,
      majorNumX: colLeft,
      subNumX: colLeft + majorNumWidth,
      branchNumX: colLeft + majorNumWidth + subNumWidth,
    })
  }

  // ============================
  // ページデータ構造
  // ============================

  interface PerColData {
    verticalRanges: { top: number; bottom: number }[]
    branchVerticalRanges: { top: number; bottom: number; lineX: number }[]
    horizontalMajorRanges: { top: number; bottom: number }[]
    rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
    rowLeftEdges: { yTop: number; yBottom: number; leftX: number }[]
    majorLayoutRanges: Array<{
      startY: number
      endY: number
      rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
      rowLeftEdges: { yTop: number; yBottom: number; leftX: number }[]
    }>
    contentBottomY: number
  }

  interface PageData {
    cells: ComputedCell[]
    lines: ComputedLine[]
    numberLabels: ComputedNumberLabel[]
    columns: PerColData[]
  }

  function newPerColData(): PerColData {
    return {
      verticalRanges: [],
      branchVerticalRanges: [],
      horizontalMajorRanges: [],
      rowRightEdges: [],
      rowLeftEdges: [],
      majorLayoutRanges: [],
      contentBottomY: contentTop,
    }
  }

  function newPageData(): PageData {
    return {
      cells: [],
      lines: [],
      numberLabels: [],
      columns: Array.from({ length: columnCount }, () => newPerColData()),
    }
  }

  const pagesData: PageData[] = [newPageData()]
  let currentPageIdx = 0

  // ============================
  // 大問レイアウト関数（段組み対応）
  // ============================

  function layoutMajorOnPage(
    page: PageData,
    major: MajorQuestion,
    mi: number,
    startY: number,
    pageIdx: number,
    col: ColBounds,
    colIdx: number
  ): number {
    const colData = page.columns[colIdx]
    let localY = startY
    const majorStartY = localY
    const horizontalAreaX = col.majorNumX + majorNumWidth
    const horizontalAreaWidth = col.contentRight - horizontalAreaX
    const majorHeight = computeMajorHeight(
      major,
      baseRowHeight,
      horizontalAreaWidth,
      subNumWidth
    )

    // 大問番号ラベル
    page.numberLabels.push({
      text: major.label,
      x: col.majorNumX,
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
      const rightEdgesStart = colData.rowRightEdges.length
      const leftEdgesStart = colData.rowLeftEdges.length
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
            colData.rowRightEdges
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

      // rowRightEdges（枝問横配置を考慮）
      const rawRightEdges: { yTop: number; yBottom: number; rightX: number }[] =
        []
      for (const gc of gridCells) {
        const sub2 = gc.item
        const gcCellX = horizontalAreaX + gc.x * horizontalAreaWidth
        const gcCellW = gc.width * horizontalAreaWidth
        const gcCellY = majorStartY + gc.y * baseRowHeight
        const gcCellH = gc.height * baseRowHeight
        const gcCellRight = gcCellX + gcCellW
        const gcEffSubNumW = sub2.label === "" ? 0 : subNumWidth

        if (
          sub2.branchQuestions.length > 0 &&
          isGridHorizontal(sub2.branchQuestions)
        ) {
          const branchAreaX = gcCellX + gcEffSubNumW
          const branchAreaWidth = gcCellRight - branchAreaX
          const branchCells = buildBranchGridLayout(sub2.branchQuestions)
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
        colData.rowRightEdges.push(edge)
      }

      // rowLeftEdges
      for (const edge of computeGridRowLeftEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )) {
        colData.rowLeftEdges.push({
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

      // セルと空白スペースの境界線を補完（枝問横配置を反映したrightEdgesを使用）
      const majorRightEdges = colData.rowRightEdges.slice(rightEdgesStart)
      const majorLeftEdges = colData.rowLeftEdges.slice(leftEdgesStart)
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
          rightEdges: majorRightEdges,
          leftEdges: majorLeftEdges,
        }
      )

      // 横配置モード: 大問番号枠を独立した長方形として描画
      const outerSw = getLineWidth("outer", settings.borderConfig)
      page.lines.push(
        {
          x1: col.contentLeft,
          y1: majorStartY,
          x2: col.contentLeft,
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
          x1: col.contentLeft,
          y1: majorStartY,
          x2: horizontalAreaX,
          y2: majorStartY,
          style: settings.borderConfig.outerBorder,
          strokeWidth: outerSw,
          lineType: "outer",
        },
        {
          x1: col.contentLeft,
          y1: majorEndY,
          x2: horizontalAreaX,
          y2: majorEndY,
          style: settings.borderConfig.outerBorder,
          strokeWidth: outerSw,
          lineType: "outer",
        }
      )

      colData.horizontalMajorRanges.push({
        top: majorStartY,
        bottom: majorEndY,
      })

      localY = majorEndY
    } else {
      // === 縦配置モード ===
      const vertSegStart = localY

      const subRightEdges = major.subQuestions.map((sub) => {
        const hb = sub.branchQuestions.length > 0
        if (hb || !sub.manuscriptPaper?.enabled) return col.contentRight
        const sh = computeSubHeight(sub, baseRowHeight)
        const esnw = sub.label === "" ? 0 : subNumWidth
        const eax = col.subNumX + esnw
        return (
          eax + (sh / sub.manuscriptPaper.rows) * sub.manuscriptPaper.columns
        )
      })

      major.subQuestions.forEach((sub, si) => {
        const subStartY = localY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = computeSubHeight(sub, baseRowHeight)
        const effSubNumW = sub.label === "" ? 0 : subNumWidth
        const effBranchNumX = col.subNumX + effSubNumW
        const effBranchNumW = hasBranches ? branchNumWidth : 0
        const effAnswerX = effBranchNumX + effBranchNumW
        const effAnswerWidth = col.contentRight - effAnswerX

        if (effSubNumW > 0) {
          page.numberLabels.push({
            text: sub.label,
            x: col.subNumX,
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
            col.subNumX,
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
            colData.rowRightEdges
          )

          // 枝問番号列のセグメント（ラベルのある枝問のみ）
          if (!isGridHorizontal(sub.branchQuestions)) {
            const effBranchLineX = effBranchNumX + branchNumWidth
            let branchSegStart: number | null = null
            let branchY = subStartY
            for (const bq of sub.branchQuestions) {
              const bqH = bq.heightMultiplier * baseRowHeight
              if (bq.label !== "") {
                if (branchSegStart === null) branchSegStart = branchY
              } else {
                if (branchSegStart !== null) {
                  colData.branchVerticalRanges.push({
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
              colData.branchVerticalRanges.push({
                top: branchSegStart,
                bottom: branchY,
                lineX: effBranchLineX,
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
          const branchAreaX = col.subNumX + effSubNumW
          const branchAreaWidth = subRightEdges[si] - branchAreaX
          const branchCells = buildBranchGridLayout(sub.branchQuestions)
          for (const edge of computeGridRowRightEdges(
            branchCells,
            subStartY,
            branchAreaX,
            branchAreaWidth,
            baseRowHeight
          )) {
            colData.rowRightEdges.push(edge)
          }
        } else {
          colData.rowRightEdges.push({
            yTop: subStartY,
            yBottom: subStartY + subHeight,
            rightX: subRightEdges[si],
          })
        }
        colData.rowLeftEdges.push({
          yTop: subStartY,
          yBottom: subStartY + subHeight,
          leftX: col.contentLeft,
        })

        localY += subHeight

        // 行間の区切り線（最後の行以外）
        if (si < major.subQuestions.length - 1) {
          const dividerRightX = Math.max(
            subRightEdges[si],
            subRightEdges[si + 1]
          )
          page.lines.push({
            x1: col.subNumX,
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
              colData.verticalRanges.push({
                top: subSegStart,
                bottom: subTrackY,
              })
              subSegStart = null
            }
          }
          subTrackY += subH
        }
        if (subSegStart !== null) {
          colData.verticalRanges.push({ top: subSegStart, bottom: subTrackY })
        }
      }
    }

    return localY
  }

  // ============================
  // 大問を各段・ページに配置
  // ============================

  let currentColIdx = 0
  const colCurrentY: number[] = Array(columnCount).fill(contentTop)

  for (let mi = 0; mi < majorQuestions.length; mi++) {
    const major = majorQuestions[mi]
    let col = colBoundsArr[currentColIdx]
    let colHorizWidth = col.contentRight - col.majorNumX - majorNumWidth
    const majorHeight = computeMajorHeight(
      major,
      baseRowHeight,
      colHorizWidth,
      subNumWidth
    )
    const spacingHeight =
      colCurrentY[currentColIdx] > contentTop ? spacing.majorQuestionSpacing : 0

    // 現在の段に収まらない場合
    if (
      colCurrentY[currentColIdx] + spacingHeight + majorHeight > contentMaxY &&
      colCurrentY[currentColIdx] > contentTop
    ) {
      // 現在の段のcontentBottomYを確定
      pagesData[currentPageIdx].columns[currentColIdx].contentBottomY =
        colCurrentY[currentColIdx]

      // 次の段を試す
      currentColIdx++
      if (currentColIdx >= columnCount) {
        // 全段が満杯 → 新ページ
        // 残りの段のcontentBottomYも確定
        for (let ci = currentColIdx; ci < columnCount; ci++) {
          if (colCurrentY[ci] > contentTop) {
            pagesData[currentPageIdx].columns[ci].contentBottomY =
              colCurrentY[ci]
          }
        }
        currentPageIdx++
        pagesData.push(newPageData())
        currentColIdx = 0
        colCurrentY.fill(contentTop)
      }

      col = colBoundsArr[currentColIdx]
      colHorizWidth = col.contentRight - col.majorNumX - majorNumWidth
    }

    // スペーシング
    if (colCurrentY[currentColIdx] > contentTop) {
      colCurrentY[currentColIdx] += spacing.majorQuestionSpacing
    }

    const majorStartY = colCurrentY[currentColIdx]
    const page = pagesData[currentPageIdx]
    const colData = page.columns[currentColIdx]
    const rightEdgesBefore = colData.rowRightEdges.length
    const leftEdgesBefore = colData.rowLeftEdges.length

    colCurrentY[currentColIdx] = layoutMajorOnPage(
      page,
      major,
      mi,
      colCurrentY[currentColIdx],
      currentPageIdx,
      colBoundsArr[currentColIdx],
      currentColIdx
    )

    colData.majorLayoutRanges.push({
      startY: majorStartY,
      endY: colCurrentY[currentColIdx],
      rowRightEdges: colData.rowRightEdges.slice(rightEdgesBefore),
      rowLeftEdges: colData.rowLeftEdges.slice(leftEdgesBefore),
    })

    // 大問間の区切り線（majorQuestionSpacing === 0 のとき）
    if (spacing.majorQuestionSpacing === 0 && mi < majorQuestions.length - 1) {
      page.lines.push({
        x1: colBoundsArr[currentColIdx].contentLeft,
        y1: colCurrentY[currentColIdx],
        x2: colBoundsArr[currentColIdx].contentRight,
        y2: colCurrentY[currentColIdx],
        style: settings.borderConfig.majorDivider,
        lineType: "major",
        strokeWidth: getLineWidth("major", settings.borderConfig),
      })
    }
  }

  // 最終ページの全段のcontentBottomYを確定
  for (let ci = 0; ci < columnCount; ci++) {
    if (colCurrentY[ci] > contentTop) {
      pagesData[currentPageIdx].columns[ci].contentBottomY = colCurrentY[ci]
    }
  }

  // ============================
  // ページごとに罫線・番号列線・OMRマーカーを追加
  // ============================

  const pages: ComputedPageLayout[] = pagesData.map((pd, idx) => {
    // 全段のcontentBottomYの最大値
    const pageContentBottom = Math.max(
      contentTop,
      ...pd.columns.map((c) => c.contentBottomY)
    )

    // 各段の罫線処理
    for (let ci = 0; ci < columnCount; ci++) {
      const col = colBoundsArr[ci]
      const colData = pd.columns[ci]
      if (colData.contentBottomY <= contentTop) continue // この段に内容がない

      const colContentBottom = colData.contentBottomY

      // 段末尾の大問区切り線を削除
      for (let li = pd.lines.length - 1; li >= 0; li--) {
        const ln = pd.lines[li]
        if (
          ln.lineType === "major" &&
          Math.abs(ln.y1 - colContentBottom) < 0.01 &&
          Math.abs(ln.x1 - col.contentLeft) < 0.01
        ) {
          pd.lines.splice(li, 1)
          break
        }
      }

      // 外枠線（ステップ形状対応）
      if (
        spacing.majorQuestionSpacing > 0 &&
        colData.majorLayoutRanges.length > 1
      ) {
        for (const range of colData.majorLayoutRanges) {
          addSteppedBorderLines(
            pd.lines,
            col.contentLeft,
            range.startY,
            col.contentRight,
            range.endY,
            settings.borderConfig.outerBorder,
            settings.borderConfig,
            range.rowRightEdges,
            range.rowLeftEdges
          )
        }
      } else if (colData.majorLayoutRanges.length > 0) {
        addSteppedBorderLines(
          pd.lines,
          col.contentLeft,
          contentTop,
          col.contentRight,
          colContentBottom,
          settings.borderConfig.outerBorder,
          settings.borderConfig,
          colData.rowRightEdges,
          colData.rowLeftEdges
        )
      }

      // 大問番号列の縦線
      {
        const majorNcSwPage = getLineWidth(
          "majorNumberColumn",
          settings.borderConfig
        )
        const majorNumLineX = col.majorNumX + majorNumWidth
        const majorColExcludeRanges = [...colData.horizontalMajorRanges]
        if (spacing.majorQuestionSpacing > 0) {
          for (let i = 0; i < colData.majorLayoutRanges.length - 1; i++) {
            majorColExcludeRanges.push({
              top: colData.majorLayoutRanges[i].endY,
              bottom: colData.majorLayoutRanges[i + 1].startY,
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
        if (segStart < colContentBottom - 0.01) {
          pd.lines.push({
            x1: majorNumLineX,
            y1: segStart,
            x2: majorNumLineX,
            y2: colContentBottom,
            style: settings.borderConfig.majorNumberDivider,
            lineType: "majorNumberColumn",
            strokeWidth: majorNcSwPage,
          })
        }
      }

      // 小問番号列の縦線
      {
        const subNcSwPage = getLineWidth(
          "subNumberColumn",
          settings.borderConfig
        )
        for (const range of colData.verticalRanges) {
          const clipped = clipRangeToMajorLayouts(
            range,
            colData.majorLayoutRanges
          )
          for (const cr of clipped) {
            pd.lines.push({
              x1: col.subNumX + subNumWidth,
              y1: cr.top,
              x2: col.subNumX + subNumWidth,
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
        for (const range of colData.branchVerticalRanges) {
          const clipped = clipRangeToMajorLayouts(
            range,
            colData.majorLayoutRanges
          )
          for (const cr of clipped) {
            pd.lines.push({
              x1: range.lineX,
              y1: cr.top,
              x2: range.lineX,
              y2: cr.bottom,
              style: settings.borderConfig.branchNumberDivider,
              lineType: "branchNumberColumn",
              strokeWidth: branchNcSwPage,
            })
          }
        }
      }
    }

    // 段組み仕切り線
    const mcDividerLine = settings.multiColumn.dividerLine
    if (isMultiCol && mcDividerLine) {
      for (let ci = 1; ci < columnCount; ci++) {
        const dividerX =
          contentLeft + ci * singleColWidth + (ci - 0.5) * mc.columnGapMm
        pd.lines.push({
          x1: dividerX,
          y1: contentTop,
          x2: dividerX,
          y2: pageContentBottom,
          style: mcDividerLine,
          lineType: "columnDivider",
          strokeWidth: mc.dividerLineWidth,
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
      headerFields,
      contentHeightMm: pageContentBottom - margins.top,
    }
  })

  if (vertical) {
    return {
      pages: pages.map((p) =>
        transformPageToVertical(p, realPaper.width, realPaper.height)
      ),
      totalPages: pages.length,
      pageWidthMm: realPaper.width,
      pageHeightMm: realPaper.height,
    }
  }

  return {
    pages,
    totalPages: pages.length,
    pageWidthMm: paper.width,
    pageHeightMm: paper.height,
  }
}
