"use client"

import type { Subtotal } from "@prisma/client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Calculator, RotateCcw } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

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
import type { CropSubtotalWithSubtotalGroup } from "@/electron-src/lib/prisma/cropSubtotal"
import type { SubtotalGroupWithSubtotals } from "@/electron-src/lib/prisma/subtotalGroup"

import { type FillUpdate, useFillHandleDrag } from "../hooks/useFillHandleDrag"
import { CheckboxCellWithFillHandle } from "./CheckboxCellWithFillHandle"

interface SubtotalAssignmentMatrixWithFillHandleProps {
  subtotalGroups: SubtotalGroupWithSubtotals[]
  subtotalRegions: CropRegionWithSubtotals[] // SUBTOTAL_SCORE type regions
  onUpdateSubtotalAssignments: (
    subtotalCropRegionId: string,
    subtotalIds: string[]
  ) => Promise<boolean>
}

/** 小計欄（CropRegion.id）→ 割り当てた小計id の集合 */
type SubtotalAssignmentState = Record<string, Set<string>>

/** 未取得のときに毎回新しい値を作らないための空値 */
const EMPTY_ASSIGNMENTS: SubtotalAssignmentState = {}

/** 1マス分の割り当てを足し引きした新しい集合を返す（元は書き換えない） */
function toggleAssignment(
  assignments: SubtotalAssignmentState,
  regionId: string,
  subtotalId: string,
  checked: boolean
): SubtotalAssignmentState {
  const next = new Set(assignments[regionId] ?? [])
  if (checked) next.add(subtotalId)
  else next.delete(subtotalId)
  return { ...assignments, [regionId]: next }
}

