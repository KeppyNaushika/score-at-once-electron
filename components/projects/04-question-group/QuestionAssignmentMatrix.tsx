"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RotateCcw, Grid3X3 } from "lucide-react"
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

interface OriginalAssignmentState {
  [questionId: string]: string[] // questionLayoutRegionId -> Array of questionGroupItemIds
}

export function QuestionAssignmentMatrix({
  questionGroups,
  layoutRegions,
  onUpdateAssignments,
}: QuestionAssignmentMatrixProps) {
  const [assignments, setAssignments] = useState<AssignmentState>({})
  const [originalAssignments, setOriginalAssignments] =
    useState<OriginalAssignmentState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ドラッグ選択の状態
  const [isDragging, setIsDragging] = useState(false)
  const [_dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragInitialState, setDragInitialState] = useState<boolean | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)

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
        Object.fromEntries(
          Object.entries(newAssignments).map(([key, value]) => [
            key,
            Array.from(value),
          ]),
        ),
      )
      setLoading(false)
    }

    if (layoutRegions.length > 0) {
      loadAssignments()
    }
  }, [layoutRegions])

  // チェックボックスのドラッグ開始
  const handleMouseDown = (
    event: React.MouseEvent,
    questionId: string,
    itemId: string,
  ) => {
    event.preventDefault()
    
    const currentState = assignments[questionId]?.has(itemId) || false
    const newState = !currentState
    
    // ドラッグ開始の状態を記録
    setDragInitialState(newState)
    setIsDragging(true)
    
    if (tableRef.current) {
      const tableRect = tableRef.current.getBoundingClientRect()
      setDragStart({
        x: event.clientX - tableRect.left,
        y: event.clientY - tableRect.top,
      })
    }

    // 最初のチェックボックスの状態を変更
    handleAssignmentChange(questionId, itemId, newState)
  }

  // ドラッグ中のマウス移動
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || dragInitialState === null) return

    // マウス位置のチェックボックスを取得
    const target = document.elementFromPoint(event.clientX, event.clientY)
    const checkboxCell = target?.closest('[data-checkbox-cell]')
    
    if (checkboxCell) {
      const questionId = checkboxCell.getAttribute('data-question-id')
      const itemId = checkboxCell.getAttribute('data-item-id')
      
      if (questionId && itemId) {
        const currentState = assignments[questionId]?.has(itemId) || false
        
        // ドラッグ初期状態と現在の状態が異なる場合のみ変更
        if (currentState !== dragInitialState) {
          // ドラッグ中は非同期処理を簡素化（UIのみ更新、保存は後で）
          setAssignments((prev) => {
            const newAssignments = { ...prev }
            if (!newAssignments[questionId]) {
              newAssignments[questionId] = new Set()
            }

            if (dragInitialState) {
              newAssignments[questionId].add(itemId)
            } else {
              newAssignments[questionId].delete(itemId)
            }

            return newAssignments
          })
        }
      }
    }
  }

  // ドラッグ終了
  const handleMouseUp = async () => {
    if (isDragging) {
      // ドラッグ終了時に一括保存
      try {
        setSaving(true)
        for (const [questionId, itemIds] of Object.entries(assignments)) {
          await onUpdateAssignments(questionId, Array.from(itemIds))
        }

        // 成功時にoriginalAssignmentsを更新
        setOriginalAssignments(
          Object.fromEntries(
            Object.entries(assignments).map(([key, value]) => [
              key,
              Array.from(value),
            ]),
          ),
        )
        
        console.log(`✅ ドラッグ選択の一括保存完了`)
        
      } catch (error) {
        console.error("❌ ドラッグ選択の保存エラー:", error)
      } finally {
        setSaving(false)
      }
    }
    
    setIsDragging(false)
    setDragStart(null)
    setDragInitialState(null)
  }

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
        <CardContent className="p-0">
          <div 
            className="relative h-96 w-full overflow-x-auto overflow-y-auto"
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent'
            }}
          >
            <Table 
              ref={tableRef}
              className="table-fixed" 
              style={{ 
                minWidth: `${192 + questionGroups.reduce((sum, group) => sum + group.items.length, 0) * 120}px`,
                width: `${192 + questionGroups.reduce((sum, group) => sum + group.items.length, 0) * 120}px`
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-white sticky left-0 z-10 w-48 border-r-2 border-gray-200">
                    設問
                  </TableHead>
                  {questionGroups.map((group) => (
                    <TableHead 
                      key={group.id} 
                      className="text-center bg-blue-50/50 border-l-2 border-blue-200" 
                      colSpan={group.items.length}
                      style={{ width: `${group.items.length * 120}px` }}
                    >
                      <div className="text-sm font-semibold text-blue-700">
                        {group.name}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="bg-white sticky left-0 z-10 w-48 border-r-2 border-gray-200">
                    {/* 空のセル */}
                  </TableHead>
                  {questionGroups.map((group) => (
                    group.items.map((item) => (
                      <TableHead 
                        key={item.id} 
                        className="text-center bg-gray-50/50"
                        style={{ width: '120px', minWidth: '120px' }}
                      >
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
                    <TableCell className="bg-white sticky left-0 z-10 border-r-2 border-gray-200">
                      <div className="flex items-center gap-2">
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
                        <TableCell 
                          key={item.id} 
                          className="text-center"
                          style={{ width: '120px', minWidth: '120px' }}
                          data-checkbox-cell
                          data-question-id={region.id}
                          data-item-id={item.id}
                        >
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
                              onMouseDown={(e) => handleMouseDown(e, region.id, item.id)}
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
          <li>• <strong>ドラッグでまとめてチェック/チェック解除できます</strong>（採点画面と同様）</li>
          <li>• <strong>変更は自動で保存されます</strong>（逐次保存）</li>
        </ul>
      </div>
    </div>
  )
}
