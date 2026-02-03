"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup } from "@/components/ui/radio-group"
import type { SubtotalGroupMatchingStrategy } from "@/types/projectArchive.types"

import { DetailPanel } from "./DetailPanel"
import { StrategyOption } from "./StrategyOption"
import type { SubtotalGroupIntegrationPanelProps } from "./types"

/**
 * 小計グループの統合パネル
 */
export function SubtotalGroupIntegrationPanel({
  wizard,
  onStrategyChange,
}: SubtotalGroupIntegrationPanelProps) {
  const { state } = wizard
  const overview = state.fileOverviewData?.subtotalGroup
  const strategy = state.idIntegrationConfig.subtotalGroup
    .strategy as SubtotalGroupMatchingStrategy

  if (!overview) return null

  const byNameCount = overview.byName?.length ?? 0
  const noMatchCount = overview.noMatch.length
  const needsDecisionCount = byNameCount + noMatchCount

  if (needsDecisionCount === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardContent className="p-4 text-center">
          <p className="text-green-700 dark:text-green-300">
            すべての小計グループが自動で紐づきました
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
            判断が必要な小計グループが{needsDecisionCount}グループあります
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            どうやって既存の小計グループと紐づけますか？
          </p>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={strategy}
            onValueChange={(v) =>
              onStrategyChange(v as SubtotalGroupMatchingStrategy)
            }
          >
            <div className="space-y-3">
              <StrategyOption
                value="by_name"
                id="subtotal-by-name"
                label={`グループ名で紐づける (${byNameCount}グループが一致)`}
                description="グループ名が同じ小計グループと紐づけます"
                recommended={byNameCount > 0}
              />
              <StrategyOption
                value="individual"
                id="subtotal-individual"
                label="1つずつ設定する"
                description="各グループについて個別に設定します"
              />
              <StrategyOption
                value="all_new"
                id="subtotal-all-new"
                label="全て新しいグループとして追加する"
                description="既存のグループとは紐づけません"
              />
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* 紐づけ方法選択後の詳細UI */}
      {(strategy === "by_name" || strategy === "individual") && (
        <DetailPanel
          wizard={wizard}
          entityType="subtotalGroup"
          byName={overview.byName ?? []}
          noMatch={overview.noMatch}
          showIndividualMessage={strategy === "individual"}
          onBatchIdChoice={(idChoice) => {
            const items = (overview.byName ?? []).map((item) => ({
              importId: item.importId,
              existingId: item.existingId,
            }))
            wizard.batchUpdateIdIntegrationDecisions(
              "subtotalGroup",
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
