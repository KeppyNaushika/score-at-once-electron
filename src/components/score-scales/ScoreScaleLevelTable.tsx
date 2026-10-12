"use client"

import { ArrowDown, ArrowUp, Plus, Trash } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ScoreScaleLevelRow, ScoreScaleRow } from "@/queries/scoreScale"

import { scaleLevelUsageCount } from "./utils/scoreScaleUsage"

interface ScoreScaleLevelTableProps {
  scoreScale: ScoreScaleRow
  /** 設問の配点（03 から開いたとき）。分かれば、配点を超える類型に注記を添える */
  points: number | null
  textOf: (rowId: string, field: string, stored: string) => string
  onLevelTextChange: (
    level: ScoreScaleLevelRow,
    field: "label" | "description",
    text: string
  ) => void
  onScoreChange: (levelIndex: number, text: string) => void
  /** 入力を離れたら、その欄の手元の文字を捨てる */
  onFieldBlur: (rowId: string, field: string) => void
  onAddLevel: () => void
  onDeleteLevel: (levelIndex: number) => void
  onMoveLevel: (fromIndex: number, toIndex: number) => void
  disabled?: boolean
}

/**
 * 類型の表（記号・説明・点数）。1打鍵ごとに書く。
 * 使われている類型（付けた採点・確定・項目がある）は消せないので、ボタンを止めて件数を示す
 */
export function ScoreScaleLevelTable({
  scoreScale,
  points,
  textOf,
  onLevelTextChange,
  onScoreChange,
  onFieldBlur,
  onAddLevel,
  onDeleteLevel,
  onMoveLevel,
  disabled = false,
}: ScoreScaleLevelTableProps) {
  const levels = scoreScale.levels

  return (
    <div className="space-y-2">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            {/* 見出しの字を入力欄の字の頭（枠の内側の余白ぶん右）に揃える */}
            <th className="w-20 py-1 pr-1 pl-4 text-left font-normal">記号</th>
            <th className="py-1 pr-1 pl-4 text-left font-normal">説明</th>
            <th className="w-24 py-1 pr-1 pl-4 text-left font-normal">点数</th>
            <th className="w-px px-1 py-1 text-center font-normal whitespace-nowrap">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {levels.map((level, levelIndex) => {
            const usageCount = scaleLevelUsageCount(level)
            return (
              <tr key={level.id}>
                <td className="px-1 py-0.5">
                  <Input
                    aria-label="記号"
                    value={textOf(level.id, "label", level.label)}
                    onChange={(e) =>
                      onLevelTextChange(level, "label", e.target.value)
                    }
                    onBlur={() => onFieldBlur(level.id, "label")}
                    placeholder="A"
                    disabled={disabled}
                    className="h-8 text-sm"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <Input
                    aria-label="説明"
                    value={textOf(level.id, "description", level.description)}
                    onChange={(e) =>
                      onLevelTextChange(level, "description", e.target.value)
                    }
                    onBlur={() => onFieldBlur(level.id, "description")}
                    placeholder="根拠を2つ以上挙げて説明している"
                    disabled={disabled}
                    className="h-8 text-sm"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <Input
                    aria-label="点数"
                    inputMode="decimal"
                    value={textOf(level.id, "score", String(level.score))}
                    onChange={(e) => onScoreChange(levelIndex, e.target.value)}
                    onBlur={() => onFieldBlur(level.id, "score")}
                    placeholder="10"
                    disabled={disabled}
                    className="h-8 text-sm"
                  />
                  {points !== null && level.score > points && (
                    <p className="mt-0.5 px-1 text-[11px] whitespace-nowrap text-muted-foreground">
                      配点（{points}点）を超えています
                    </p>
                  )}
                </td>
                <td className="px-1 py-0.5">
                  <div className="flex items-center justify-end gap-0.5">
                    {usageCount > 0 && (
                      <span
                        className="mr-1 text-[11px] whitespace-nowrap text-muted-foreground"
                        title="付けた採点・確定・項目が使っている類型は消せません"
                      >
                        {usageCount}件で使用中
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      aria-label="上へ"
                      disabled={disabled || levelIndex === 0}
                      onClick={() => onMoveLevel(levelIndex, levelIndex - 1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      aria-label="下へ"
                      disabled={disabled || levelIndex === levels.length - 1}
                      onClick={() => onMoveLevel(levelIndex, levelIndex + 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      aria-label="類型を削除"
                      disabled={disabled || usageCount > 0}
                      onClick={() => onDeleteLevel(levelIndex)}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="px-1 text-xs text-muted-foreground">
        点数は、この類型を付けた答案の点です（0
        以上。配点を超えてもかまいません）。
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ml-1 h-7 text-xs"
        disabled={disabled}
        onClick={onAddLevel}
      >
        <Plus className="mr-1 h-3 w-3" />
        類型を追加
      </Button>
    </div>
  )
}
