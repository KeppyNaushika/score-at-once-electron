"use client"

import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  ClipboardList,
  Download,
  GraduationCap,
  Layers,
  Pencil,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  CategoryIdIntegrationConfig,
  PreMatchingResult,
  ScoringConflict,
  ScoringConflictConfig,
  ScoringConflictData,
  UpdateDecisions,
} from "@/types/examArchive.types"

interface FinalConfirmStepProps {
  wizard: UseImportWizardReturn
  onExecute: () => void
}

/** 統一サマリー型 */
interface CategorySummary {
  unchanged: number
  updated: number
  newCount: number
  skipped: number
  idChangeToImport: number
}

// =============================================================================
// カテゴリ別サマリー計算
// =============================================================================

/**
 * 生徒/学級/小計グループのサマリーを計算
 */
function calculateCategorySummary(
  preMatch: PreMatchingResult,
  config: CategoryIdIntegrationConfig,
  updateDecisions: UpdateDecisions,
  category: string
): CategorySummary {
  let newCount = 0
  let skipped = 0
  let idChangeToImport = 0
  let updated = 0
  let kept = 0

  const countUpdateDecision = (importId: string, category: string) => {
    const key = `${category}:${importId}`
    const fieldDecisions = updateDecisions[key]
    if (fieldDecisions && Object.keys(fieldDecisions).length > 0) {
      const hasUpdate = Object.values(fieldDecisions).some(
        (strategy) => strategy === "use_import" || strategy === "use_newer"
      )
      if (hasUpdate) {
        updated++
      } else {
        kept++
      }
    } else {
      // フィールド変更がないならkept
      kept++
    }
  }

  // ID一致
  for (const match of preMatch.byId) {
    countUpdateDecision(match.importId, category)
  }

  const getDecision = (importId: string) => {
    return config.decisions.find((decision) => decision.importId === importId)
  }

  // 学籍番号一致
  if (preMatch.byStudentNumber) {
    for (const match of preMatch.byStudentNumber) {
      const decision = getDecision(match.importId)

      if (
        config.strategy === "by_student_number" ||
        config.strategy === "by_name"
      ) {
        if (!decision || decision.decisionType === "same_person") {
          countUpdateDecision(match.importId, category)
          if (decision?.idChoice === "use_import_id") {
            idChangeToImport++
          }
        } else if (decision.decisionType === "create_new") {
          newCount++
        } else if (decision.decisionType === "skip") {
          skipped++
        }
      } else if (config.strategy === "all_new") {
        if (!decision || decision.decisionType === "create_new") {
          newCount++
        } else if (decision.decisionType === "skip") {
          skipped++
        }
      } else {
        if (decision?.decisionType === "same_person") {
          countUpdateDecision(match.importId, category)
          if (decision.idChoice === "use_import_id") {
            idChangeToImport++
          }
        } else if (decision?.decisionType === "skip") {
          skipped++
        } else {
          newCount++
        }
      }
    }
  }

  // 名前一致
  if (preMatch.byName) {
    for (const match of preMatch.byName) {
      const alreadyProcessed = preMatch.byStudentNumber?.some(
        (studentNumberMatch) => studentNumberMatch.importId === match.importId
      )
      if (alreadyProcessed) continue

      const decision = getDecision(match.importId)

      if (config.strategy === "by_name") {
        if (!decision || decision.decisionType === "same_person") {
          countUpdateDecision(match.importId, category)
          if (decision?.idChoice === "use_import_id") {
            idChangeToImport++
          }
        } else if (decision.decisionType === "create_new") {
          newCount++
        } else if (decision.decisionType === "skip") {
          skipped++
        }
      } else if (config.strategy === "all_new") {
        if (!decision || decision.decisionType === "create_new") {
          newCount++
        } else if (decision.decisionType === "skip") {
          skipped++
        }
      } else {
        if (decision?.decisionType === "same_person") {
          countUpdateDecision(match.importId, category)
          if (decision.idChoice === "use_import_id") {
            idChangeToImport++
          }
        } else if (decision?.decisionType === "skip") {
          skipped++
        } else {
          newCount++
        }
      }
    }
  }

  // 一致なし
  for (const item of preMatch.noMatch) {
    const decision = getDecision(item.importId)
    if (decision?.decisionType === "skip") {
      skipped++
    } else {
      newCount++
    }
  }

  return {
    unchanged: kept,
    updated,
    newCount,
    skipped,
    idChangeToImport,
  }
}

// =============================================================================
// 採点データサマリー計算
// =============================================================================

/**
 * 採点データの予測サマリーを計算
 */
