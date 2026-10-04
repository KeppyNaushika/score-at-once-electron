import type { BoxPlotVisibility } from "./BoxPlotRow"

interface BoxPlotLegendProps extends Pick<
  BoxPlotVisibility,
  "showQ1" | "showMedian" | "showQ3" | "showAverageLine" | "showStudentMarker"
> {
  /** 凡例を置く左下の点 */
  x: number
  y: number
  fontScale: number
  boxPlotFontSize: number
}

/** 図の下に並べる凡例。描いている要素の分だけ左から詰めて並べる */
export function BoxPlotLegend({
  x,
  y,
  fontScale,
  boxPlotFontSize,
  showQ1,
  showMedian,
  showQ3,
  showAverageLine,
  showStudentMarker,
}: BoxPlotLegendProps) {
  let xOffset = 0
  const legendFontSize = (boxPlotFontSize - 2) * fontScale

  const getRangeLabel = (): string | null => {
    if (showQ1 && showMedian && showQ3) return "Q1-Q3範囲"
    if (showQ1 && showMedian && !showQ3) return "Q1-中央値範囲"
    if (!showQ1 && showMedian && showQ3) return "中央値-Q3範囲"
    if (showQ1 && !showMedian && showQ3) return "Q1-Q3範囲"
    return null
  }
  const rangeLabel = getRangeLabel()

  const elements: React.ReactNode[] = []

  if (showStudentMarker) {
    elements.push(
      <g key="student" transform={`translate(${xOffset}, 0)`}>
        <circle cx={0} cy={0} r={4} fill="#ef4444" />
        <text x={8} y={4} fontSize={legendFontSize} fill="#666">
          あなたの得点
        </text>
      </g>
    )
    xOffset += 80
  }

  if (rangeLabel) {
    elements.push(
      <g key="range" transform={`translate(${xOffset}, 0)`}>
        <rect
          x={0}
          y={-6}
          width={12}
          height={12}
          fill="#e0e7ff"
          stroke="#6366f1"
        />
        <text x={16} y={4} fontSize={legendFontSize} fill="#666">
          {rangeLabel}
        </text>
      </g>
    )
    xOffset += 80
  }

  if (showMedian) {
    elements.push(
      <g key="median" transform={`translate(${xOffset}, 0)`}>
        <line x1={0} y1={0} x2={10} y2={0} stroke="#4f46e5" strokeWidth={2} />
        <text x={14} y={4} fontSize={legendFontSize} fill="#666">
          中央値
        </text>
      </g>
    )
    xOffset += 60
  }

  if (showAverageLine) {
    elements.push(
      <g key="average" transform={`translate(${xOffset}, 0)`}>
        <line
          x1={0}
          y1={0}
          x2={15}
          y2={0}
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="3 2"
        />
        <text x={19} y={4} fontSize={legendFontSize} fill="#666">
          平均
        </text>
      </g>
    )
  }

  return <g transform={`translate(${x}, ${y})`}>{elements}</g>
}
