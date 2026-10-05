"use client"

import { useMutation } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import type { AiModelPrice } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import {
  removeAiModelPriceMutation,
  setAiModelPricesMutation,
} from "@/queries/aiProvider"

import {
  fieldsFromPrice,
  parseModelPriceFields,
  PRICE_FIELD_KEYS,
  PRICE_FIELD_LABELS,
} from "../utils/modelPriceForm"

interface AiModelPriceRowProps {
  provider: GradingProviderId
  model: string
  /** 入れてある単価。まだなら null */
  modelPrice: AiModelPrice | null
}

/**
 * モデル1つの単価の行。5つの欄を直して「保存」で入れる（入力と出力は必須、キャッシュは空欄で 0）。
 * 保存した値が変わると、呼び手の `key` で作り直される
 */
export function AiModelPriceRow({
  provider,
  model,
  modelPrice,
}: AiModelPriceRowProps) {
  const [fields, setFields] = useState(() => fieldsFromPrice(modelPrice))
  const setPrices = useMutation(setAiModelPricesMutation())
  const removePrice = useMutation(removeAiModelPriceMutation())
  const savedFields = fieldsFromPrice(modelPrice)
  const isDirty = PRICE_FIELD_KEYS.some(
    (key) => fields[key] !== savedFields[key]
  )

  const handleSave = () => {
    const parsed = parseModelPriceFields(provider, model, fields)
    if (!parsed.isValid) {
      toast.error(parsed.message)
      return
    }
    setPrices.mutate([parsed.modelPrice], {
      onSuccess: () => toast.success(`${model} の単価を保存しました`),
    })
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {model}
          {modelPrice === null && (
            <Badge variant="outline" className="text-muted-foreground">
              単価未設定
            </Badge>
          )}
        </div>
      </TableCell>
      {PRICE_FIELD_KEYS.map((key) => (
        <TableCell key={key}>
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            aria-label={`${model} の${PRICE_FIELD_LABELS[key]}`}
            value={fields[key]}
            placeholder={
              key === "inputPerMillionUsd" || key === "outputPerMillionUsd"
                ? ""
                : "0"
            }
            onChange={(event) =>
              setFields((prev) => ({ ...prev, [key]: event.target.value }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && isDirty) handleSave()
            }}
            className="h-8 w-24 text-right tabular-nums"
          />
        </TableCell>
      ))}
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={isDirty ? "default" : "outline"}
            disabled={!isDirty || setPrices.isPending}
            onClick={handleSave}
          >
            保存
          </Button>
          {modelPrice !== null && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`${model} の単価を消す`}
              disabled={removePrice.isPending}
              onClick={() => removePrice.mutate({ provider, model })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
