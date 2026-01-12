"use client"

import type { Subtotal } from "@prisma/client"
import { Grid3X3, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"

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
import {
  CropRegionWithDetails,
  CropSubtotalWithRelations,
  SubtotalGroupWithItems,
} from "@/types/electron"

import { type FillUpdate, useFillHandleDrag } from "../hooks/useFillHandleDrag"
import { CheckboxCellWithFillHandle } from "./CheckboxCellWithFillHandle"

interface QuestionAssignmentMatrixWithFillHandleProps {
  subtotalGroups: SubtotalGroupWithItems[]
  cropRegions: CropRegionWithDetails[]
  onUpdateAssignments: (
    questionCropRegionId: string,
    subtotalIds: string[]
  ) => Promise<boolean>
}

interface AssignmentState {
  [questionId: string]: Set<string> // questionCropRegionId -> Set of subtotalIds
}

interface OriginalAssignmentState {
  [questionId: string]: string[] // questionCropRegionId -> Array of subtotalIds
}

export function QuestionAssignmentMatrixWithFillHandle({
  subtotalGroups,
  cropRegions,
  onUpdateAssignments,
}: QuestionAssignmentMatrixWithFillHandleProps) {
  const [assignments, setAssignments] = useState<AssignmentState>({})
  const [originalAssignments, setOriginalAssignments] =
    useState<OriginalAssignmentState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 選択されたセルの状態（rowId-colId形式）
  const [selectedCell, setSelectedCell] = useState<string | null>(null)

  // 全ての小計項目をフラットな配列に変換（列データ）
  const allSubtotals = subtotalGroups.flatMap((group) => group.subtotals)

  // フィルハンドルのドラッグ管理
  const {
    handleFillHandleMouseDown,
    handleCellMouseEnter,
    handleMouseUp,
    isInFillRange,
  } = useFillHandleDrag({
    rows: cropRegions,
    cols: allSubtotals,
    onFillComplete: async (updates: FillUpdate[]) => {
      setSaving(true)
      try {
        // 各セルを順次更新
        for (const update of updates) {
          const questionId = update.rowId
          const subtotalId = update.colId
          const newValue = update.value

          // UI状態を即座に更新
          setAssignments((prev) => {
            const newAssignments = { ...prev }
            if (!newAssignments[questionId]) {
              newAssignments[questionId] = new Set()
            }

            if (newValue) {
              newAssignments[questionId].add(subtotalId)
            } else {
              newAssignments[questionId].delete(subtotalId)
            }

            return newAssignments
          })

          // データベースに保存
          const currentAssignments = assignments[questionId] || new Set()
          const updatedAssignments = new Set(currentAssignments)

          if (newValue) {
            updatedAssignments.add(subtotalId)
          } else {
            updatedAssignments.delete(subtotalId)
          }

          await onUpdateAssignments(questionId, Array.from(updatedAssignments))

          // 成功時にoriginalAssignmentsも更新
          setOriginalAssignments((prev) => {
            const updated = { ...prev }
            updated[questionId] = Array.from(updatedAssignments)
            return updated
          })
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

  // 既存の関連付けを読み込み
  const loadAssignments = async () => {
    setLoading(true)
    const newAssignments: AssignmentState = {}

    for (const region of cropRegions) {
      try {
        const result = await window.electronAPI.getCropSubtotalsByCropRegionId(
          region.id
        )
        if (result && Array.isArray(result)) {
          newAssignments[region.id] = new Set(
            result.map(
              (cropSubtotal: CropSubtotalWithRelations) =>
                cropSubtotal.subtotalId
            )
          )
        } else {
          newAssignments[region.id] = new Set()
        }
      } catch {
        newAssignments[region.id] = new Set()
      }
    }

    setAssignments(newAssignments)
    setOriginalAssignments(
      Object.fromEntries(
        Object.entries(newAssignments).map(([key, value]) => [
          key,
          Array.from(value),
        ])
      )
    )
    setLoading(false)
  }

  useEffect(() => {
    if (cropRegions.length > 0) {
      loadAssignments()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropRegions])

  // チェックボックスの状態を変更（逐次保存）
  const handleAssignmentChange = async (
    questionId: string,
    itemId: string,
    checked: boolean
  ) => {
    // UI状態を即座に更新
    setAssignments((prev) => {
      const newAssignments = { ...prev }
      if (!newAssignments[questionId]) {
        newAssignments[questionId] = new Set()
      }

      if (checked) {
        newAssignments[questionId].add(itemId)
      } else {
        newAssignments[questionId].delete(itemId)
      }

      return newAssignments
    })

    // 逐次保存処理
    try {
      setSaving(true)

      // 現在の関連付け状態を取得
      const currentAssignments = assignments[questionId] || new Set()
      const updatedAssignments = new Set(currentAssignments)

      if (checked) {
        updatedAssignments.add(itemId)
      } else {
        updatedAssignments.delete(itemId)
      }

      // データベースに即座に保存
      await onUpdateAssignments(questionId, Array.from(updatedAssignments))

      // 成功時にoriginalAssignmentsも更新
      setOriginalAssignments((prev) => {
        const updated = { ...prev }
        updated[questionId] = Array.from(updatedAssignments)
        return updated
      })

      console.log(
        `✅ 関連付け保存成功: 設問${questionId}, 項目${itemId}, チェック:${checked}`
      )
    } catch (error) {
      console.error("❌ 関連付け保存エラー:", error)

      // エラー時はUIを元に戻す
      setAssignments((prev) => {
        const revertedAssignments = { ...prev }
        if (!revertedAssignments[questionId]) {
          revertedAssignments[questionId] = new Set()
        }

        if (checked) {
          revertedAssignments[questionId].delete(itemId)
        } else {
          revertedAssignments[questionId].add(itemId)
        }

        return revertedAssignments
      })
    } finally {
      setSaving(false)
    }
  }

  // 変更をリセット
  const handleReset = () => {
    const resetAssignments: AssignmentState = {}
    for (const [questionId, itemIds] of Object.entries(originalAssignments)) {
      resetAssignments[questionId] = new Set(
        Array.isArray(itemIds) ? itemIds : []
      )
    }
    setAssignments(resetAssignments)
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
        <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
        <p className="text-muted-foreground mt-2">
          関連付けデータを読み込み中...
        </p>
      </div>
    )
  }

  if (subtotalGroups.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <Grid3X3 className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>小計点がありません</p>
        <p className="text-sm">まず小計点と項目を作成してください</p>
      </div>
    )
  }

  if (cropRegions.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <Grid3X3 className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>設問がありません</p>
        <p className="text-sm">採点領域から設問を作成してください</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-5 w-5" />
          <span className="font-medium">設問とグループ項目の関連付け</span>
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
          <h3 className="text-base font-medium">関連付けマトリックス</h3>
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
                  設問
                </TableHead>
                {subtotalGroups.map((group) => (
                  <TableHead
                    key={group.id}
                    className="sticky top-0 z-20 border-l-2 border-blue-200 bg-blue-50/50 text-center"
                    colSpan={group.subtotals.length}
                  >
                    <div className="text-sm font-semibold text-blue-700">
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
                      <div className="text-muted-foreground text-xs">
                        {subtotal.name}
                      </div>
                    </TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cropRegions.map((region, rowIndex) => (
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
                        {region.label || `問${region.orderIndex || 1}`}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {region.points || 0}
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

      {/* 説明 */}
      <div className="text-muted-foreground bg-muted/50 rounded-lg p-4 text-sm">
        <h4 className="mb-2 font-medium">使い方:</h4>
        <ul className="ml-4 space-y-1">
          <li>
            • 各設問に対して、関連付けたいグループ項目にチェックを入れてください
          </li>
          <li>• 一つの設問は複数のグループ項目に関連付けることができます</li>
          <li>• 例: 「問1」を「大問1」と「知識・理解」の両方に関連付け可能</li>
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
