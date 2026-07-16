/**
 * SVGレンダリングユーティリティ
 *
 * 破線パターン計算、ドラッグ情報比較、インラインマークアップの
 * セグメントスタイル変換・描画ヘルパーを提供する。
 */

import { useEffect, useRef } from "react"

import type { InlineSegment } from "@/lib/answer-sheet-builder/inlineMarkupParser"
import type {
  BorderLineStyle,
  RenderMode,
} from "@/types/answerSheetDefinition.types"
import type { DragInfo } from "@/types/answerSheetLayout.types"

import { DEFAULT_DASH_RATIO, DEFAULT_GAP_RATIO } from "../../constants"

/**
 * BorderLineStyle に応じた SVG strokeDasharray / offset / linecap を返す。
 *
 * dashRatio / gapRatio は線幅に対する倍率。罫線種別ごとに任意の
 * ダッシュ長・間隔を指定できる（未指定時は既定 dash=3倍 / gap=2倍）。
 * 点線（dotted）のダッシュ長は固定（ほぼ点）で、gapRatio のみ反映する。
 */
export function getDashProps(
  style: BorderLineStyle,
  strokeWidth: number,
  lineLength: number,
  dashRatio: number = DEFAULT_DASH_RATIO,
  gapRatio: number = DEFAULT_GAP_RATIO
): {
  strokeDasharray?: string
  strokeDashoffset?: number
  strokeLinecap?: "round" | "butt"
} {
  let dash: number, gap: number
  switch (style) {
    case "dashed":
      dash = strokeWidth * dashRatio
      gap = strokeWidth * gapRatio
      break
    case "dotted":
      dash = 0.01
      gap = strokeWidth * gapRatio
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

/** MathJax tex2svg でレンダリングするspan（インライン/別行立て対応） */
function MathSpan({
  tex,
  style,
  displayMath,
}: {
  tex: string
  style: React.CSSProperties
  displayMath?: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || !window.MathJax?.tex2svg) return
    try {
      const container = window.MathJax.tex2svg(tex, {
        display: displayMath ?? false,
      })
      element.innerHTML = ""
      element.appendChild(container)
    } catch {
      // フォールバック: そのまま表示
    }
  }, [tex, displayMath])

  return (
    <span ref={ref} style={style}>
      {tex}
    </span>
  )
}

/** InlineSegment 配列を HTML <span> 要素配列に変換する（MathJax対応） */
export function renderSegmentsHtml(
  segments: InlineSegment[],
  renderMode: RenderMode,
  _fontSize: number
): React.ReactNode[] {
  return segments.map((seg, i) => {
    const style = getSegmentStyle(seg, renderMode)
    if (seg.math) {
      const mathStyle: React.CSSProperties = seg.displayMath
        ? { ...style, display: "block", textAlign: "center" }
        : { ...style, fontStyle: "italic" }
      return (
        <MathSpan
          key={i}
          tex={seg.text}
          style={mathStyle}
          displayMath={seg.displayMath}
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

/**
 * 印刷用: InlineSegment 配列を HTML <span> 要素配列に変換する。
 * レンダラープロセスで window.MathJax.tex2svg() を使い数式を事前にSVG化する。
 * オフスクリーンBrowserWindowでのMathJax読み込みは不要。
 */
export function renderSegmentsHtmlForPrint(
  segments: InlineSegment[],
  renderMode: RenderMode
): React.ReactNode[] {
  return segments.map((seg, i) => {
    const style = getSegmentStyle(seg, renderMode)
    if (seg.math) {
      const mathStyle: React.CSSProperties = seg.displayMath
        ? { ...style, display: "block", textAlign: "center" }
        : { ...style, fontStyle: "italic" }
      // レンダラープロセスのMathJaxでSVGにプリレンダリング
      if (typeof window !== "undefined" && window.MathJax?.tex2svg) {
        try {
          const container = window.MathJax.tex2svg(seg.text, {
            display: seg.displayMath ?? false,
          })
          const svgHtml = container.innerHTML
          return (
            <span
              key={i}
              style={mathStyle}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          )
        } catch {
          // フォールバック: テキストとして表示
        }
      }
      return (
        <span key={i} style={mathStyle}>
          {seg.text}
        </span>
      )
    }
    return (
      <span key={i} style={style}>
        {seg.text}
      </span>
    )
  })
}
