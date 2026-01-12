"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { MatchedItemRow } from "./MatchedItemRow"
import { NoMatchItemRow } from "./NoMatchItemRow"
import type { DetailPanelProps, EntityType } from "./types"

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
          {/* マッチしたアイテム */}
          {byName.map((item) => (
            <MatchedItemRow
              key={item.importId}
              item={item}
              entityType={entityType}
              onDecisionChange={(decision, idChoice) =>
                updateIdIntegrationDecision(entityType, item.importId, {
                  importId: item.importId,
                  decisionType: decision,
                  existingId: item.existingId,
                  idChoice,
                })
              }
            />
          ))}

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