function calculateScoringSummary(
  scoringConflicts: ScoringConflictData | undefined,
  scoringConflictConfig: ScoringConflictConfig,
  totalScoresInArchive: number
): Omit<CategorySummary, "idChangeToImport"> {
  if (!scoringConflicts) {
    return {
      unchanged: 0,
      updated: 0,
      newCount: totalScoresInArchive,
      skipped: 0,
    }
  }

  let updated = 0
  let skipped = 0

  // conflicts にはデータが異なるもののみ含まれる
  for (const conflict of scoringConflicts.conflicts) {
    const resolution = simulateScoringResolution(
      conflict,
      scoringConflictConfig
    )
    if (resolution === "import") {
      updated++
    } else {
      skipped++
    }
  }

  // unchangedCount はバックエンドで計算される。未設定の場合はフォールバック計算
  const unchangedCount =
    scoringConflicts.unchangedCount ??
    totalScoresInArchive -
      scoringConflicts.newCount -
      scoringConflicts.conflictCount

  return {
    unchanged: Math.max(0, unchangedCount),
    updated,
    newCount: scoringConflicts.newCount,
    skipped,
  }
}

/**
 * 採点競合の解決結果をフロントエンドで予測
 * (scoringConflictResolver.ts と同じロジック)
 */
function simulateScoringResolution(
  conflict: ScoringConflict,
  config: ScoringConflictConfig
): "import" | "existing" {
  const strategy = config.strategy ?? "newer_wins"

  switch (strategy) {
    case "import_wins":
      return "import"
    case "existing_wins":
      return "existing"
    case "newer_wins":
      return resolveByTimestamp(conflict)
    case "manual": {
      const manual = config.manualResolutions?.[conflict.importScoreId]
      if (manual) return manual
      return resolveByTimestamp(conflict)
    }
    default:
      return resolveByTimestamp(conflict)
  }
}

function resolveByTimestamp(conflict: ScoringConflict): "import" | "existing" {
  return new Date(conflict.importScore.updatedAt) >
    new Date(conflict.existingScore.updatedAt)
    ? "import"
    : "existing"
}

// =============================================================================
// メインコンポーネント
// =============================================================================

/**
 * 最終確認ステップ
 */
