"use client"

import type { ItemAnalysisResult } from "@/electron-src/lib/shared/calculations/itemAnalysis"
import type { DiscriminationLevel } from "@/electron-src/lib/shared/types/exportTypes"

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
  data: ItemAnalysisResult
}

/** 識別係数・D値セルを判定帯で着色するクラスを返す */
function levelCellClass(level: DiscriminationLevel): string {
  const config = LEVEL_CONFIG[level]
  return `border px-1 py-0.5 text-right ${config.bg} ${config.text}`
}

export function ItemAnalysisPreview({ data }: ItemAnalysisPreviewProps) {
  const { items, cronbachAlpha } = data

  const avg = (selector: (i: (typeof items)[number]) => number): number =>
    items.length > 0
      ? items.reduce((sum, item) => sum + selector(item), 0) / items.length
      : 0
  const avgValid = (
    selector: (i: (typeof items)[number]) => number | null
  ): number | null => {
    const vals = items.map(selector).filter((v): v is number => v !== null)
    return vals.length > 0
      ? vals.reduce((s, v) => s + v, 0) / vals.length
      : null
  }

  const avgCorrectRate = avg((item) => item.correctRate)
  const avgScoreRate = avg((item) => item.scoreRate)
  const avgDiscrim = avgValid((item) => item.discriminationIndex)
  const avgDValue = avgValid((item) => item.dValue)

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground px-1 text-[11px]">
        クロンバックα係数:{" "}
        <span className="text-foreground font-medium">
          {cronbachAlpha !== null ? cronbachAlpha.toFixed(3) : "判定不可"}
        </span>
        <span className="ml-2">
          （識別係数・D値の色: 良好≥0.4 / 許容≥0.3 / 要確認≥0.2 / 低い&lt;0.2 /
          要検討&lt;0）
        </span>
      </div>
      <table className="w-full border-collapse text-[10px]">
        <thead className="bg-muted sticky top-0">
          <tr>
            <th className="border px-1 py-0.5 text-left">設問</th>
            <th className="border px-1 py-0.5 text-right">配点</th>
            <th className="border px-1 py-0.5 text-right">正答率(%)</th>
            <th className="border px-1 py-0.5 text-right">得点率(%)</th>
            <th className="border px-1 py-0.5 text-right">識別係数</th>
            <th className="border px-1 py-0.5 text-right">D値</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={i} className="hover:bg-muted/50">
              <td className="border px-1 py-0.5">{row.label}</td>
              <td className="border px-1 py-0.5 text-right">{row.maxScore}</td>
              <td className="border px-1 py-0.5 text-right">
                {row.correctRate.toFixed(1)}
              </td>
              <td className="border px-1 py-0.5 text-right">
                {row.scoreRate.toFixed(1)}
              </td>
              <td className={levelCellClass(row.discriminationLevel)}>
                {row.discriminationIndex !== null
                  ? row.discriminationIndex.toFixed(3)
                  : "---"}
              </td>
              <td className={levelCellClass(row.dValueLevel)}>
                {row.dValue !== null ? row.dValue.toFixed(3) : "---"}
              </td>
            </tr>
          ))}
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
            <td className="border px-1 py-0.5 text-right">
              {avgDValue !== null ? avgDValue.toFixed(3) : "---"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
