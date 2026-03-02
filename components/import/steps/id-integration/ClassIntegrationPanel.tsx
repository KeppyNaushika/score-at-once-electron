"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup } from "@/components/ui/radio-group"
import type { ClassMatchingStrategy } from "@/types/examArchive.types"

import { DetailPanel } from "./DetailPanel"
import { StrategyOption } from "./StrategyOption"
import type { ClassIntegrationPanelProps } from "./types"

/**
 * 学級の統合パネル
 */
export function ClassIntegrationPanel({
  wizard,
  onStrategyChange,
}: ClassIntegrationPanelProps) {
  const { state } = wizard
  const overview = state.fileOverviewData?.class
  const strategy = state.idIntegrationConfig.class
    .strategy as ClassMatchingStrategy

  if (!overview) return null

  const byNameCount = overview.byName?.length ?? 0
  const noMatchCount = overview.noMatch.length
  const needsDecisionCount = byNameCount + noMatchCount

  if (needsDecisionCount === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardContent className="p-4 text-center">
          <p className="text-green-700 dark:text-green-300">
            すべての学級が自動で紐づきました
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
            判断が必要な学級が{needsDecisionCount}クラスあります
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            どうやって既存の学級と紐づけますか？
          </p>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={strategy}
            onValueChange={(v) => onStrategyChange(v as ClassMatchingStrategy)}
          >
            <div className="space-y-3">
              <StrategyOption
                value="by_name"
                id="class-by-name"
                label={`学級名で紐づける (${byNameCount}クラスが一致)`}
                description="学級名が同じ学級と紐づけます"
                recommended={byNameCount > 0}
              />
              <StrategyOption
                value="individual"
                id="class-individual"
                label="1つずつ設定する"
                description="各学級について個別に設定します"
              />
              <StrategyOption
                value="all_new"
                id="class-all-new"
                label="全て新しい学級として追加する"
                description="既存の学級とは紐づけません"
              />
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* 紐づけ方法選択後の詳細UI */}
      {(strategy === "by_name" || strategy === "individual") && (
        <DetailPanel
          wizard={wizard}
          entityType="class"
          byName={overview.byName ?? []}
          noMatch={overview.noMatch}
          showIndividualMessage={strategy === "individual"}
          onBatchIdChoice={(idChoice) => {
            const items = (overview.byName ?? []).map((item) => ({
              importId: item.importId,
              existingId: item.existingId,
            }))
            wizard.batchUpdateIdIntegrationDecisions(
              "class",
              items,
              "same_person",
              idChoice
            )
          }}
        />
      )}
    </div>
  )
}
