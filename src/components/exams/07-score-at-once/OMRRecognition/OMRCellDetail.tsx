"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { OMRCellResult } from "@/types/omr.types"

interface OMRCellDetailProps {
  cellResult: OMRCellResult
  studentId?: string
  onUpdate: (updatedValues: string[]) => void
  onClose: () => void
}

export function OMRCellDetail({
  cellResult,
  studentId,
  onUpdate,
  onClose,
}: OMRCellDetailProps) {
  const [editValue, setEditValue] = useState(
    cellResult.recognizedValues.join(", ")
  )

  function handleSave() {
    const values = editValue
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value !== "")
    onUpdate(values)
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          セル詳細: {cellResult.label}
          {studentId && (
            <span className="text-muted-foreground ml-2">({studentId})</span>
          )}
        </h4>
        <Button variant="ghost" size="sm" onClick={onClose}>
          閉じる
        </Button>
      </div>

      {/* 認識結果 */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-muted-foreground text-xs">認識結果</Label>
          <div className="mt-0.5">
            {cellResult.recognizedValues.length > 0
              ? cellResult.recognizedValues.join(", ")
              : "（空）"}
          </div>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">信頼度</Label>
          <div className="mt-0.5">
            {(cellResult.confidence * 100).toFixed(1)}%
          </div>
        </div>
        {cellResult.fillRatios && (
          <div className="col-span-2">
            <Label className="text-muted-foreground text-xs">
              塗りつぶし率
            </Label>
            <div className="mt-0.5 flex gap-2">
              {cellResult.fillRatios.map((fillRatio, i) => (
                <span
                  key={i}
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    fillRatio >= 0.4
                      ? "bg-primary/10 text-primary font-medium"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {(fillRatio * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 手動修正 */}
      <div className="space-y-1.5">
        <Label className="text-xs">手動修正</Label>
        <div className="flex gap-2">
          <Input
            className="h-8 text-sm"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="認識値を入力"
          />
          <Button size="sm" className="h-8" onClick={handleSave}>
            適用
          </Button>
        </div>
      </div>
    </div>
  )
}
