"use client"

import type { Subtotal } from "@prisma/client"
import { Calculator, RotateCcw } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import type { SubtotalGroupWithSubtotals } from "@/electron-src/lib/prisma/subtotalGroup"

import { useCropSubtotalAssignments } from "../hooks/useCropSubtotalAssignments"
import { useFillHandleDrag } from "../hooks/useFillHandleDrag"
import { CheckboxCellWithFillHandle } from "./CheckboxCellWithFillHandle"

interface SubtotalAssignmentMatrixWithFillHandleProps {
  examId: string
  subtotalGroups: SubtotalGroupWithSubtotals[]
  /** 小計欄領域（SUBTOTAL_SCORE）。割り当ての出所でもある */
  subtotalRegions: CropRegionWithSubtotals[]
  /** 保存済みの割り当てを取り直す */
  onReload: () => void
}

export function SubtotalAssignmentMatrixWithFillHandle({
  examId,
  subtotalGroups,
  subtotalRegions,
  onReload,
}: SubtotalAssignmentMatrixWithFillHandleProps) {
  // 選択されたセルの状態（rowId-colId形式）
  const [selectedCell, setSelectedCell] = useState<string | null>(null)

  // 全ての小計項目をフラットな配列に変換（列データ）
  const allSubtotals = subtotalGroups.flatMap((group) => group.subtotals)

  const { isAssigned, saving, setCellAssignment, fillCells } =
    useCropSubtotalAssignments({
      examId,
      assignmentType: "SUBTOTAL_DEFINITION",
    })

  // フィルハンドルのドラッグ管理
  const {
    handleFillHandlePointerDown,
    handleCellPointerEnter,
    handlePointerUp,
    isInFillRange,
  } = useFillHandleDrag({
    rows: subtotalRegions,
    cols: allSubtotals,
    onFillComplete: fillCells,
  })

  // セル選択
  const handleCellClick = (rowId: string, colId: string) => {
    const cellKey = `${rowId}-${colId}`
    setSelectedCell(cellKey)
  }

  // セルが選択されているか判定
  const isCellSelected = (rowId: string, colId: string): boolean => {
    return selectedCell === `${rowId}-${colId}`
  }

  if (subtotalGroups.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Calculator className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>小計点がありません</p>
        <p className="text-sm">まず小計点と項目を作成してください</p>
      </div>
    )
  }

  if (subtotalRegions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Calculator className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>小計点領域がありません</p>
        <p className="text-sm">採点領域から小計点領域を作成してください</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          <span className="font-medium">
            小計点領域とグループ項目の関連付け
          </span>
          {saving && (
            <Badge
              variant="outline"
              className="bg-blue-50 text-xs text-blue-700"
            >
              保存中...
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReload}
            disabled={saving}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            リセット
          </Button>
        </div>
      </div>

      {/* マトリックステーブル */}
      <div className="rounded-lg border">
        <div className="border-b bg-gray-50 px-4 py-3">
          <h3 className="text-base font-medium">小計点関連付けマトリックス</h3>
        </div>
        <div
          className="relative min-h-96 w-full overflow-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0, 0, 0, 0.2) transparent",
          }}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <Table className="w-auto" style={{ width: "fit-content" }}>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="sticky top-0 left-0 z-30 border-r-2 border-gray-200 bg-white px-2 py-1 text-center"
                  style={{
                    width: "128px",
                    minWidth: "128px",
                    maxWidth: "128px",
                  }}
                >
                  小計点領域
                </TableHead>
                {subtotalGroups.map((group) => (
                  <TableHead
                    key={group.id}
                    className="sticky top-0 z-20 border-l-2 border-green-200 bg-green-50/50 text-center"
                    colSpan={group.subtotals.length}
                  >
                    <div className="text-sm font-semibold text-green-700">
                      {group.name}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
              <TableRow>
                <TableHead
                  className="sticky top-10.25 left-0 z-30 border-r-2 border-gray-200 bg-white"
                  style={{
                    width: "128px",
                    minWidth: "128px",
                    maxWidth: "128px",
                  }}
                >
                  {/* 空のセル */}
                </TableHead>
                {subtotalGroups.map((group) =>
                  group.subtotals.map((subtotal: Subtotal) => (
                    <TableHead
                      key={subtotal.id}
                      className="sticky top-10.25 z-20 bg-gray-50/50 px-2 text-center"
                    >
                      <div className="text-xs text-muted-foreground">
                        {subtotal.name}
                      </div>
                    </TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {subtotalRegions.map((region, rowIndex) => (
                <TableRow key={region.id}>
                  <TableCell
                    className="sticky left-0 z-10 border-r-2 border-gray-200 bg-white px-2 py-1"
                    style={{
                      width: "128px",
                      minWidth: "128px",
                      maxWidth: "128px",
                    }}
                  >
                    <div className="flex items-center gap-1 overflow-hidden">
                      <div className="flex-1 text-sm font-medium">
                        {region.label || `小計${region.orderIndex || 1}`}
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 bg-green-50 text-xs text-green-700"
                      >
                        小計点
                      </Badge>
                    </div>
                  </TableCell>
                  {(() => {
                    let colIndex = 0
                    return subtotalGroups.map((group) =>
                      group.subtotals.map((subtotal: Subtotal) => {
                        const currentColIndex = colIndex++
                        return (
                          <TableCell
                            key={subtotal.id}
                            className="p-0 text-center"
                            onPointerEnter={() =>
                              handleCellPointerEnter({
                                row: region,
                                col: subtotal,
                                rowIndex,
                                colIndex: currentColIndex,
                              })
                            }
                          >
                            <CheckboxCellWithFillHandle
                              checked={isAssigned(region, subtotal)}
                              onChange={(checked) =>
                                setCellAssignment(region, subtotal, checked)
                              }
                              onFillHandleDragStart={(e, initialValue) => {
                                e.preventDefault()
                                handleFillHandlePointerDown(
                                  {
                                    row: region,
                                    col: subtotal,
                                    rowIndex,
                                    colIndex: currentColIndex,
                                  },
                                  initialValue
                                )
                              }}
                              onCellClick={() =>
                                handleCellClick(region.id, subtotal.id)
                              }
                              isSelected={isCellSelected(
                                region.id,
                                subtotal.id
                              )}
                              disabled={saving}
                              isInFillRange={isInFillRange(region, subtotal)}
                              disableFillHandle={false}
                            />
                          </TableCell>
                        )
                      })
                    )
                  })()}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 計算ロジック説明 */}
      <div className="rounded-lg bg-green-50 p-4 text-sm text-muted-foreground">
        <h4 className="mb-2 font-medium text-green-800">計算ロジック:</h4>
        <ul className="ml-4 space-y-1">
          <li>
            • <strong>グループ内はOR条件</strong>:
            同じグループ内のいずれかの項目に該当する設問の合計
          </li>
          <li>
            • <strong>グループ間はAND条件</strong>:
            複数グループを選択した場合、すべてのグループに該当する設問の合計
          </li>
          <li>
            • 例: 「大問1」OR「大問2」の設問 AND 「知識・理解」の設問 =
            該当する設問の合計点
          </li>
          <li>
            •{" "}
            <strong>
              セルの右下角（フィルハンドル）をドラッグして範囲コピーできます
            </strong>
            （Excel風）
          </li>
          <li>
            • <strong>変更は自動で保存されます</strong>（逐次保存）
          </li>
        </ul>
      </div>
    </div>
  )
}
