"use client"

import type { ComputedHeaderField } from "@/types/answerSheetLayout.types"

import { getDashProps } from "./svgRenderUtils"

interface SvgHeaderFieldsProps {
  headerFields: ComputedHeaderField[] | undefined
  /** 縦書きレイアウトか（ラベルの描画方向に使う） */
  vertical: boolean
}

/** ヘッダー記入欄（氏名欄などの枠・ラベル・マス目）を描く */
export function SvgHeaderFields({
  headerFields,
  vertical,
}: SvgHeaderFieldsProps) {
  return (
    <>
      {headerFields?.map((field) => {
        // hfill はスペーサーなので描画しない
        if (field.type === "hfill") return null

        // label タイプ: ボックスなしのテキスト表示
        if (field.type === "label") {
          const fLabelSize = field.fontSize ?? 5
          // 縦書き: foreignObject + writing-mode（番号ラベルと同方式）
          if (vertical) {
            return (
              <foreignObject
                key={`hf-${field.fieldId}`}
                x={field.x}
                y={field.y}
                width={field.width}
                height={field.height}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    writingMode: "vertical-rl",
                    fontSize: `${fLabelSize}px`,
                    fontFamily: "'Noto Sans JP', sans-serif",
                    color: "#333",
                    lineHeight: 1,
                  }}
                >
                  {field.label}
                </div>
              </foreignObject>
            )
          }
          return (
            <text
              key={`hf-${field.fieldId}`}
              x={field.x + field.width / 2}
              y={field.y + field.height / 2}
              fontSize={fLabelSize}
              fontFamily="'Noto Sans JP', sans-serif"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#333"
            >
              {field.label}
            </text>
          )
        }

        // field タイプ: ボックス + ラベル + マス目
        const dashProps = getDashProps(field.lineStyle, field.lineWidth, 0)
        return (
          <g key={`hf-${field.fieldId}`}>
            {/* 外枠 */}
            <rect
              x={field.x}
              y={field.y}
              width={field.width}
              height={field.height}
              fill="none"
              stroke="black"
              strokeWidth={field.lineWidth}
              {...dashProps}
            />
            {/* ラベル */}
            <text
              x={field.x + field.width / 2}
              y={field.y - 1}
              fontSize={3}
              fontFamily="'Noto Sans JP', sans-serif"
              textAnchor="middle"
              dominantBaseline="auto"
              fill="#333"
            >
              {field.label}
            </text>
            {/* マス目線 */}
            {field.gridCount > 0 &&
              field.gridCellWidthMm &&
              Array.from({ length: field.gridCount - 1 }, (_, gi) => (
                <line
                  key={`hf-grid-${field.fieldId}-${gi}`}
                  x1={field.x + (gi + 1) * field.gridCellWidthMm!}
                  y1={field.y}
                  x2={field.x + (gi + 1) * field.gridCellWidthMm!}
                  y2={field.y + field.height}
                  stroke="#999"
                  strokeWidth={0.2}
                />
              ))}
          </g>
        )
      })}
    </>
  )
}
