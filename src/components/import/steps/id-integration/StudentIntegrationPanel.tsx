"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup } from "@/components/ui/radio-group"
import type { StudentMatchingStrategy } from "@/types/examArchive.types"

import { resolveIdIntegrationRows } from "../../idIntegrationRows"
import { DetailPanel } from "./DetailPanel"
import { StrategyOption } from "./StrategyOption"
import type { StudentIntegrationPanelProps } from "./types"

/**
 * 生徒の統合パネル
 */
export function StudentIntegrationPanel({
  wizard,
  onStrategyChange,
}: StudentIntegrationPanelProps) {
  const { state } = wizard
  const overview = state.fileOverviewData?.student
  const strategy = state.idIntegrationConfig.student
    .strategy as StudentMatchingStrategy

  if (!overview) return null

  const byStudentNumberCount = overview.byStudentNumber?.length ?? 0
  const byNameCount = overview.byName?.length ?? 0
  // 学籍番号一致と氏名一致は重なるので、行で数える
  const needsDecisionCount = resolveIdIntegrationRows(
    overview,
    state.idIntegrationConfig.student
  ).length

  if (needsDecisionCount === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardContent className="p-4 text-center">
          <p className="text-green-700 dark:text-green-300">
            すべての生徒が自動で紐づきました
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            判断が必要な生徒が{needsDecisionCount}名います
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            どうやって既存の生徒と紐づけますか？
          </p>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={strategy}
            onValueChange={(v) =>
              onStrategyChange(v as StudentMatchingStrategy)
            }
          >
            <div className="space-y-3">
              <StrategyOption
                value="by_student_number"
                id="student-by-number"
                label={`学籍番号で紐づける (${byStudentNumberCount}名が一致)`}
                description="学籍番号が同じ生徒と紐づけます"
                recommended={byStudentNumberCount > 0}
              />
              <StrategyOption
                value="by_name"
                id="student-by-name"
                label={`氏名で紐づける (${byNameCount}名が一致)`}
                description="姓と名が同じ生徒と紐づけます"
              />
              <StrategyOption
                value="individual"
                id="student-individual"
                label="1人ずつ設定する"
                description="各生徒について個別に設定します"
              />
              <StrategyOption
                value="all_new"
                id="student-all-new"
                label="全員を新しい生徒として追加する"
                description="既存の生徒とは紐づけません"
              />
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* 紐づけ方法選択後の詳細UI */}
      {(strategy === "by_student_number" ||
        strategy === "by_name" ||
        strategy === "individual") && (
        <DetailPanel
          wizard={wizard}
          entityType="student"
          showIndividualMessage={strategy === "individual"}
        />
      )}
    </div>
  )
}