export function FinalConfirmStep({ wizard, onExecute }: FinalConfirmStepProps) {
  const { state, goBack } = wizard
  const {
    fileOverviewData,
    idIntegrationConfig,
    manifest,
    updateDecisions,
    scoringConflictConfig,
  } = state

  // サマリーを計算
  const studentSummary = fileOverviewData
    ? calculateCategorySummary(
        fileOverviewData.student,
        idIntegrationConfig.student,
        updateDecisions,
        "student"
      )
    : null

  const classSummary = fileOverviewData
    ? calculateCategorySummary(
        fileOverviewData.classroom,
        idIntegrationConfig.classroom,
        updateDecisions,
        "classroom"
      )
    : null

  const subtotalGroupSummary = fileOverviewData
    ? calculateCategorySummary(
        fileOverviewData.subtotalGroup,
        idIntegrationConfig.subtotalGroup,
        updateDecisions,
        "subtotalGroup"
      )
    : null

  const totalScoresInArchive = manifest?.counts.scores ?? 0
  const scoringSummary = calculateScoringSummary(
    fileOverviewData?.scoringConflicts,
    scoringConflictConfig,
    totalScoresInArchive
  )

  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      {/* ヘッダー */}
      <div className="mb-8 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
          <ClipboardList className="text-primary h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">インポート内容の最終確認</h3>
        <p className="text-muted-foreground">以下の内容でインポートします</p>
      </div>

      {/* サマリー */}
      <div className="mb-8 w-full max-w-lg space-y-4">
        {/* 生徒 */}
        {studentSummary && (
          <SummaryCard
            icon={<Users className="h-5 w-5" />}
            title="生徒"
            unit="名"
            summary={studentSummary}
          />
        )}

        {/* 学級 */}
        {classSummary && (
          <SummaryCard
            icon={<GraduationCap className="h-5 w-5" />}
            title="学級"
            unit="クラス"
            summary={classSummary}
          />
        )}

        {/* 小計グループ */}
        {subtotalGroupSummary && (
          <SummaryCard
            icon={<Layers className="h-5 w-5" />}
            title="小計グループ"
            unit="グループ"
            summary={subtotalGroupSummary}
          />
        )}

        {/* 採点データ */}
        <ScoringSummaryCard
          scoringSummary={scoringSummary}
          totalScores={manifest?.counts.scores ?? 0}
        />

        {/* 書き込み（アノテーション） */}
        {manifest && manifest.counts.annotations > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Pencil className="text-muted-foreground h-5 w-5" />
                <h4 className="font-medium">書き込み</h4>
              </div>
              <ul className="text-sm">
                <li className="text-muted-foreground flex items-center gap-2">
                  <span className="text-blue-500">●</span>
                  新規追加: {manifest.counts.annotations}件
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 警告 */}
      <Card className="mb-8 w-full max-w-lg border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            注意: インポート後は元に戻せません
          </p>
        </CardContent>
      </Card>

      {/* ボタン */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={goBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          戻って確認
        </Button>
        <Button onClick={onExecute} size="lg" className="gap-2 px-8">
          <Download className="h-5 w-5" />
          インポート実行
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// サブコンポーネント
// =============================================================================

interface SummaryCardProps {
  icon: React.ReactNode
  title: string
  unit: string
  summary: CategorySummary
}

/**
 * 生徒/学級/小計グループ用のサマリーカード
 */
function SummaryCard({ icon, title, unit, summary }: SummaryCardProps) {
  const hasAny =
    summary.unchanged > 0 ||
    summary.updated > 0 ||
    summary.newCount > 0 ||
    summary.skipped > 0

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h4 className="font-medium">{title}</h4>
        </div>
        <ul className="space-y-1 text-sm">
          {!hasAny && <li className="text-muted-foreground">データなし</li>}
          {summary.unchanged > 0 && (
            <li className="text-muted-foreground flex items-center gap-2">
              <span className="text-green-500">●</span>
              既存と一致（変更なし）: {summary.unchanged}
              {unit}
            </li>
          )}
          {summary.updated > 0 && (
            <>
              <li className="text-muted-foreground flex items-center gap-2">
                <span className="text-purple-500">●</span>
                読み込んだデータで更新: {summary.updated}
                {unit}
              </li>
              {summary.idChangeToImport > 0 && (
                <li className="text-muted-foreground ml-6 flex items-center gap-2 text-xs">
                  <span className="text-amber-500">└</span>
                  うち{summary.idChangeToImport}
                  {unit}のIDを変更
                </li>
              )}
            </>
          )}
          {summary.unchanged > 0 &&
            summary.updated === 0 &&
            summary.idChangeToImport > 0 && (
              <li className="text-muted-foreground ml-6 flex items-center gap-2 text-xs">
                <span className="text-amber-500">└</span>
                うち{summary.idChangeToImport}
                {unit}のIDを変更
              </li>
            )}
          {summary.newCount > 0 && (
            <li className="text-muted-foreground flex items-center gap-2">
              <span className="text-blue-500">●</span>
              新規追加: {summary.newCount}
              {unit}
            </li>
          )}
          {summary.skipped > 0 && (
            <li className="text-muted-foreground flex items-center gap-2">
              <span className="text-gray-400">●</span>
              インポートしない: {summary.skipped}
              {unit}
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}

interface ScoringSummaryCardProps {
  scoringSummary: Omit<CategorySummary, "idChangeToImport">
  totalScores: number
}

/**
 * 採点データ用のサマリーカード
 */
function ScoringSummaryCard({
  scoringSummary,
  totalScores,
}: ScoringSummaryCardProps) {
  const total =
    scoringSummary.unchanged +
    scoringSummary.updated +
    scoringSummary.newCount +
    scoringSummary.skipped
  if (total === 0 && totalScores === 0) return null

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck className="text-muted-foreground h-5 w-5" />
          <h4 className="font-medium">採点データ</h4>
        </div>
        <ul className="space-y-1 text-sm">
          {scoringSummary.unchanged > 0 && (
            <li className="text-muted-foreground flex items-center gap-2">
              <span className="text-green-500">●</span>
              既存と一致（変更なし）: {scoringSummary.unchanged}件
            </li>
          )}
          {scoringSummary.updated > 0 && (
            <li className="text-muted-foreground flex items-center gap-2">
              <span className="text-purple-500">●</span>
              読み込んだ採点で上書き: {scoringSummary.updated}件
            </li>
          )}
          {scoringSummary.newCount > 0 && (
            <li className="text-muted-foreground flex items-center gap-2">
              <span className="text-blue-500">●</span>
              新規追加: {scoringSummary.newCount}件
            </li>
          )}
          {scoringSummary.skipped > 0 && (
            <li className="text-muted-foreground flex items-center gap-2">
              <span className="text-gray-400">●</span>
              既存の採点を維持: {scoringSummary.skipped}件
            </li>
          )}
          {scoringSummary.unchanged === 0 &&
            scoringSummary.updated === 0 &&
            scoringSummary.newCount === 0 &&
            scoringSummary.skipped === 0 && (
              <li className="text-muted-foreground">データなし</li>
            )}
        </ul>
      </CardContent>
    </Card>
  )
}
