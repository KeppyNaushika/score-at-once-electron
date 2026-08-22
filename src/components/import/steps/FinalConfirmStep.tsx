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
  MatchedItem,
  PreMatchingResult,
  ScoringConflict,
  ScoringConflictData,
} from "@/types/examArchive.types"
import type { ImportAction } from "@/types/importAction.types"

import { ChangePreview } from "./final-confirm/ChangePreview"

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
  action: ImportAction
): CategorySummary {
  let newCount = 0
  let skipped = 0
  let idChangeToImport = 0
  let updated = 0
  let kept = 0

  /**
   * 同じ実体だと決まった行を「書き換わる」「そのまま」へ数える。
   * どちらになるかは取り込みの方針だけで決まる（項目ごとの選択は無い）。
   */
  const countLinked = (match: MatchedItem) => {
    if (takesArchiveRow(match, action)) {
      updated++
    } else {
      kept++
    }
  }

  const countUpdateDecision = (importId: string) => {
    const match = [
      ...preMatch.byId,
      ...(preMatch.byStudentNumber ?? []),
      ...(preMatch.byName ?? []),
    ].find((candidate) => candidate.importId === importId)
    if (match) countLinked(match)
  }

  // ID一致
  for (const match of preMatch.byId) {
    countLinked(match)
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
          countUpdateDecision(match.importId)
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
          countUpdateDecision(match.importId)
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
          countUpdateDecision(match.importId)
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
          countUpdateDecision(match.importId)
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
  action: ImportAction,
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

  // conflicts にはデータが異なるもののみ含まれる。
  // 採点も他の値と同じ方針で決まる（上書き=ファイル / 統合=後に書かれた方）
  for (const conflict of scoringConflicts.conflicts) {
    if (takesArchiveScore(conflict, action)) {
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
 * 同じ実体だと決まった行が、ファイル側の値で書き換わるか（実行前の見込み）
 *
 * main の importValuePolicy と同じ規則。別で追加するときは既存に触らない。
 */
function takesArchiveRow(match: MatchedItem, action: ImportAction): boolean {
  if (action === "overwrite") return true
  if (action === "separate") return false
  const importUpdatedAt = match.importData.updatedAt
  const existingUpdatedAt = match.existingData?.updatedAt
  if (typeof importUpdatedAt !== "string") return false
  if (typeof existingUpdatedAt !== "string") return true
  return new Date(importUpdatedAt) > new Date(existingUpdatedAt)
}

/**
 * 重なった採点のうち、ファイル側が採られるか（実行前の見込み）
 *
 * 判定は main の importValuePolicy と同じ規則。ここは表示のための予測で、
 * 書き込みの判断そのものは main が行う。
 */
function takesArchiveScore(
  conflict: ScoringConflict,
  action: ImportAction
): boolean {
  if (action === "overwrite") return true
  if (action === "separate") return false
  return (
    new Date(conflict.importScore.updatedAt) >
    new Date(conflict.existingScore.updatedAt)
  )
}

// =============================================================================
// メインコンポーネント
// =============================================================================

/**
 * 最終確認ステップ
 */
export function FinalConfirmStep({ wizard, onExecute }: FinalConfirmStepProps) {
  const { state, goBack } = wizard
  const { fileOverviewData, idIntegrationConfig, manifest } = state
  const importAction = idIntegrationConfig.exam ?? "merge"

  // サマリーを計算
  const studentSummary = fileOverviewData
    ? calculateCategorySummary(
        fileOverviewData.student,
        idIntegrationConfig.student,
        importAction
      )
    : null

  const classroomSummary = fileOverviewData
    ? calculateCategorySummary(
        fileOverviewData.classroom,
        idIntegrationConfig.classroom,
        importAction
      )
    : null

  const subtotalGroupSummary = fileOverviewData
    ? calculateCategorySummary(
        fileOverviewData.subtotalGroup,
        idIntegrationConfig.subtotalGroup,
        importAction
      )
    : null

  const totalScoresInArchive = manifest?.counts.scores ?? 0
  const scoringSummary = calculateScoringSummary(
    fileOverviewData?.scoringConflicts,
    importAction,
    totalScoresInArchive
  )

  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      {/* ヘッダー */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <ClipboardList className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">インポート内容の最終確認</h3>
        <p className="text-muted-foreground">以下の内容でインポートします</p>
      </div>

      {/* サマリー */}
      <div className="mb-8 w-full max-w-lg space-y-4">
        {/* 試験（同じ試験が既にある場合の分かれ道） */}
        {fileOverviewData?.exam?.isIdMatch && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">試験</h4>
              </div>
              <ul className="text-sm">
                {idIntegrationConfig.exam === "separate" && (
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-blue-500">●</span>
                    別で追加する（このパソコンの「
                    {fileOverviewData.exam.displayLabel}」はそのまま残ります）
                  </li>
                )}
                {idIntegrationConfig.exam === "overwrite" && (
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-amber-500">●</span>
                    既存の試験「{fileOverviewData.exam.displayLabel}
                    」を上書き（試験名・試験日・説明・マーク補正の既定を読み込んだ内容で置き換え）
                  </li>
                )}
                {idIntegrationConfig.exam !== "separate" &&
                  idIntegrationConfig.exam !== "overwrite" && (
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-purple-500">●</span>
                      既存の試験「{fileOverviewData.exam.displayLabel}
                      」へ統合（試験名・試験日・説明・マーク補正の既定は後に書かれた方を採用）
                    </li>
                  )}
              </ul>
            </CardContent>
          </Card>
        )}

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
        {classroomSummary && (
          <SummaryCard
            icon={<GraduationCap className="h-5 w-5" />}
            title="学級"
            unit="クラス"
            summary={classroomSummary}
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

        {/* このPCの情報が書き換わるもの（読み取り専用） */}
        {fileOverviewData && (
          <ChangePreview
            fileOverviewData={fileOverviewData}
            studentConfig={idIntegrationConfig.student}
            classroomConfig={idIntegrationConfig.classroom}
            subtotalGroupConfig={idIntegrationConfig.subtotalGroup}
            action={importAction}
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
                <Pencil className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">書き込み</h4>
              </div>
              <ul className="text-sm">
                <li className="flex items-center gap-2 text-muted-foreground">
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
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">●</span>
              既存と一致（変更なし）: {summary.unchanged}
              {unit}
            </li>
          )}
          {summary.updated > 0 && (
            <>
              <li className="flex items-center gap-2 text-muted-foreground">
                <span className="text-purple-500">●</span>
                読み込んだデータで更新: {summary.updated}
                {unit}
              </li>
              {summary.idChangeToImport > 0 && (
                <li className="ml-6 flex items-center gap-2 text-xs text-muted-foreground">
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
              <li className="ml-6 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-amber-500">└</span>
                うち{summary.idChangeToImport}
                {unit}のIDを変更
              </li>
            )}
          {summary.newCount > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-blue-500">●</span>
              新規追加: {summary.newCount}
              {unit}
            </li>
          )}
          {summary.skipped > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
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
          <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
          <h4 className="font-medium">採点データ</h4>
        </div>
        <ul className="space-y-1 text-sm">
          {scoringSummary.unchanged > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">●</span>
              既存と一致（変更なし）: {scoringSummary.unchanged}件
            </li>
          )}
          {scoringSummary.updated > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-purple-500">●</span>
              読み込んだ採点で上書き: {scoringSummary.updated}件
            </li>
          )}
          {scoringSummary.newCount > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="text-blue-500">●</span>
              新規追加: {scoringSummary.newCount}件
            </li>
          )}
          {scoringSummary.skipped > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
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
