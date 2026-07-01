"use client"

import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { MatchedItemRow } from "./MatchedItemRow"
import { NoMatchItemRow } from "./NoMatchItemRow"
import type { DecisionType, DetailPanelProps, EntityType } from "./types"

/** エンティティごとのタイトル */
const PANEL_TITLES: Record<EntityType, string> = {
  student: "生徒の紐づけ確認",
  classroom: "学級の紐づけ確認",
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
  allExistingItems,
  onBatchNoMatchDecision,
}: DetailPanelProps) {
  const { updateIdIntegrationDecision } = wizard

  // 既にマッチ済みの既存IDを収集（重複紐づけ防止）
  const alreadyMatchedExistingIds = useMemo(() => {
    if (entityType !== "subtotalGroup") return undefined
    const ids = new Set<string>()
    // byId items（自動マッチ、常にリンク済み）
    const overview = wizard.state.fileOverviewData?.subtotalGroup
    if (overview?.byId) {
      for (const item of overview.byId) ids.add(item.existingId)
    }
    const config = wizard.state.idIntegrationConfig.subtotalGroup
    const decisionByImportId = new Map(
      config.decisions.map((d) => [d.importId, d])
    )
    // byName items: 決定未設定（デフォルトsame_person）またはsame_personの場合のみ
    for (const item of byName) {
      const d = decisionByImportId.get(item.importId)
      if (!d || d.decisionType === "same_person") {
        ids.add(item.existingId)
      }
    }
    // 全same_person決定（noMatchの手動紐づけ含む）
    for (const d of config.decisions) {
      if (d.decisionType === "same_person" && d.existingId) {
        ids.add(d.existingId)
      }
    }
    return ids
  }, [
    entityType,
    wizard.state.fileOverviewData,
    wizard.state.idIntegrationConfig,
    byName,
  ])

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

          {/* noMatchアイテムの一括設定ボタン */}
          {noMatch.length > 0 && onBatchNoMatchDecision && (
            <div className="bg-muted/30 mb-1 flex items-center gap-2 rounded-lg border p-3">
              <span className="text-sm font-medium">未照合の一括設定:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBatchNoMatchDecision("create_new")}
              >
                すべて新規作成
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBatchNoMatchDecision("skip")}
              >
                すべて取り込まない
              </Button>
            </div>
          )}

          {/* マッチしなかったアイテム */}
          {noMatch.map((item) => (
            <NoMatchItemRow
              key={item.importId}
              item={item}
              entityType={entityType}
              allExistingItems={allExistingItems}
              wizard={entityType === "subtotalGroup" ? wizard : undefined}
              alreadyMatchedExistingIds={alreadyMatchedExistingIds}
              onDecisionChange={(decision, existingId, idChoice) =>
                updateIdIntegrationDecision(entityType, item.importId, {
                  importId: item.importId,
                  decisionType: decision,
                  existingId,
                  idChoice,
                })
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
