"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AiModelPrice } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { cn } from "@/lib/utils"
import {
  setAiBatchPricePercentMutation,
  setAiModelPricesMutation,
} from "@/queries/aiProvider"

import {
  parseModelPriceFields,
  PRICE_FIELD_KEYS,
  PRICE_FIELD_LABELS,
} from "../utils/modelPriceForm"
import {
  PRICING_DRAFT_STATUS_LABELS,
  type PricingDraftRow,
} from "../utils/pricingImportDraft"
import type { PricingImportDraft } from "./AiPricingPageImport"

interface AiPricingDraftProps {
  provider: GradingProviderId
  draft: PricingImportDraft
  currentBatchPricePercent: number | null
  onClose: () => void
}

/** 取得した日時を見せる形にする（端末の時刻で） */
function formatFetchedAt(fetchedAt: string): string {
  return new Date(fetchedAt).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * 読み込んだ単価の下書き。今の値と比べた状態（新規・変更・同じ）を見せ、選んだ行だけを
 * 「保存」で入れる。1行でも値が正しくなければ何も保存しない
 */
export function AiPricingDraft({
  provider,
  draft,
  currentBatchPricePercent,
  onClose,
}: AiPricingDraftProps) {
  const [rows, setRows] = useState<PricingDraftRow[]>(draft.rows)
  const canImportBatch =
    draft.batchPricePercent !== null &&
    draft.batchPricePercent !== currentBatchPricePercent
  const [isBatchSelected, setIsBatchSelected] = useState(canImportBatch)
  const setPrices = useMutation(setAiModelPricesMutation())
  const setBatchPercent = useMutation(setAiBatchPricePercentMutation())
  const isSaving = setPrices.isPending || setBatchPercent.isPending

  const updateRow = (
    model: string,
    update: (row: PricingDraftRow) => PricingDraftRow
  ) =>
    setRows((prev) =>
      prev.map((row) => (row.pagePrice.model === model ? update(row) : row))
    )

  const selectedRows = rows.filter((row) => row.isSelected)
  const willSaveBatch = canImportBatch && isBatchSelected

  const handleSave = async () => {
    const parsedRows = selectedRows.map((row) =>
      parseModelPriceFields(provider, row.pagePrice.model, row.fields)
    )
    const invalidRow = parsedRows.find((parsedRow) => !parsedRow.isValid)
    if (invalidRow && !invalidRow.isValid) {
      toast.error(invalidRow.message)
      return
    }
    const modelPrices = parsedRows.flatMap((parsedRow): AiModelPrice[] =>
      parsedRow.isValid ? [parsedRow.modelPrice] : []
    )
    try {
      if (modelPrices.length > 0) {
        await setPrices.mutateAsync(modelPrices)
      }
      if (willSaveBatch) {
        await setBatchPercent.mutateAsync({
          provider,
          percent: draft.batchPricePercent,
        })
      }
    } catch {
      // 失敗のトーストは書き込みの meta が出す。下書きは残す（直して保存し直せる）
      return
    }
    toast.success("読み込んだ単価を保存しました")
    onClose()
  }

  return (
    <div
      role="region"
      aria-label="読み込んだ単価の下書き"
      className="space-y-3 rounded-md border border-dashed p-3"
    >
      <div className="space-y-0.5">
        <p className="text-sm font-medium">下書き（まだ保存していません）</p>
        <p className="text-xs break-all text-muted-foreground">
          {draft.sourceUrl} ・ {formatFetchedAt(draft.fetchedAt)} に読み込み
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>モデル</TableHead>
              <TableHead>状態</TableHead>
              {PRICE_FIELD_KEYS.map((key) => (
                <TableHead key={key} className="text-right text-xs">
                  {PRICE_FIELD_LABELS[key]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.pagePrice.model}
                className={cn(row.status === "unchanged" && "opacity-60")}
              >
                <TableCell>
                  <Checkbox
                    aria-label={`${row.pagePrice.model} を保存する`}
                    checked={row.isSelected}
                    onCheckedChange={(checked) =>
                      updateRow(row.pagePrice.model, (prev) => ({
                        ...prev,
                        isSelected: checked === true,
                      }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="font-mono text-xs">{row.pagePrice.model}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {row.pagePrice.displayName}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.status === "unchanged" ? "outline" : "secondary"
                    }
                    data-testid={`ai-pricing-draft-status-${row.pagePrice.model}`}
                  >
                    {PRICING_DRAFT_STATUS_LABELS[row.status]}
                  </Badge>
                </TableCell>
                {PRICE_FIELD_KEYS.map((key) => (
                  <TableCell key={key}>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      aria-label={`下書き ${row.pagePrice.model} の${PRICE_FIELD_LABELS[key]}`}
                      value={row.fields[key]}
                      onChange={(event) =>
                        updateRow(row.pagePrice.model, (prev) => ({
                          ...prev,
                          fields: { ...prev.fields, [key]: event.target.value },
                        }))
                      }
                      className="h-8 w-24 text-right tabular-nums"
                    />
                    {row.currentPrice !== null &&
                      String(row.currentPrice[key]) !== row.fields[key] && (
                        <div className="mt-0.5 text-right text-[10px] text-muted-foreground tabular-nums">
                          今 {row.currentPrice[key]}
                        </div>
                      )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-1 text-xs">
        {draft.batchPricePercent === null ? (
          <p className="text-muted-foreground">
            バッチの割合はページから読めませんでした（今の値のままにします）。
          </p>
        ) : canImportBatch ? (
          <label className="flex items-center gap-2">
            <Checkbox
              checked={isBatchSelected}
              onCheckedChange={(checked) =>
                setIsBatchSelected(checked === true)
              }
            />
            バッチの割合を {currentBatchPricePercent ?? "未設定"}
            {currentBatchPricePercent !== null && "%"} から{" "}
            {draft.batchPricePercent}% にする
          </label>
        ) : (
          <p className="text-muted-foreground">
            バッチの割合は今の値（{draft.batchPricePercent}%）と同じです。
          </p>
        )}
        {draft.batchPricePercent !== null &&
          draft.batchExceptionNames.length > 0 && (
            <div className="text-muted-foreground">
              <p>
                バッチの単価がこの割合と違うモデル（割合は事業者に1つなので、これらのバッチの金額はずれます）:
              </p>
              <ul className="list-disc pl-5">
                {draft.batchExceptionNames.map((batchExceptionName) => (
                  <li key={batchExceptionName}>{batchExceptionName}</li>
                ))}
              </ul>
            </div>
          )}
        {draft.unmappedNames.length > 0 && (
          <div className="text-muted-foreground">
            <p>
              モデルの id
              に対応づけられなかった・値を読めなかった名前（取り込みません）:
            </p>
            <ul className="list-disc pl-5">
              {draft.unmappedNames.map((unmappedName) => (
                <li key={unmappedName}>{unmappedName}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          破棄
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isSaving || (selectedRows.length === 0 && !willSaveBatch)}
          onClick={() => {
            void handleSave()
          }}
        >
          選んだ {selectedRows.length} 件を保存
        </Button>
      </div>
    </div>
  )
}
