"use client"

import {
  ArrowLeft,
  ClipboardCheck,
  ClipboardList,
  Import,
  ListTree,
  Pencil,
  School,
  TriangleAlert,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"

import { ChangePreview } from "./final-confirm/ChangePreview"
import {
  calculateCategorySummary,
  calculateScoringSummary,
} from "./final-confirm/importSummary"
import { ScoringSummaryCard } from "./final-confirm/ScoringSummaryCard"
import { SummaryCard } from "./final-confirm/SummaryCard"

interface FinalConfirmStepProps {
  wizard: UseImportWizardReturn
  onExecute: () => void
}

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
        <h3 className="mb-2 text-xl font-semibold">取り込み内容の最終確認</h3>
        <p className="text-muted-foreground">以下の内容で取り込みます</p>
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
                    別で追加する（このPCの「
                    {fileOverviewData.exam.displayLabel}」はそのまま残ります）
                  </li>
                )}
                {idIntegrationConfig.exam === "overwrite" && (
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-amber-500">●</span>
                    既存の試験「{fileOverviewData.exam.displayLabel}
                    」を上書き（試験名・試験日・説明・マーク補正の既定を取り込む内容で置き換え）
                  </li>
                )}
                {idIntegrationConfig.exam !== "separate" &&
                  idIntegrationConfig.exam !== "overwrite" && (
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-purple-500">●</span>
                      既存の試験「{fileOverviewData.exam.displayLabel}
                      」と合わせる（試験名・試験日・説明・マーク補正の既定は後に書かれた方を採用）
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
            icon={<School className="h-5 w-5" />}
            title="学級"
            unit="学級"
            summary={classroomSummary}
          />
        )}

        {/* 小計グループ */}
        {subtotalGroupSummary && (
          <SummaryCard
            icon={<ListTree className="h-5 w-5" />}
            title="小計点グループ"
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

        {/* 注釈 */}
        {manifest && manifest.counts.annotations > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Pencil className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">注釈</h4>
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
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            注意: 取り込み後は元に戻せません
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
          <Import className="h-5 w-5" />
          取り込みを実行
        </Button>
      </div>
    </div>
  )
}
