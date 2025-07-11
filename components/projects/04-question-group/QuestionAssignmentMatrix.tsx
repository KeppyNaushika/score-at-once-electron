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
import { Save, RotateCcw, Grid3X3 } from "lucide-react"
import {
  QuestionGroupWithItems,
  LayoutRegionWithDetails,
} from "@/types/electron"

interface QuestionAssignmentMatrixProps {
  questionGroups: QuestionGroupWithItems[]
  layoutRegions: LayoutRegionWithDetails[]
  onUpdateAssignments: (
    questionLayoutRegionId: string,
    questionGroupItemIds: string[],
  ) => Promise<boolean>
}

interface AssignmentState {
  [questionId: string]: Set<string> // questionLayoutRegionId -> Set of questionGroupItemIds
}

export function QuestionAssignmentMatrix({
  questionGroups,
  layoutRegions,
  onUpdateAssignments,
}: QuestionAssignmentMatrixProps) {
  const [assignments, setAssignments] = useState<AssignmentState>({})
  const [originalAssignments, setOriginalAssignments] =
    useState<AssignmentState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 既存の関連付けを読み込み
  useEffect(() => {
    const loadAssignments = async () => {
      setLoading(true)
      const newAssignments: AssignmentState = {}

      for (const region of layoutRegions) {
        try {
          const result =
            (await window.electronAPI.getAssignmentsByQuestionLayoutRegionId(
              region.id,
            )) as any
          if (result && result.success && result.assignments) {
            newAssignments[region.id] = new Set(
              result.assignments.map(
                (assignment: any) => assignment.questionGroupItemId,
              ),
            )
          } else {
            newAssignments[region.id] = new Set()
          }
        } catch (error) {
          newAssignments[region.id] = new Set()
        }
      }

      setAssignments(newAssignments)
      setOriginalAssignments(
        JSON.parse(
          JSON.stringify(
            Object.fromEntries(
              Object.entries(newAssignments).map(([key, value]) => [
                key,
                Array.from(value),
              ]),
            ),
          ),
        ),
      )
      setLoading(false)
    }

    if (layoutRegions.length > 0) {
      loadAssignments()
    }
  }, [layoutRegions])

  // チェックボックスの状態を変更（逐次保存）
  const handleAssignmentChange = async (
    questionId: string,
    itemId: string,
    checked: boolean,
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
      
      console.log(`✅ 関連付け保存成功: 設問${questionId}, 項目${itemId}, チェック:${checked}`)
      
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

  // 変更を保存
  const handleSave = async () => {
    setSaving(true)

    try {
      for (const [questionId, itemIds] of Object.entries(assignments)) {
        await onUpdateAssignments(questionId, Array.from(itemIds))
      }

      // 成功時にoriginalAssignmentsを更新
      setOriginalAssignments(
        JSON.parse(
          JSON.stringify(
            Object.fromEntries(
              Object.entries(assignments).map(([key, value]) => [
                key,
                Array.from(value),
              ]),
            ),
          ),
        ),
      )
    } catch (error) {
      console.error("保存に失敗しました:", error)
    } finally {
      setSaving(false)
    }
  }

  // 変更をリセット
  const handleReset = () => {
    const resetAssignments: AssignmentState = {}
    for (const [questionId, itemIds] of Object.entries(originalAssignments)) {
      resetAssignments[questionId] = new Set(
        Array.isArray(itemIds) ? itemIds : [],
      )
    }
    setAssignments(resetAssignments)
  }

  // 変更があるかチェック
  const hasChanges = () => {
    for (const [questionId, itemIds] of Object.entries(assignments)) {
      const originalIds = Array.isArray(originalAssignments[questionId])
        ? (originalAssignments[questionId] as string[])
        : []
      const currentIds = Array.from(itemIds)

      if (
        currentIds.length !== originalIds.length ||
        !currentIds.every((id) => originalIds.includes(id))
      ) {
        return true
      }
    }
    return false
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

  if (questionGroups.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <Grid3X3 className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>小計点がありません</p>
        <p className="text-sm">まず小計点と項目を作成してください</p>
      </div>
    )
  }

  if (layoutRegions.length === 0) {
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
          <CardTitle className="text-base">関連付けマトリックス</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-background sticky left-0 z-10 w-40">
                    設問
                  </TableHead>
                  {questionGroups.map((group) => (
                    <TableHead 
                      key={group.id} 
                      className="min-w-24 text-center bg-blue-50/50 border-l-2 border-blue-200" 
                      colSpan={group.items.length}
                    >
                      <div className="text-sm font-semibold text-blue-700">
                        {group.name}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="bg-background sticky left-0 z-10 w-40">
                    {/* 空のセル */}
                  </TableHead>
                  {questionGroups.map((group) => (
                    group.items.map((item) => (
                      <TableHead key={item.id} className="min-w-24 text-center bg-gray-50/50">
                        <div className="text-muted-foreground text-xs">
                          {item.name}
                        </div>
                      </TableHead>
                    ))
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {layoutRegions.map((region) => (
                  <TableRow key={region.id}>
                    <TableCell className="bg-background sticky left-0 z-10">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {region.label || `問${region.orderIndex || 1}`}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {region.points || 0}点
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
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 説明 */}
      <div className="text-muted-foreground bg-muted/50 rounded-lg p-4 text-sm">
        <h4 className="mb-2 font-medium">使い方:</h4>
        <ul className="ml-4 space-y-1">
          <li>
            • 各設問に対して、関連付けたいグループ項目にチェックを入れてください
          </li>
          <li>• 一つの設問は複数のグループ項目に関連付けることができます</li>
          <li>• 例: 「問1」を「大問1」と「知識・理解」の両方に関連付け可能</li>
          <li>• <strong>変更は自動で保存されます</strong>（逐次保存）</li>
        </ul>
      </div>
    </div>
  )
}
