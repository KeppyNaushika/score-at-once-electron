"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatUsd,
  MISSING_PRICE_LABELS,
  type RunCostSummary,
  totalTokenCount,
} from "@/lib/aiUsageCost"

import type {
  ExamUsage,
  ModelUsage,
  MonthlyUsage,
} from "../utils/aiUsageBreakdown"

/** 金額の欄。単価の無い実行が混じれば、合計に入れていないことを添える */
function CostCell({ summary }: { summary: RunCostSummary }) {
  const hasPriced = summary.unpriced.length === 0 || summary.pricedUsd > 0
  return (
    <TableCell className="text-right tabular-nums">
      {hasPriced ? formatUsd(summary.pricedUsd) : "—"}
      {summary.unpriced.length > 0 && (
        <div className="text-[10px] text-muted-foreground">
          {[
            ...new Set(
              summary.unpriced.map(
                (unpriced) => MISSING_PRICE_LABELS[unpriced.missing]
              )
            ),
          ].join("・")}
          の分を除く
        </div>
      )}
    </TableCell>
  )
}

/** トークン数の4つの欄と合計 */
function TokenCells({ summary }: { summary: RunCostSummary }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">
        {summary.usage.inputTokens.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {summary.usage.outputTokens.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {summary.usage.cacheReadTokens.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {summary.usage.cacheWriteTokens.toLocaleString()}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {totalTokenCount(summary.usage).toLocaleString()}
      </TableCell>
    </>
  )
}

function TokenHeads() {
  return (
    <>
      <TableHead className="text-right">入力</TableHead>
      <TableHead className="text-right">出力</TableHead>
      <TableHead className="text-right">キャッシュ読み</TableHead>
      <TableHead className="text-right">キャッシュ書き</TableHead>
      <TableHead className="text-right">合計</TableHead>
      <TableHead className="text-right">金額（概算）</TableHead>
    </>
  )
}

/** 月ごとの表（新しい月が上） */
export function MonthlyUsageTable({
  monthlyUsages,
}: {
  monthlyUsages: readonly MonthlyUsage[]
}) {
  return (
    <Table aria-label="月ごとの使用トークン">
      <TableHeader>
        <TableRow>
          <TableHead>月</TableHead>
          <TableHead className="text-right">実行</TableHead>
          <TokenHeads />
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...monthlyUsages].reverse().map((monthlyUsage) => (
          <TableRow key={monthlyUsage.monthKey}>
            <TableCell className="tabular-nums">
              {monthlyUsage.monthKey.replace("-", "/")}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {monthlyUsage.runCount}
            </TableCell>
            <TokenCells summary={monthlyUsage} />
            <CostCell summary={monthlyUsage} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** 試験ごとの表（使用トークンの多い順） */
export function ExamUsageTable({
  examUsages,
}: {
  examUsages: readonly ExamUsage[]
}) {
  return (
    <Table aria-label="試験ごとの使用トークン">
      <TableHeader>
        <TableRow>
          <TableHead>試験</TableHead>
          <TableHead className="text-right">実行</TableHead>
          <TokenHeads />
        </TableRow>
      </TableHeader>
      <TableBody>
        {examUsages.map((examUsage) => (
          <TableRow key={examUsage.exam.id}>
            <TableCell>{examUsage.exam.examName}</TableCell>
            <TableCell className="text-right tabular-nums">
              {examUsage.runCount}
            </TableCell>
            <TokenCells summary={examUsage} />
            <CostCell summary={examUsage} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** モデルごとの表（使用トークンの多い順） */
export function ModelUsageTable({
  modelUsages,
}: {
  modelUsages: readonly ModelUsage[]
}) {
  return (
    <Table aria-label="モデルごとの使用トークン">
      <TableHeader>
        <TableRow>
          <TableHead>モデル</TableHead>
          <TableHead className="text-right">実行</TableHead>
          <TokenHeads />
        </TableRow>
      </TableHeader>
      <TableBody>
        {modelUsages.map((modelUsage) => (
          <TableRow key={`${modelUsage.provider}/${modelUsage.model}`}>
            <TableCell>
              <div className="font-mono text-xs">{modelUsage.model}</div>
              <div className="text-[10px] text-muted-foreground">
                {modelUsage.provider}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {modelUsage.runCount}
            </TableCell>
            <TokenCells summary={modelUsage} />
            <CostCell summary={modelUsage} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
