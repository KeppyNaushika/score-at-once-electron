"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { MatchedItemRow } from "./MatchedItemRow"
import { NoMatchItemRow } from "./NoMatchItemRow"
import type { DecisionType, DetailPanelProps, EntityType } from "./types"

/** エンティティごとのタイトル */
const PANEL_TITLES: Record<EntityType, string> = {
  student: "生徒の紐づけ確認",
  class: "学級の紐づけ確認",
  subtotalGroup: "小計グループの紐づけ確認",
}

/**
 * 詳細パネル（紐づけ確認UI）- 共通コンポーネント
 */
export function DetailPanel({
  wizard,
  entityType,
  byName,
  noMatch,
  showIndividualMessage,
  onBatchIdChoice,
}: DetailPanelProps) {
  const { updateIdIntegrationDecision } = wizard

  if (byName.length === 0 && noMatch.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{PANEL_TITLES[entityType]}</CardTitle>
        <p className="text-muted-foreground text-sm">
          {showIndividualMessage
            ? "それぞれについてどうするか選んでください"
            : "照合結果です。必要に応じて変更できます。"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* 一括設定ボタン */}
          {byName.length > 0 && onBatchIdChoice && (
            <div className="bg-muted/30 mb-4 flex items-center gap-2 rounded-lg border p-3">
              <span className="text-sm font-medium">一括設定:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBatchIdChoice("use_existing_id")}
              >
                すべてこのPCのIDを使う
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBatchIdChoice("use_import_id")}
              >
                すべてファイルのIDを使う
              </Button>
            </div>
          )}

          {/* マッチしたアイテム */}
          {byName.map((item) => {
            const currentConfig = wizard.state.idIntegrationConfig[entityType]
            const itemDecision = currentConfig.decisions.find(
              (d) => d.importId === item.importId
            )
            return (
              <MatchedItemRow
                key={item.importId}
                item={item}
                entityType={entityType}
                currentDecision={
                  itemDecision?.decisionType as DecisionType | undefined
                }
                currentIdChoice={itemDecision?.idChoice}
                onDecisionChange={(decision, idChoice) =>
                  updateIdIntegrationDecision(entityType, item.importId, {
                    importId: item.importId,
                    decisionType: decision,
                    existingId: item.existingId,
                    idChoice,
                  })
                }
                wizard={entityType === "subtotalGroup" ? wizard : undefined}
              />
            )
          })}

          {/* マッチしなかったアイテム */}
          {noMatch.map((item) => (
            <NoMatchItemRow
              key={item.importId}
              item={item}
              onDecisionChange={(decision) =>
                updateIdIntegrationDecision(entityType, item.importId, {
                  importId: item.importId,
                  decisionType: decision,
                })
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
