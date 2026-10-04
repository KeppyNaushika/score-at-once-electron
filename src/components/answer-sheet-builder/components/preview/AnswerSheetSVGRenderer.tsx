"use client"

import type {
  BorderConfig,
  RenderMode,
} from "@/types/answerSheetDefinition.types"
import type {
  ComputedLayout,
  ComputedPageLayout,
  DragInfo,
} from "@/types/answerSheetLayout.types"

import { SvgCellImages } from "./SvgCellImages"
import { SvgCellTextElements } from "./SvgCellTextElements"
import { SvgHeaderFields } from "./SvgHeaderFields"
import { SvgLayoutLines } from "./SvgLayoutLines"
import { SvgManuscriptGrids } from "./SvgManuscriptGrids"
import { SvgOmrBubbles } from "./SvgOmrBubbles"

interface AnswerSheetSVGRendererProps {
  layout: ComputedLayout
  /** 単一ページデータ（指定時はlayoutのcells/lines等より優先） */
  pageLayout?: ComputedPageLayout
  renderMode: RenderMode
  interactive?: boolean
  hoveredDragInfo?: DragInfo | null
  /** 印刷用モード: MathJaxデリミタ出力、appimg→file変換等 */
  forPrint?: boolean
  /** 印刷用: 画像パス → data URI のマップ */
  imageDataUris?: Map<string, string>
  /** 罫線種別ごとの破線ダッシュ長/間隔の解決に使う。未指定時は既定倍率 */
  borderConfig?: BorderConfig
}

/**
 * 解答用紙のSVG描画コンポーネント。
 * セル・罫線・番号ラベル・OMRマーカー・原稿用紙グリッドを描画する。
 *
 * 描く順（＝重なりの順）はここで決める。各層の描き方は `Svg*.tsx` が持つ。
 */
export function AnswerSheetSVGRenderer({
  layout,
  pageLayout,
  renderMode,
  interactive,
  hoveredDragInfo,
  forPrint,
  imageDataUris,
  borderConfig,
}: AnswerSheetSVGRendererProps) {
  const { pageWidthMm, pageHeightMm } = layout
  // pageLayoutが指定されている場合はそちらのデータを使用
  const cells = pageLayout?.cells ?? layout.cells
  const lines = pageLayout?.lines ?? layout.lines
  const numberLabels = pageLayout?.numberLabels ?? layout.numberLabels
  const omrMarkerPositions =
    pageLayout?.omrMarkerPositions ?? layout.omrMarkerPositions
  const headerFields = pageLayout?.headerFields ?? layout.headerFields
  // 縦書きレイアウトか（テキストの描画方向に使う）
  const vertical = (pageLayout ?? layout).vertical ?? false

  return (
    <>
      {/* 用紙背景 */}
      <rect width={pageWidthMm} height={pageHeightMm} fill="white" />

      {/* OMRマーカー */}
      {omrMarkerPositions.map((marker, i) => (
        <rect
          key={`omr-${i}`}
          x={marker.x}
          y={marker.y}
          width={marker.size}
          height={marker.size}
          fill="black"
        />
      ))}

      {/* ヘッダー記入欄 */}
      <SvgHeaderFields headerFields={headerFields} vertical={vertical} />

      {/* 罫線 */}
      <SvgLayoutLines
        lines={lines}
        interactive={interactive}
        hoveredDragInfo={hoveredDragInfo}
        borderConfig={borderConfig}
      />

      {/* 番号ラベル（横書き） */}
      {numberLabels.map((label, i) => (
        <text
          key={`label-${i}`}
          x={label.x + label.width / 2}
          y={label.y + label.height / 2}
          fontSize={label.fontSize}
          fontFamily="'Noto Sans JP', sans-serif"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#000"
        >
          {label.text}
        </text>
      ))}

      {/* セル内テキスト要素（インラインマークアップ対応） */}
      <SvgCellTextElements
        cells={cells}
        vertical={vertical}
        renderMode={renderMode}
        forPrint={forPrint}
      />

      {/* 画像要素 */}
      <SvgCellImages
        cells={cells}
        renderMode={renderMode}
        forPrint={forPrint}
        imageDataUris={imageDataUris}
      />

      {/* OMRバブル（共通テスト準拠：楕円＋内部ラベル） */}
      <SvgOmrBubbles
        cells={cells}
        renderMode={renderMode}
        pageWidthMm={pageWidthMm}
        pageHeightMm={pageHeightMm}
      />

      {/* 原稿用紙グリッド */}
      <SvgManuscriptGrids cells={cells} borderConfig={borderConfig} />

      {/* 溢れ警告（単一ページモード時のみ表示） */}
      {!pageLayout && layout.overflow && (
        <g>
          <rect
            x={pageWidthMm / 2 - 40}
            y={pageHeightMm - 12}
            width={80}
            height={8}
            rx={2}
            fill="rgba(239,68,68,0.9)"
          />
          <text
            x={pageWidthMm / 2}
            y={pageHeightMm - 8}
            fontSize={4}
            fontFamily="sans-serif"
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
          >
            用紙サイズを超過しています
          </text>
        </g>
      )}
    </>
  )
}
