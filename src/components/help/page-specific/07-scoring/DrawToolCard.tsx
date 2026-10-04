"use client"

import type { CSSProperties } from "react"

import { Kbd } from "@/components/ui/kbd"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"

type DrawToolKind =
  "line" | "rectangle" | "ellipse" | "text" | "select" | "hand"

/** ツール説明アニメの答案下地（薄いプレースホルダ行） */
function ToolBackdrop() {
  return (
    <>
      <rect
        x="4"
        y="6"
        width="112"
        height="52"
        rx="4"
        fill="white"
        stroke="#e5e7eb"
        strokeWidth="1.5"
      />
      <line
        x1="14"
        y1="22"
        x2="74"
        y2="22"
        stroke="#e5e7eb"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="14"
        y1="36"
        x2="90"
        y2="36"
        stroke="#e5e7eb"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="14"
        y1="50"
        x2="64"
        y2="50"
        stroke="#e5e7eb"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  )
}

/** ③のツール説明アニメ（CSS）。記号を描く／コメント／選択／手のひら。 */
function DrawToolAnimation({ tool }: { tool: DrawToolKind }) {
  const colors = useScoringStatusColors()
  const red = colors.incorrect.icon
  const blue = "#3b82f6"
  const lineLen = 74
  const rectLen = 2 * (44 + 24)
  const circleLen = 2 * Math.PI * 15

  return (
    <svg viewBox="0 0 120 64" className="h-16 w-full">
      {tool === "hand" ? (
        <g style={{ animation: "help07Pan 3.2s ease-in-out infinite" }}>
          <ToolBackdrop />
          <text x="82" y="44" fontSize="22">
            ✋
          </text>
        </g>
      ) : (
        <ToolBackdrop />
      )}

      {tool === "line" && (
        <line
          x1="14"
          y1="30"
          x2="88"
          y2="30"
          stroke={red}
          strokeWidth="3"
          strokeLinecap="round"
          style={
            {
              strokeDasharray: lineLen,
              "--help07-len": lineLen,
              animation: "help07Pen 3.6s infinite",
            } as CSSProperties
          }
        />
      )}
      {tool === "rectangle" && (
        <rect
          x="56"
          y="14"
          width="44"
          height="24"
          rx="2"
          fill="none"
          stroke={red}
          strokeWidth="3"
          style={
            {
              strokeDasharray: rectLen,
              "--help07-len": rectLen,
              animation: "help07Pen 3.6s infinite",
            } as CSSProperties
          }
        />
      )}
      {tool === "ellipse" && (
        <circle
          cx="80"
          cy="32"
          r="15"
          fill="none"
          stroke={red}
          strokeWidth="3"
          style={
            {
              strokeDasharray: circleLen,
              "--help07-len": circleLen,
              animation: "help07Pen 3.6s infinite",
            } as CSSProperties
          }
        />
      )}
      {tool === "text" && (
        <text
          x="56"
          y="38"
          fill={red}
          fontSize="16"
          fontWeight="bold"
          style={
            {
              fontFamily: "cursive",
              transformOrigin: "56px 38px",
              animation: "help07Mark 3.6s infinite",
            } as CSSProperties
          }
        >
          よし!
        </text>
      )}
      {tool === "select" && (
        <>
          <circle
            cx="46"
            cy="32"
            r="12"
            fill="none"
            stroke={red}
            strokeWidth="2.5"
          />
          <rect
            x="30"
            y="16"
            width="32"
            height="32"
            fill="none"
            stroke={blue}
            strokeWidth="1.5"
            strokeDasharray="4 3"
            style={{ animation: "help07March 0.6s linear infinite" }}
          />
        </>
      )}
    </svg>
  )
}

/** ③のツールカード：上にアニメ、下に名前・キー・説明 */
export function DrawToolCard({
  tool,
  name,
  desc,
  keyLabel,
}: {
  tool: DrawToolKind
  name: string
  desc: string
  keyLabel: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex h-16 w-full items-center justify-center">
        <DrawToolAnimation tool={tool} />
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-sm font-semibold text-gray-800">{name}</span>
          <Kbd variant="tinyOutlined">{keyLabel}</Kbd>
        </div>
        <div className="mt-0.5 text-xs leading-snug text-gray-500">{desc}</div>
      </div>
    </div>
  )
}
