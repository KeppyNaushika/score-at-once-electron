"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calculator, BarChart3 } from "lucide-react"
import { QuestionGroupWithItems } from "../../../types/electron"

interface SubtotalData {
  [questionGroupId: string]: {
    [questionGroupItemId: string]: {
      questions: string[]
      totalPoints: number
    }
  }
}

interface SubtotalPreviewProps {
  subtotalData: SubtotalData
  questionGroups: QuestionGroupWithItems[]
}

export function SubtotalPreview({
  subtotalData,
  questionGroups,
}: SubtotalPreviewProps) {
  // 各グループの合計点数を計算
  const getGroupTotalPoints = (groupId: string) => {
    const groupData = subtotalData[groupId] || {}
    return Object.values(groupData).reduce((sum, item) => sum + item.totalPoints, 0)
  }

  // 全体の合計点数を計算
  const totalPoints = questionGroups.reduce((sum, group) => sum + getGroupTotalPoints(group.id), 0)

  return (
    <div className="space-y-6">
      {/* 概要カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">総グループ数</p>
                <p className="text-2xl font-bold">{questionGroups.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">総項目数</p>
                <p className="text-2xl font-bold">
                  {questionGroups.reduce((sum, group) => sum + group.items.length, 0)}
                </p>
              </div>
              <Calculator className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">総配点</p>
                <p className="text-2xl font-bold">{totalPoints}点</p>
              </div>
              <Calculator className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 詳細テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            小計点詳細
          </CardTitle>
        </CardHeader>
        <CardContent>
          {questionGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>設問グループがありません</p>
            </div>
          ) : (
            <div className="space-y-6">
              {questionGroups.map(group => {
                const groupData = subtotalData[group.id] || {}
                const groupTotal = getGroupTotalPoints(group.id)
                
                return (
                  <div key={group.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold">{group.name}</h4>
                      <Badge variant="outline" className="text-sm">
                        合計: {groupTotal}点
                      </Badge>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>項目名</TableHead>
                          <TableHead>関連設問</TableHead>
                          <TableHead className="text-right">配点</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map(item => {
                          const itemData = groupData[item.id] || { questions: [], totalPoints: 0 }
                          
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>
                                {itemData.questions.length === 0 ? (
                                  <span className="text-muted-foreground">未設定</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {itemData.questions.map((question, index) => (
                                      <Badge key={index} variant="secondary" className="text-xs">
                                        {question}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {itemData.totalPoints}点
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 説明 */}
      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">小計点について:</h4>
        <ul className="space-y-1 ml-4">
          <li>• 各グループ項目に関連付けられた設問の点数を自動で合計します</li>
          <li>• 一つの設問が複数の項目に関連付けられている場合、それぞれで計算されます</li>
          <li>• 出力時には、この小計点がExcelの列として表示されます</li>
          <li>• 設問の関連付けを変更すると、小計点も自動で更新されます</li>
        </ul>
      </div>
    </div>
  )
}