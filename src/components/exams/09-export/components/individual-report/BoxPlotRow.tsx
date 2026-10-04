import type { ComputedSubtotalStat } from "./computeReportData"

/** 箱ひげ図のどの要素を描くか（設定の「最小」「Q1」… と1対1） */
export interface BoxPlotVisibility {
  showMin: boolean
  showQ1: boolean
  showMedian: boolean
  showQ3: boolean
  showMax: boolean
  showAverageLine: boolean
  showStudentMarker: boolean
}

interface BoxPlotRowProps extends BoxPlotVisibility {
  stat: ComputedSubtotalStat
  /** この行の上端 */
  y: number
  boxHeight: number
  marginLeft: number
  plotWidth: number
  chartWidth: number
  studentScore: number
  fontScale: number
  boxPlotFontSize: number
}

/** 小計1つぶんの箱ひげ図（ラベル・ひげ・箱・平均・本人の得点） */
export function BoxPlotRow({
  stat,
  y,
  boxHeight,
  marginLeft,
  plotWidth,
  chartWidth,
  studentScore,
  fontScale,
  boxPlotFontSize,
  showMin,
  showQ1,
  showMedian,
  showQ3,
  showMax,
  showAverageLine,
  showStudentMarker,
}: BoxPlotRowProps) {
  const boxPlot = stat.boxPlot
  const maxScore = stat.maxScore || boxPlot.max || 100

  const toPercent = (score: number) => (score / maxScore) * 100
  const toX = (percent: number) => marginLeft + (percent / 100) * plotWidth

  const minX = toX(toPercent(boxPlot.min))
  const q1X = toX(toPercent(boxPlot.q1))
  const medianX = toX(toPercent(boxPlot.median))
  const q3X = toX(toPercent(boxPlot.q3))
  const maxX = toX(toPercent(boxPlot.max))

  const studentX = toX(toPercent(studentScore))

  return (
    <g>
      {/* ラベル */}
      <text
        x={marginLeft - 8}
        y={y + boxHeight / 2 + 4}
        fontSize={boxPlotFontSize * fontScale}
        fill="#333"
        textAnchor="end"
      >
        {stat.subtotalLabel.length > 12
          ? stat.subtotalLabel.substring(0, 12) + "..."
          : stat.subtotalLabel}
      </text>

      {/* 最小から最も近い表示要素への水平線 */}
      {showMin &&
        (() => {
          const targetX = showQ1
            ? q1X
            : showMedian
              ? medianX
              : showQ3
                ? q3X
                : showMax
                  ? maxX
                  : null
          if (targetX === null) return null
          return (
            <line
              x1={minX}
              y1={y + boxHeight / 2}
              x2={targetX}
              y2={y + boxHeight / 2}
              stroke="#666"
              strokeWidth={1}
            />
          )
        })()}

      {/* 最小のひげ */}
      {showMin && (
        <line
          x1={minX}
          y1={y + 4}
          x2={minX}
          y2={y + boxHeight - 4}
          stroke="#666"
          strokeWidth={1}
        />
      )}

      {/* Q1-Median間の塗りつぶし */}
      {showQ1 && showMedian && (
        <rect
          x={q1X}
          y={y}
          width={Math.max(medianX - q1X, 1)}
          height={boxHeight}
          fill="#e0e7ff"
          stroke="none"
        />
      )}

      {/* Median-Q3間の塗りつぶし */}
      {showMedian && showQ3 && (
        <rect
          x={medianX}
          y={y}
          width={Math.max(q3X - medianX, 1)}
          height={boxHeight}
          fill="#e0e7ff"
          stroke="none"
        />
      )}

      {/* Q1-Q3間の塗りつぶし（Medianなしの場合） */}
      {showQ1 && showQ3 && !showMedian && (
        <rect
          x={q1X}
          y={y}
          width={Math.max(q3X - q1X, 1)}
          height={boxHeight}
          fill="#e0e7ff"
          stroke="none"
        />
      )}

      {/* Q1の線 */}
      {showQ1 && (
        <line
          x1={q1X}
          y1={y}
          x2={q1X}
          y2={y + boxHeight}
          stroke="#6366f1"
          strokeWidth={1.5}
        />
      )}

      {/* 中央値の線 */}
      {showMedian && (
        <line
          x1={medianX}
          y1={y}
          x2={medianX}
          y2={y + boxHeight}
          stroke="#4f46e5"
          strokeWidth={2}
        />
      )}

      {/* Q3の線 */}
      {showQ3 && (
        <line
          x1={q3X}
          y1={y}
          x2={q3X}
          y2={y + boxHeight}
          stroke="#6366f1"
          strokeWidth={1.5}
        />
      )}

      {/* 平均値 */}
      {showAverageLine && (
        <line
          x1={toX(toPercent(stat.average))}
          y1={y - 2}
          x2={toX(toPercent(stat.average))}
          y2={y + boxHeight + 2}
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="3 2"
        />
      )}

      {/* 最も近い表示要素から最大への水平線 */}
      {showMax &&
        (() => {
          const targetX = showQ3
            ? q3X
            : showMedian
              ? medianX
              : showQ1
                ? q1X
                : showMin
                  ? minX
                  : null
          if (targetX === null) return null
          return (
            <line
              x1={targetX}
              y1={y + boxHeight / 2}
              x2={maxX}
              y2={y + boxHeight / 2}
              stroke="#666"
              strokeWidth={1}
            />
          )
        })()}

      {/* 最大のひげ */}
      {showMax && (
        <line
          x1={maxX}
          y1={y + 4}
          x2={maxX}
          y2={y + boxHeight - 4}
          stroke="#666"
          strokeWidth={1}
        />
      )}

      {/* 生徒の得点マーカー */}
      {showStudentMarker && (
        <>
          <circle
            cx={studentX}
            cy={y + boxHeight / 2}
            r={Math.max(4, boxHeight / 4)}
            fill="#ef4444"
            stroke="#fff"
            strokeWidth={2}
          />
          <text
            x={chartWidth - 10}
            y={y + boxHeight / 2 + 4}
            fontSize={(boxPlotFontSize - 1) * fontScale}
            fill="#333"
            textAnchor="end"
          >
            {studentScore}点
          </text>
        </>
      )}
    </g>
  )
}
