"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { IdChoice } from "@/types/examArchive.types"

import {
  existingRowsById,
  type IdIntegrationRow,
  resolveIdIntegrationRows,
} from "../../idIntegrationRows"
import { IntegrationItemRow } from "./IntegrationItemRow"
import type { DetailPanelProps, EntityType } from "./types"

/** エンティティごとのタイトル */
const PANEL_TITLES: Record<EntityType, string> = {
  student: "生徒の紐づけ確認",
  classroom: "学級の紐づけ確認",
  subtotalGroup: "小計点グループの紐づけ確認",
}

/**
 * 詳細パネル（紐づけ確認UI）- 共通コンポーネント
 *
 * id で一致しなかった行を1行ずつ出す（学籍番号一致と氏名一致の両方に当たった生徒も1行）。
 * 行ごとの扱いは `resolveIdIntegrationRows` が決めたもの（取り込み時と同じ決まり）。
 */
export function DetailPanel({
  wizard,
  entityType,
  showIndividualMessage,
  subtotalWizard,
}: DetailPanelProps) {
  const {
    state,
    updateIdIntegrationDecision,
    batchUpdateIdIntegrationDecisions,
  } = wizard
  const preMatch = state.fileOverviewData?.[entityType]
  const config = state.idIntegrationConfig[entityType]
  if (!preMatch || !config) return null

  const rows = resolveIdIntegrationRows(preMatch, config)
  if (rows.length === 0) return null

  const existingRows = existingRowsById(preMatch)
  // 既存の行 → それを紐づけ先にしているアーカイブの行（1つの既存の行に結ぶのは1行だけ）
  const claimedExistingIds = new Map<string, string>()
  for (const row of rows) {
    const { existingId } = row.decision
    if (
      row.decision.decisionType === "same_person" &&
      existingId &&
      !claimedExistingIds.has(existingId)
    ) {
      claimedExistingIds.set(existingId, row.importId)
    }
  }

  const matchedRows = rows.filter((row) => row.candidates.length > 0)
  const unmatchedRows = rows.filter((row) => row.candidates.length === 0)
  const requiresChoice = (row: IdIntegrationRow) =>
    entityType === "subtotalGroup" &&
    row.candidates.length === 0 &&
    row.isDefault &&
    config.strategy !== "all_new"

  /** 照合で当たった行を、まだ他で使われていない候補へ「同じもの」にする */
  const linkAllMatched = (idChoice: IdChoice) => {
    const claimed = new Set<string>()
    const items = matchedRows.flatMap((row) => {
      const preferred =
        row.decision.decisionType === "same_person"
          ? row.decision.existingId
          : undefined
      const existingId = [
        preferred,
        ...row.candidates.map((candidate) => candidate.existingId),
      ].find((candidateId) => candidateId && !claimed.has(candidateId))
      if (!existingId) return []
      claimed.add(existingId)
      return [{ importId: row.importId, existingId }]
    })
    batchUpdateIdIntegrationDecisions(
      entityType,
      items,
      "same_person",
      idChoice
    )
  }

  const decideAllUnmatched = (decisionType: "create_new" | "skip") => {
    for (const row of unmatchedRows) {
      updateIdIntegrationDecision(entityType, row.importId, {
        importId: row.importId,
        decisionType,
      })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{PANEL_TITLES[entityType]}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {showIndividualMessage
            ? "それぞれについてどうするか選んでください"
            : "照合結果です。必要に応じて変更できます。"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {matchedRows.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <span className="text-sm font-medium">一致したものを一括で:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => linkAllMatched("use_existing_id")}
              >
                同じものとして、このPCのIDを使う
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => linkAllMatched("use_import_id")}
              >
                同じものとして、ファイルのIDを使う
              </Button>
            </div>
          )}

          {matchedRows.map((row) => (
            <IntegrationItemRow
              key={row.importId}
              row={row}
              entityType={entityType}
              requiresChoice={requiresChoice(row)}
              allExistingItems={preMatch.allExistingItems}
              existingRowsById={existingRows}
              claimedExistingIds={claimedExistingIds}
              onDecisionChange={(decision) =>
                updateIdIntegrationDecision(entityType, row.importId, decision)
              }
              wizard={subtotalWizard}
            />
          ))}

          {unmatchedRows.length > 0 && (
            <div className="mb-1 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <span className="text-sm font-medium">
                一致しなかったものを一括で:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => decideAllUnmatched("create_new")}
              >
                すべて新規作成
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => decideAllUnmatched("skip")}
              >
                すべて取り込まない
              </Button>
            </div>
          )}

          {unmatchedRows.map((row) => (
            <IntegrationItemRow
              key={row.importId}
              row={row}
              entityType={entityType}
              requiresChoice={requiresChoice(row)}
              allExistingItems={preMatch.allExistingItems}
              existingRowsById={existingRows}
              claimedExistingIds={claimedExistingIds}
              onDecisionChange={(decision) =>
                updateIdIntegrationDecision(entityType, row.importId, decision)
              }
              wizard={subtotalWizard}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
