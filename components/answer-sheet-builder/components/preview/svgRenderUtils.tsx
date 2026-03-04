/**
 * SVGレンダリングユーティリティ
 *
 * 破線パターン計算、ドラッグ情報比較、インラインマークアップの
 * セグメントスタイル変換・描画ヘルパーを提供する。
 */

import type { InlineSegment } from "@/lib/answer-sheet-builder/inlineMarkupParser"
import type { LineStyle, RenderMode } from "@/types/answerSheetDefinition.types"
import type { DragInfo } from "@/types/answerSheetLayout.types"

/** LineStyle に応じた SVG strokeDasharray / offset / linecap を返す */
export function getDashProps(
  style: LineStyle,
  strokeWidth: number,
  lineLength: number
): {
  strokeDasharray?: string
  strokeDashoffset?: number
  strokeLinecap?: "round" | "butt"
} {
  let dash: number, gap: number
  switch (style) {
    case "dashed":
      dash = strokeWidth * 3
      gap = strokeWidth * 2
      break
    case "dotted":
      dash = 0.01
      gap = strokeWidth * 2
      break
    default:
      return {}
  }
  const period = dash + gap
  const offset = ((lineLength / 2) % period) - dash / 2
  return {
    strokeDasharray: `${dash} ${gap}`,
    strokeDashoffset: offset,
    strokeLinecap: "round",
  }
}

/** 2つの DragInfo が同一の対象を指しているか比較する */
export function isDragInfoEqual(
  a: DragInfo | undefined,
  b: DragInfo | null | undefined
): boolean {
  if (!a || !b) return false
  if (a.axis !== b.axis) return false
  if (a.target.type !== b.target.type) return false
  if (
    a.target.type === "heightMultiplier" &&
    b.target.type === "heightMultiplier"
  ) {
    return (
      a.target.majorIndex === b.target.majorIndex &&
      a.target.subIndex === b.target.subIndex &&
      a.target.branchIndex === b.target.branchIndex
    )
  }
  if (a.target.type === "columnWidth" && b.target.type === "columnWidth") {
    return a.target.column === b.target.column
  }
  return false
}

/** InlineSegment から React CSSProperties を生成する */
export function getSegmentStyle(
  seg: InlineSegment,
  renderMode?: RenderMode
): React.CSSProperties {
  const style: React.CSSProperties = {}
  if (seg.bold) style.fontWeight = "bold"
  if (seg.italic || seg.math) style.fontStyle = "italic"
  if (seg.strikethrough) style.textDecoration = "line-through"
  if (seg.underline) {
    style.textDecoration = style.textDecoration
      ? `${style.textDecoration} underline`
      : "underline"
  }
  if (seg.modelAnswer) {
    style.color = renderMode === "model-answer" ? "#d00" : "transparent"
  }
  return style
}

/** InlineSegment 配列を SVG <tspan> 要素配列に変換する */
export function renderSegmentsTspan(
  segments: InlineSegment[],
  renderMode: RenderMode
): React.ReactNode[] {
  return segments.map((seg, i) => (
    <tspan
      key={i}
      fontWeight={seg.bold ? "bold" : undefined}
      fontStyle={seg.italic || seg.math ? "italic" : undefined}
      textDecoration={
        seg.strikethrough && seg.underline
          ? "line-through underline"
          : seg.strikethrough
            ? "line-through"
            : seg.underline
              ? "underline"
              : undefined
      }
      fill={
        seg.modelAnswer
          ? renderMode === "model-answer"
            ? "#d00"
            : "transparent"
          : undefined
      }
    >
      {seg.text}
    </tspan>
  ))
}

/** InlineSegment 配列を HTML <span> 要素配列に変換する（MathJax対応） */
export function renderSegmentsHtml(
  segments: InlineSegment[],
  renderMode: RenderMode,
  fontSize: number
): React.ReactNode[] {
  return segments.map((seg, i) => {
    const style = getSegmentStyle(seg, renderMode)
    if (seg.math) {
      return (
        <span
          key={i}
          className="mathjax-inline"
          style={{ ...style, fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: `\\(${seg.text}\\)` }}
        />
      )
    }
    return (
      <span key={i} style={style}>
        {seg.text}
      </span>
    )
  })
}
