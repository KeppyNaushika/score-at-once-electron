"use client"

import { ArrowRight, RefreshCw } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useGradeConstraints } from "@/hooks/grades/useGradeConstraints"
import { useGradeResults } from "@/hooks/grades/useGradeResults"

import { GradeDistributionChart } from "./GradeDistributionChart"
import { ResultsTable } from "./ResultsTable"

interface ResultsContainerProps {
  gradeId: string
}

export function ResultsContainer({ gradeId }: ResultsContainerProps) {
  const { result, loading, error, recalculate, setGradeOverride } =
    useGradeResults(gradeId)
  const { constraints } = useGradeConstraints(gradeId)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">成績を計算中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <p className="text-destructive mb-2">{error}</p>
        <Button variant="outline" onClick={recalculate}>
          <RefreshCw className="mr-2 h-4 w-4" />
          再計算
        </Button>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            成績結果: {result.gradeName}
          </h2>
          <p className="text-muted-foreground text-sm">
            {result.classNames.join("、") || "学級未登録"} /{" "}
            {result.gradeItems.map((gradeItem) => gradeItem.name).join("、") ||
              "評価項目未設定"}{" "}
            / {result.students.length}名
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={recalculate}>
            <RefreshCw className="mr-2 h-4 w-4" />
            再計算
          </Button>
          <Button asChild>
            <Link href={`/grades/${gradeId}/07-export`}>
              出力へ進む
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <GradeDistributionChart result={result} />
      <ResultsTable
        result={result}
        constraints={constraints}
        onGradeOverride={setGradeOverride}
      />
    </div>
  )
}
