"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { GradeItemResult } from "@/types/grade.types"

import { alignColumn, fmt, NumCell } from "./BreakdownCells"
import { EstimationExplain } from "./EstimationExplain"

// ---------------------------------------------------------------------------
// GradeItemBreakdownPopover – %クリックで算出根拠を表示。
// データソース別の換算内訳と、欠測推定ソースの推定式（ネストpopover）を表示する。
// ---------------------------------------------------------------------------

/** 表のマスの Tooltip は、ブラウザの title と同じくらい待ってから出す */
const CELL_TOOLTIP_DELAY_MS = 500

/**
 * GradeItem内訳テーブルの数値見出し（中央揃え・折返し無し）。
 * table-fixed 下では見出しセルの w-* が列幅を決める（本文セルはこれに追従）。
 * 列幅を変えたいときはこの w-16 を調整する。
 */
const PARENT_TH_NUM = "w-16 pb-1 text-center font-medium whitespace-nowrap"

/** GradeItem列の%ポップオーバー: データソース別の内訳 */
export function GradeItemBreakdownPopover({
  itemResult,
  hasEstimated,
}: {
  itemResult: GradeItemResult
  hasEstimated: boolean
}) {
  const pctText =
    itemResult.percentage !== null && itemResult.percentage !== undefined
      ? `${itemResult.percentage.toFixed(1)}%${hasEstimated ? "*" : ""}`
      : "-"

  const colorClass = itemResult.isAllMissing
    ? "text-red-500"
    : hasEstimated
      ? "text-amber-600"
      : ""

  if (itemResult.sourceScores.length === 0) {
    return (
      <span className={`w-12 text-right text-xs tabular-nums ${colorClass}`}>
        {pctText}
      </span>
    )
  }

  // 列ごとに等幅化（本文の各ソース行と合計・得点率行をまたいで小数点を縦に揃える）
  const sources = itemResult.sourceScores
  const rawScoreColumn = alignColumn(
    sources.map((source) =>
      source.rawScore !== null ? String(source.rawScore) : "-"
    )
  )
  const maxScoreColumn = alignColumn(
    sources.map((source) => String(source.maxScore))
  )
  const weightedColumn = alignColumn([
    ...sources.map((source) =>
      source.weightedScore !== null ? source.weightedScore.toFixed(2) : "欠"
    ),
    itemResult.weightedScore !== null
      ? itemResult.weightedScore.toFixed(2)
      : "-",
  ])
  const weightMaxColumn = alignColumn([
    ...sources.map((source) => String(source.weight)),
    itemResult.weightedMaxScore.toFixed(1),
    itemResult.percentage !== null
      ? `${itemResult.percentage.toFixed(1)}%`
      : "-",
  ])
  // 各ソース（テスト）の実測分布。素点がクラスのどこに位置するかの判断材料として
  // 平均列・標準偏差列を右側に併記する（分布が無ければ "—"）。列内は桁揃え。
  const distMeanColumn = alignColumn(
    sources.map((source) =>
      source.distribution ? fmt(source.distribution.mean) : "—"
    )
  )
  const distSdColumn = alignColumn(
    sources.map((source) =>
      source.distribution ? fmt(source.distribution.standardDeviation) : "—"
    )
  )

  return (
    <Popover>
      {/* 表のマスを横切るたびに出ないよう、少し待ってから出す */}
      <Tooltip delayDuration={CELL_TOOLTIP_DELAY_MS}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`w-12 cursor-pointer text-right text-xs tabular-nums hover:underline ${colorClass}`}
            >
              {pctText}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>クリックで内訳を表示</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-160 p-3" align="start">
        <p className="mb-1 text-xs font-semibold">{itemResult.gradeItemName}</p>
        <p className="mb-2 text-[10px] text-muted-foreground">
          換算 = (素点 ÷ 満点) × 換算満点 ※欠点は除外／平均・標準偏差 =
          この試験を受けた生徒の実測分布（素点の位置づけ用）
        </p>
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-1 text-center font-medium">項目</th>
              <th className={PARENT_TH_NUM}>素点</th>
              <th className={PARENT_TH_NUM}>満点</th>
              <th className={PARENT_TH_NUM}>換算</th>
              <th className={PARENT_TH_NUM}>換算満点</th>
              <th className={PARENT_TH_NUM}>平均</th>
              <th className={PARENT_TH_NUM}>標準偏差</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((sourceScore, index) => {
              const isMissing = sourceScore.weightedScore === null
              return (
                <tr
                  key={sourceScore.dataSourceId}
                  className={`border-b last:border-0 ${isMissing ? "text-muted-foreground line-through" : ""}`}
                >
                  <td className="py-1 pr-1">
                    {sourceScore.isEstimated && sourceScore.estimation ? (
                      <Popover>
                        <Tooltip delayDuration={CELL_TOOLTIP_DELAY_MS}>
                          <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="cursor-pointer text-left text-amber-600 hover:underline"
                              >
                                {sourceScore.dataSourceName}
                                <span className="ml-0.5">*</span>
                              </button>
                            </PopoverTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            クリックで推定の計算式を表示
                          </TooltipContent>
                        </Tooltip>
                        <PopoverContent className="w-lg p-0" align="start">
                          <EstimationExplain sourceScore={sourceScore} />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      sourceScore.dataSourceName
                    )}
                  </td>
                  <NumCell className="py-1">{rawScoreColumn[index]}</NumCell>
                  <NumCell className="py-1">{maxScoreColumn[index]}</NumCell>
                  <NumCell className="py-1">{weightedColumn[index]}</NumCell>
                  <NumCell className="py-1">{weightMaxColumn[index]}</NumCell>
                  <NumCell className="py-1 text-muted-foreground">
                    {distMeanColumn[index]}
                  </NumCell>
                  <NumCell className="py-1 text-muted-foreground">
                    {distSdColumn[index]}
                  </NumCell>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td className="pt-1" colSpan={3}>
                合計（欠点除外）
              </td>
              <NumCell className="pt-1">
                {weightedColumn[weightedColumn.length - 1]}
              </NumCell>
              <NumCell className="pt-1">
                {weightMaxColumn[weightMaxColumn.length - 2]}
              </NumCell>
              <NumCell className="pt-1 text-muted-foreground">—</NumCell>
              <NumCell className="pt-1 text-muted-foreground">—</NumCell>
            </tr>
            <tr className="font-medium">
              <td className="pt-1" colSpan={4}>
                得点率
              </td>
              <NumCell className="pt-1">
                {weightMaxColumn[weightMaxColumn.length - 1]}
              </NumCell>
              <NumCell className="pt-1 text-muted-foreground">—</NumCell>
              <NumCell className="pt-1 text-muted-foreground">—</NumCell>
            </tr>
          </tfoot>
        </table>
      </PopoverContent>
    </Popover>
  )
}
