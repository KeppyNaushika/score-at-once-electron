"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RotateCcw, Calculator } from "lucide-react"
import {
  QuestionGroupWithItems,
  LayoutRegionWithDetails,
} from "@/types/electron"

interface SubtotalAssignmentMatrixProps {
  questionGroups: QuestionGroupWithItems[]
  subtotalRegions: LayoutRegionWithDetails[] // SUBTOTAL_SCORE type regions
  onUpdateSubtotalAssignments: (
    subtotalLayoutRegionId: string,
    questionGroupItemIds: string[],
  ) => Promise<boolean>
}

interface SubtotalAssignmentState {
  [subtotalRegionId: string]: Set<string> // subtotalLayoutRegionId -> Set of questionGroupItemIds
}

interface OriginalSubtotalAssignmentState {
  [subtotalRegionId: string]: string[] // subtotalLayoutRegionId -> Array of questionGroupItemIds
}

export function SubtotalAssignmentMatrix({
  questionGroups,
  subtotalRegions,
  onUpdateSubtotalAssignments,
}: SubtotalAssignmentMatrixProps) {
  const [assignments, setAssignments] = useState<SubtotalAssignmentState>({})
  const [originalAssignments, setOriginalAssignments] =
    useState<OriginalSubtotalAssignmentState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 既存の関連付けを読み込み
  useEffect(() => {
    const loadAssignments = async () => {
      setLoading(true)
      const newAssignments: SubtotalAssignmentState = {}

      for (const region of subtotalRegions) {
        try {
          const result =
            (await window.electronAPI.getSubtotalDefinitionsByLayoutRegionId(
              region.id,
            )) as any
          
          if (result && Array.isArray(result)) {
            newAssignments[region.id] = new Set(
              result.map((definition: any) => definition.questionGroupItemId),
            )
          } else {
            newAssignments[region.id] = new Set()
          }
        } catch (error) {
          console.error(`Error loading subtotal assignments for region ${region.id}:`, error)
          newAssignments[region.id] = new Set()
        }
      }

      setAssignments(newAssignments)
      setOriginalAssignments(
        Object.fromEntries(
          Object.entries(newAssignments).map(([key, value]) => [
            key,
            Array.from(value),
          ]),
        ),
      )
      setLoading(false)
    }

    if (subtotalRegions.length > 0) {
      loadAssignments()
    }
  }, [subtotalRegions])

  // チェックボックスの状態を変更（逐次保存）
  const handleAssignmentChange = async (
    subtotalRegionId: string,
    itemId: string,
    checked: boolean,
  ) => {
    // UI状態を即座に更新
    setAssignments((prev) => {
      const newAssignments = { ...prev }
      if (!newAssignments[subtotalRegionId]) {
        newAssignments[subtotalRegionId] = new Set()
      }

      if (checked) {
        newAssignments[subtotalRegionId].add(itemId)
      } else {
        newAssignments[subtotalRegionId].delete(itemId)
      }

      return newAssignments
    })

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
      await onUpdateSubtotalAssignments(subtotalRegionId, Array.from(updatedAssignments))
      
      // 成功時にoriginalAssignmentsも更新
      setOriginalAssignments((prev) => {
        const updated = { ...prev }
        updated[subtotalRegionId] = Array.from(updatedAssignments)
        return updated
      })
      
      console.log(`✅ 小計点関連付け保存成功: 小計点${subtotalRegionId}, 項目${itemId}, チェック:${checked}`)
      
    } catch (error) {
      console.error("❌ 小計点関連付け保存エラー:", error)
      
      // エラー時はUIを元に戻す
      setAssignments((prev) => {
        const revertedAssignments = { ...prev }
        if (!revertedAssignments[subtotalRegionId]) {
          revertedAssignments[subtotalRegionId] = new Set()
        }

        if (checked) {
          revertedAssignments[subtotalRegionId].delete(itemId)
        } else {
          revertedAssignments[subtotalRegionId].add(itemId)
        }

        return revertedAssignments
      })
    } finally {
      setSaving(false)
    }
  }

  // 変更をリセット
  const handleReset = () => {
    const resetAssignments: SubtotalAssignmentState = {}
    for (const [regionId, itemIds] of Object.entries(originalAssignments)) {
      resetAssignments[regionId] = new Set(
        Array.isArray(itemIds) ? itemIds : [],
      )
    }
    setAssignments(resetAssignments)
  }

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
        <p className="text-muted-foreground mt-2">
          小計点関連付けデータを読み込み中...
        </p>
      </div>
    )
  }

  if (questionGroups.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <Calculator className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>小計点がありません</p>
        <p className="text-sm">まず小計点と項目を作成してください</p>
      </div>
    )
  }

  if (subtotalRegions.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
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
          <span className="font-medium">小計点領域とグループ項目の関連付け</span>
          {saving && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">小計点関連付けマトリックス</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full">
            <div className="overflow-x-auto">
              <Table className="table-auto" style={{ minWidth: `${192 + questionGroups.reduce((sum, group) => sum + group.items.length, 0) * 128}px` }}>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-background sticky left-0 z-10 w-48">
                    小計点領域
                  </TableHead>
                  {questionGroups.map((group) => (
                    <TableHead 
                      key={group.id} 
                      className="w-32 text-center bg-green-50/50 border-l-2 border-green-200" 
                      colSpan={group.items.length}
                    >
                      <div className="text-sm font-semibold text-green-700">
                        {group.name}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="bg-background sticky left-0 z-10 w-48">
                    {/* 空のセル */}
                  </TableHead>
                  {questionGroups.map((group) => (
                    group.items.map((item) => (
                      <TableHead key={item.id} className="w-32 text-center bg-gray-50/50">
                        <div className="text-muted-foreground text-xs">
                          {item.name}
                        </div>
                      </TableHead>
                    ))
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {subtotalRegions.map((region) => (
                  <TableRow key={region.id}>
                    <TableCell className="bg-background sticky left-0 z-10">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">
                          {region.label || `小計${region.orderIndex || 1}`}
                        </div>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                          小計点
                        </Badge>
                      </div>
                    </TableCell>
                    {questionGroups.map((group) => (
                      group.items.map((item) => (
                        <TableCell key={item.id} className="text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={
                                assignments[region.id]?.has(item.id) || false
                              }
                              onCheckedChange={(checked) =>
                                handleAssignmentChange(
                                  region.id,
                                  item.id,
                                  checked as boolean,
                                )
                              }
                              disabled={saving}
                            />
                          </div>
                        </TableCell>
                      ))
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 計算ロジック説明 */}
      <div className="text-muted-foreground bg-green-50 rounded-lg p-4 text-sm">
        <h4 className="mb-2 font-medium text-green-800">計算ロジック:</h4>
        <ul className="ml-4 space-y-1">
          <li>• <strong>グループ内はOR条件</strong>: 同じグループ内のいずれかの項目に該当する設問の合計</li>
          <li>• <strong>グループ間はAND条件</strong>: 複数グループを選択した場合、すべてのグループに該当する設問の合計</li>
          <li>• 例: 「大問1」OR「大問2」の設問 AND 「知識・理解」の設問 = 該当する設問の合計点</li>
          <li>• <strong>変更は自動で保存されます</strong>（逐次保存）</li>
        </ul>
      </div>
    </div>
  )
}