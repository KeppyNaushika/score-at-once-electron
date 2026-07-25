"use client"

import { useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GradeCalculationResult } from "@/types/grade.types"

interface GradeDistributionChartProps {
  result: GradeCalculationResult
}

export function GradeDistributionChart({
  result,
}: GradeDistributionChartProps) {
  const [activeTab, setActiveTab] = useState(result.gradeItems[0]?.id ?? "")

  if (result.gradeItems.length === 0) return null

  return (
    <div className="rounded-lg border p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          {result.gradeItems.map((gradeItem) => (
            <TabsTrigger key={gradeItem.id} value={gradeItem.id}>
              {gradeItem.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {result.gradeItems.map((gradeItem) => {
          const distribution: Record<string, number> = {}
          for (const student of result.students) {
            const itemResult = student.gradeItemResults.find(
              (gradeItemResult) => gradeItemResult.gradeItemId === gradeItem.id
            )
            if (itemResult?.isExcluded) continue
            const label = itemResult?.gradeLabel ?? "未評価"
            distribution[label] = (distribution[label] ?? 0) + 1
          }

          // boundarySetsからminPercentage降順でソート
          const boundarySet = result.boundarySets?.find(
            (candidateSet) => candidateSet.gradeItemId === gradeItem.id
          )
          const labelOrder = new Map<string, number>()
          if (boundarySet) {
            for (const boundary of boundarySet.boundaries) {
              labelOrder.set(boundary.label, boundary.minPercentage)
            }
          }
          const entries = Object.entries(distribution).sort(
            (entryA, entryB) =>
              (labelOrder.get(entryB[0]) ?? -1) -
              (labelOrder.get(entryA[0]) ?? -1)
          )
          if (entries.length === 0) return null

          const maxCount = Math.max(...entries.map(([, count]) => count))
          const total = entries.reduce((sum, [, count]) => sum + count, 0)

          return (
            <TabsContent
              key={gradeItem.id}
              value={gradeItem.id}
              className="mt-3"
            >
              <div className="space-y-2">
                {entries.map(([label, count]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-16 text-right text-sm font-medium">
                      {label}
                    </span>
                    <div className="flex-1">
                      <div
                        className="bg-primary h-6 rounded"
                        style={{
                          width: `${(count / maxCount) * 100}%`,
                          minWidth: "4px",
                        }}
                      />
                    </div>
                    <span className="text-muted-foreground w-20 text-sm">
                      {count}名 ({((count / total) * 100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
