"use client"

import { Lock, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { GradeFrozenInfo } from "@/types/grade.types"

interface FrozenCellControlProps {
  frozen: GradeFrozenInfo
  /** 確定値（＝表示中の実効値）。GradeItemResult の percentage / gradeLabel */
  frozenPercentage: number | null
  frozenGradeLabel: string | null
  /** 現在のライブ値で確定し直す */
  onRefreeze: () => void
  /** 確定を解除してリアルタイム算出値へ戻す */
  onUnfreeze: () => void
}

/** 達成率の表示（算出不能は「—」） */
function formatPercentage(percentage: number | null): string {
  return percentage !== null
    ? `${(Math.round(percentage * 10) / 10).toFixed(1)}%`
    : "—"
}

/** 「85.0% B」の形。ラベル未設定なら達成率のみ */
function formatValue(
  percentage: number | null,
  gradeLabel: string | null
): string {
  return gradeLabel !== null
    ? `${formatPercentage(percentage)} ${gradeLabel}`
    : formatPercentage(percentage)
}

/**
 * 確定（凍結）済みセルの錠前アイコンと操作。
 *
 * 確定後に元資料や境界が変わって値が食い違った状態（isStale）は、値そのものは確定値のまま
 * 固定したうえで警告色で示す。「勝手に追従しない」のが確定の目的なので、ここで自動的に
 * 値を更新してはならない。追従させたいときだけ教員が再確定する。
 */
export function FrozenCellControl({
  frozen,
  frozenPercentage,
  frozenGradeLabel,
  onRefreeze,
  onUnfreeze,
}: FrozenCellControlProps) {
  const { isStale } = frozen

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center rounded p-0.5 ${
            isStale
              ? "text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
              : "text-muted-foreground hover:bg-muted"
          }`}
          title={
            isStale
              ? "確定済み（確定後に元データが変わっています）"
              : "確定済み"
          }
        >
          <Lock className="h-3 w-3" />
          {isStale && <TriangleAlert className="h-3 w-3" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs" align="center">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-medium">
            <Lock className="h-3.5 w-3.5" />
            確定済み
          </div>
          <p className="text-muted-foreground">
            {new Date(frozen.frozenAt).toLocaleString("ja-JP")} に確定
          </p>

          {isStale ? (
            <div className="space-y-1.5 rounded border border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950/40">
              <div className="flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300">
                <TriangleAlert className="h-3.5 w-3.5" />
                確定後に元データが変わっています
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 tabular-nums">
                <span className="text-muted-foreground">確定値</span>
                <span className="text-right font-medium">
                  {formatValue(frozenPercentage, frozenGradeLabel)}
                </span>
                <span className="text-muted-foreground">現在の算出値</span>
                <span className="text-right">
                  {formatValue(frozen.livePercentage, frozen.liveGradeLabel)}
                </span>
              </div>
              <p className="text-muted-foreground">
                表示は確定値のまま固定されています。追従させる場合のみ再確定してください。
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              参照資料や境界を変更しても、この値は動きません。
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant={isStale ? "default" : "outline"}
              className="h-7 flex-1 text-xs"
              onClick={onRefreeze}
            >
              現在の値で再確定
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 text-xs"
              onClick={onUnfreeze}
            >
              確定を解除
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
