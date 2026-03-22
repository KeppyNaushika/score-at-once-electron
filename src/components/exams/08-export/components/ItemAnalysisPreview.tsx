"use client"

import type {
  DiscriminationLevel,
  ItemAnalysisData,
} from "../hooks/useItemAnalysis"

const LEVEL_CONFIG: Record<
  DiscriminationLevel,
  { label: string; bg: string; text: string }
> = {
  good: { label: "良好", bg: "bg-green-100", text: "text-green-800" },
  acceptable: { label: "許容", bg: "bg-blue-100", text: "text-blue-800" },
  marginal: { label: "要確認", bg: "bg-yellow-100", text: "text-yellow-800" },
  poor: { label: "低い", bg: "bg-red-100", text: "text-red-800" },
  negative: { label: "要検討", bg: "bg-red-200", text: "text-red-900" },
  insufficient: { label: "---", bg: "bg-gray-100", text: "text-gray-500" },
}

interface ItemAnalysisPreviewProps {
  data: ItemAnalysisData[]
}

export function ItemAnalysisPreview({ data }: ItemAnalysisPreviewProps) {
  const avgCorrectRate =
    data.length > 0
      ? data.reduce((sum, d) => sum + d.correctRate, 0) / data.length
      : 0
  const avgScoreRate =
    data.length > 0
      ? data.reduce((sum, d) => sum + d.scoreRate, 0) / data.length
      : 0
  const validIndices = data.filter((d) => d.discriminationIndex !== null)
  const avgDiscrim =
    validIndices.length > 0
      ? validIndices.reduce((sum, d) => sum + d.discriminationIndex!, 0) /
        validIndices.length
      : null

  return (
    <table className="w-full border-collapse text-[10px]">
      <thead className="bg-muted sticky top-0">
        <tr>
          <th className="border px-1 py-0.5 text-left">設問</th>
          <th className="border px-1 py-0.5 text-right">配点</th>
          <th className="border px-1 py-0.5 text-right">正答率(%)</th>
          <th className="border px-1 py-0.5 text-right">得点率(%)</th>
          <th className="border px-1 py-0.5 text-right">識別係数</th>
          <th className="border px-1 py-0.5 text-center">判定</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => {
          const config = LEVEL_CONFIG[row.level]
          return (
            <tr key={i} className="hover:bg-muted/50">
              <td className="border px-1 py-0.5">{row.questionLabel}</td>
              <td className="border px-1 py-0.5 text-right">{row.maxScore}</td>
              <td className="border px-1 py-0.5 text-right">
                {row.correctRate.toFixed(1)}
              </td>
              <td className="border px-1 py-0.5 text-right">
                {row.scoreRate.toFixed(1)}
              </td>
              <td className="border px-1 py-0.5 text-right">
                {row.discriminationIndex !== null
                  ? row.discriminationIndex.toFixed(3)
                  : "---"}
              </td>
              <td
                className={`border px-1 py-0.5 text-center ${config.bg} ${config.text}`}
              >
                {config.label}
              </td>
            </tr>
          )
        })}
        <tr className="bg-muted/70 font-medium">
          <td className="border px-1 py-0.5">平均</td>
          <td className="border px-1 py-0.5"></td>
          <td className="border px-1 py-0.5 text-right">
            {avgCorrectRate.toFixed(1)}
          </td>
          <td className="border px-1 py-0.5 text-right">
            {avgScoreRate.toFixed(1)}
          </td>
          <td className="border px-1 py-0.5 text-right">
            {avgDiscrim !== null ? avgDiscrim.toFixed(3) : "---"}
          </td>
          <td className="border px-1 py-0.5"></td>
        </tr>
      </tbody>
    </table>
  )
}