export function SubtotalAssignmentMatrixWithFillHandle({
  subtotalGroups,
  subtotalRegions,
  onUpdateSubtotalAssignments,
}: SubtotalAssignmentMatrixWithFillHandleProps) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  // 選択されたセルの状態（rowId-colId形式）
  const [selectedCell, setSelectedCell] = useState<string | null>(null)

  // 全ての小計項目をフラットな配列に変換（列データ）
  const allSubtotals = subtotalGroups.flatMap((group) => group.subtotals)

  // 保存済みの割り当てが唯一の出所。編集は楽観更新でキャッシュを差し替え、
  // 失敗したら元へ戻す（「変更をリセット」は取り直すだけで済む）
  const subtotalRegionIds = useMemo(
    () => subtotalRegions.map((cropRegion) => cropRegion.id),
    [subtotalRegions]
  )
  const queryKey = useMemo(
    () => ["subtotalAssignments", subtotalRegionIds],
    [subtotalRegionIds]
  )
  const { data: assignments = EMPTY_ASSIGNMENTS, isPending: loading } =
    useQuery({
      queryKey,
      queryFn: async () => {
        const perRegion = await Promise.all(
          subtotalRegionIds.map(async (cropRegionId) => {
            const cropSubtotals =
              await window.electronAPI.getCropSubtotalsByCropRegionId(
                cropRegionId
              )
            return [
              cropRegionId,
              new Set(
                cropSubtotals.map(
                  (cropSubtotal: CropSubtotalWithSubtotalGroup) =>
                    cropSubtotal.subtotalId
                )
              ),
            ] as const
          })
        )
        return Object.fromEntries(perRegion) as SubtotalAssignmentState
      },
    })

  const setAssignments = useCallback(
    (
      update: (previous: SubtotalAssignmentState) => SubtotalAssignmentState
    ) => {
      queryClient.setQueryData<SubtotalAssignmentState>(queryKey, (previous) =>
        update(previous ?? EMPTY_ASSIGNMENTS)
      )
    },
    [queryClient, queryKey]
  )

  const loadAssignments = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  // フィルハンドルのドラッグ管理
  const {
    handleFillHandleMouseDown,
    handleCellMouseEnter,
    handleMouseUp,
    isInFillRange,
  } = useFillHandleDrag({
    rows: subtotalRegions,
    cols: allSubtotals,
    onFillComplete: async (updates: FillUpdate[]) => {
      setSaving(true)
      try {
        // 各セルを順次更新
        for (const update of updates) {
          const subtotalRegionId = update.rowId
          const subtotalId = update.colId
          const newValue = update.value

          // UI状態を即座に更新
          setAssignments((prev) => {
            const newAssignments = { ...prev }
            if (!newAssignments[subtotalRegionId]) {
              newAssignments[subtotalRegionId] = new Set()
            }

            if (newValue) {
              newAssignments[subtotalRegionId].add(subtotalId)
            } else {
              newAssignments[subtotalRegionId].delete(subtotalId)
            }

            return newAssignments
          })

          // データベースに保存
          const currentAssignments = assignments[subtotalRegionId] || new Set()
          const updatedAssignments = new Set(currentAssignments)

          if (newValue) {
            updatedAssignments.add(subtotalId)
          } else {
            updatedAssignments.delete(subtotalId)
          }

          await onUpdateSubtotalAssignments(
            subtotalRegionId,
            Array.from(updatedAssignments)
          )
        }

        console.log(`✅ フィルハンドルで${updates.length}セルを更新しました`)
      } catch (error) {
        console.error("❌ フィルハンドルでの更新エラー:", error)
        // エラー時は全体をリロード
        loadAssignments()
      } finally {
        setSaving(false)
      }
    },
  })

  // チェックボックスの状態を変更（逐次保存）
  const handleAssignmentChange = async (
    subtotalRegionId: string,
    itemId: string,
    checked: boolean
  ) => {
    // UI状態を即座に更新
    setAssignments((prev) =>
      toggleAssignment(prev, subtotalRegionId, itemId, checked)
    )

    // 逐次保存処理
    try {
      setSaving(true)

      // 現在の関連付け状態を取得
      const currentAssignments = assignments[subtotalRegionId] || new Set()
      const updatedAssignments = new Set(currentAssignments)

      if (checked) {
        updatedAssignments.add(itemId)
      } else {
        updatedAssignments.delete(itemId)
      }

      // データベースに即座に保存
      await onUpdateSubtotalAssignments(
        subtotalRegionId,
        Array.from(updatedAssignments)
      )
    } catch (error) {
      console.error("❌ 小計点関連付け保存エラー:", error)

      // エラー時はUIを元に戻す
      setAssignments((prev) =>
        toggleAssignment(prev, subtotalRegionId, itemId, !checked)
      )
    } finally {
      setSaving(false)
    }
  }

  /** 変更をリセット＝保存済みの状態を取り直す */
  const handleReset = () => {
    void loadAssignments()
  }

  // セル選択
  const handleCellClick = (rowId: string, colId: string) => {
    const cellKey = `${rowId}-${colId}`
    setSelectedCell(cellKey)
  }

  // セルが選択されているか判定
  const isCellSelected = (rowId: string, colId: string): boolean => {
    return selectedCell === `${rowId}-${colId}`
  }

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="mt-2 text-muted-foreground">
          小計点関連付けデータを読み込み中...
        </p>
      </div>
    )
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
            onClick={handleReset}
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
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
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
                            onMouseEnter={() =>
                              handleCellMouseEnter({
                                rowId: region.id,
                                colId: subtotal.id,
                                rowIndex,
                                colIndex: currentColIndex,
                              })
                            }
                          >
                            <CheckboxCellWithFillHandle
                              checked={
                                assignments[region.id]?.has(subtotal.id) ||
                                false
                              }
                              onChange={(checked) =>
                                handleAssignmentChange(
                                  region.id,
                                  subtotal.id,
                                  checked
                                )
                              }
                              onFillHandleDragStart={(e, initialValue) => {
                                e.preventDefault()
                                handleFillHandleMouseDown(
                                  {
                                    rowId: region.id,
                                    colId: subtotal.id,
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
                              isInFillRange={isInFillRange(
                                region.id,
                                subtotal.id
                              )}
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
