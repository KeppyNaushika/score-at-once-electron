"use client"

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  ScoringConflict,
  ScoringConflictResolutionStrategy,
} from "@/types/projectArchive.types"

interface ScoringConflictStepProps {
  wizard: UseImportWizardReturn
}

/**
 * 採点結果の競合解決ステップ (Step 3.5)
 *
 * 同じ生徒×設問で異なる採点がある場合の解決方法を選択
 * - すべてファイルの採点を使う
 * - すべてこのPCの採点を使う
 * - 新しい方（最終更新日時）を使う
 * - 競合している採点を1つずつ確認する
 */
export function ScoringConflictStep({ wizard }: ScoringConflictStepProps) {
  const { state, setScoringConflictStrategy, goToNextStep } = wizard
  const { scoringConflictConfig, fileOverviewData } = state

  const conflictData = fileOverviewData?.scoringConflicts
  const conflictCount = conflictData?.conflictCount ?? 0
  const conflicts = conflictData?.conflicts ?? []

  // 競合がない場合
  if (conflictCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">
            採点結果の競合はありません
          </h3>
          <p className="text-muted-foreground max-w-md">
            ファイルの採点結果はすべて新規として追加されます。
          </p>
        </div>
        <Button onClick={goToNextStep} size="lg" className="px-8">
          次へ進む
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="mb-6 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
          <ClipboardCheck className="text-primary h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">採点結果の競合解決</h3>
        <p className="text-muted-foreground">
          同じ生徒の同じ設問に対して、ファイルとこのPCで
          <br />
          異なる採点がされています。どちらを使いますか？
        </p>
      </div>

      {/* 競合件数の表示 */}
      <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            採点結果で競合が <strong>{conflictCount}件</strong> あります
          </p>
        </CardContent>
      </Card>

      {/* 解決方針の選択 */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            どちらの採点を使いますか？
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={scoringConflictConfig.strategy}
            onValueChange={(v) =>
              setScoringConflictStrategy(v as ScoringConflictResolutionStrategy)
            }
          >
            <div className="space-y-3">
              <StrategyOption
                value="import_wins"
                id="import-wins"
                label="すべてファイルの採点を使う"
                description="ファイル（書き出し元）の採点結果で上書きします"
              />
              <StrategyOption
                value="existing_wins"
                id="existing-wins"
                label="すべてこのPCの採点を使う"
                description="このPCの採点結果を維持します"
              />
              <StrategyOption
                value="newer_wins"
                id="newer-wins"
                label="新しい方（最終更新日時）を使う"
                description="それぞれの採点について、最後に更新された方を使います"
                recommended
              />
              <StrategyOption
                value="manual"
                id="manual"
                label="競合している採点を1つずつ確認する"
                description="各競合について個別に選択します"
              />
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* 個別確認UI（manualの場合のみ） */}
      {scoringConflictConfig.strategy === "manual" && (
        <ManualResolutionPanel wizard={wizard} conflicts={conflicts} />
      )}

      {/* 次へボタン */}
      <div className="mt-6 flex justify-center">
        <Button onClick={goToNextStep} size="lg" className="px-8">
          次へ進む
        </Button>
      </div>
    </div>
  )
}

/**
 * 方針選択オプション
 */
interface StrategyOptionProps {
  value: string
  id: string
  label: string
  description: string
  recommended?: boolean
}

function StrategyOption({
  value,
  id,
  label,
  description,
  recommended,
}: StrategyOptionProps) {
  return (
    <div className="flex items-start space-x-3">
      <RadioGroupItem value={value} id={id} />
      <div className="flex-1">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
          {recommended && (
            <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              推奨
            </span>
          )}
        </Label>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  )
}

/**
 * 個別確認パネル
 */
interface ManualResolutionPanelProps {
  wizard: UseImportWizardReturn
  conflicts: ScoringConflict[]
}

function ManualResolutionPanel({
  wizard,
  conflicts,
}: ManualResolutionPanelProps) {
  const {
    setScoringConflictResolution,
    setAllScoringConflictResolutions,
    state,
  } = wizard
  const { manualResolutions } = state.scoringConflictConfig

  // ページネーション
  const [currentPage, setCurrentPage] = useState(0)
  const itemsPerPage = 10
  const totalPages = Math.ceil(conflicts.length / itemsPerPage)
  const currentConflicts = conflicts.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  )

  // 全選択
  const allIds = conflicts.map((c) => c.importScoreId)

  return (
    <Card className="flex-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            競合の確認（{conflicts.length}件）
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAllScoringConflictResolutions(allIds, "import")}
            >
              全てファイル
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setAllScoringConflictResolutions(allIds, "existing")
              }
            >
              全てこのPC
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-75">
          <div className="space-y-3">
            {currentConflicts.map((conflict) => (
              <ConflictCard
                key={conflict.importScoreId}
                conflict={conflict}
                resolution={manualResolutions[conflict.importScoreId]}
                onResolutionChange={(resolution) =>
                  setScoringConflictResolution(
                    conflict.importScoreId,
                    resolution
                  )
                }
              />
            ))}
          </div>
        </ScrollArea>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground text-sm">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={currentPage === totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 個別競合カード
 */
interface ConflictCardProps {
  conflict: ScoringConflict
  resolution?: "import" | "existing"
  onResolutionChange: (resolution: "import" | "existing") => void
}

function ConflictCard({
  conflict,
  resolution,
  onResolutionChange,
}: ConflictCardProps) {
  const formatScore = (
    status: string,
    partialScore: number | null,
    maxPoints: number | null
  ) => {
    if (status === "CORRECT")
      return `正解${maxPoints ? `（${maxPoints}点）` : ""}`
    if (status === "INCORRECT") return "不正解（0点）"
    if (status === "PARTIAL" && partialScore !== null)
      return `部分点（${partialScore}点）`
    if (status === "PENDING") return "未採点"
    return status
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">
          {conflict.studentName} - {conflict.questionLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* ファイルの採点 */}
        <button
          type="button"
          onClick={() => onResolutionChange("import")}
          className={`rounded-lg border p-2 text-left transition-colors ${
            resolution === "import"
              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
              : "hover:bg-muted/50"
          }`}
        >
          <div className="mb-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            ファイルの採点
          </div>
          <div className="text-sm">
            {formatScore(
              conflict.importScore.status,
              conflict.importScore.partialScore,
              conflict.maxPoints
            )}
          </div>
          <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {formatDate(conflict.importScore.updatedAt)}
          </div>
        </button>

        {/* このPCの採点 */}
        <button
          type="button"
          onClick={() => onResolutionChange("existing")}
          className={`rounded-lg border p-2 text-left transition-colors ${
            resolution === "existing"
              ? "border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-950/30"
              : "hover:bg-muted/50"
          }`}
        >
          <div className="mb-1 text-xs font-medium text-green-600 dark:text-green-400">
            このPCの採点
          </div>
          <div className="text-sm">
            {formatScore(
              conflict.existingScore.status,
              conflict.existingScore.partialScore,
              conflict.maxPoints
            )}
          </div>
          <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {formatDate(conflict.existingScore.updatedAt)}
          </div>
        </button>
      </div>
    </div>
  )
}
