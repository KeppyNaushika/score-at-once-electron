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

  // チェックボックスの状態を変更
  const handleAssignmentChange = (
    questionId: string,
    itemId: string,
    checked: boolean,
  ) => {
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
        <p>設問グループがありません</p>
        <p className="text-sm">まず設問グループと項目を作成してください</p>
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
      {/* 保存・リセットボタン */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-5 w-5" />
          <span className="font-medium">設問とグループ項目の関連付け</span>
          {hasChanges() && (
            <Badge variant="outline" className="text-xs">
              未保存の変更があります
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges() || saving}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            リセット
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges() || saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "保存中..." : "保存"}
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
                    <TableHead key={group.id} className="min-w-32 text-center">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">
                          {group.name}
                        </div>
                        <div className="grid gap-1">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="text-muted-foreground text-xs"
                            >
                              {item.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {layoutRegions.map((region) => (
                  <TableRow key={region.id}>
                    <TableCell className="bg-background sticky left-0 z-10">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {region.questionNumber || region.label}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {region.points || 0}点
                        </Badge>
                      </div>
                    </TableCell>
                    {questionGroups.map((group) => (
                      <TableCell key={group.id} className="text-center">
                        <div className="grid gap-2">
                          {group.items.map((item) => (
                            <div key={item.id} className="flex justify-center">
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
                              />
                            </div>
                          ))}
                        </div>
                      </TableCell>
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
          <li>• 変更後は必ず「保存」ボタンをクリックしてください</li>
        </ul>
      </div>
    </div>
  )
}
