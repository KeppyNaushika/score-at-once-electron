"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SubtotalGroupWithItems } from "@/types/electron"
import { BarChart3, Calculator } from "lucide-react"

interface SubtotalData {
  [subtotalGroupId: string]: {
    [subtotalId: string]: {
      questions: string[]
      totalPoints: number
    }
  }
}

interface SubtotalPreviewProps {
  subtotalData: SubtotalData
  subtotalGroups: SubtotalGroupWithItems[]
}

export function SubtotalPreview({
  subtotalData,
  subtotalGroups,
}: SubtotalPreviewProps) {
  // 各グループの合計点数を計算
  const getGroupTotalPoints = (groupId: string) => {
    const groupData = subtotalData[groupId] || {}
    return Object.values(groupData).reduce(
      (sum, subtotal) => sum + subtotal.totalPoints,
      0
    )
  }

  // 全体の合計点数を計算
  const totalPoints = subtotalGroups.reduce(
    (sum, group) => sum + getGroupTotalPoints(group.id),
    0
  )

  return (
    <div className="space-y-6">
      {/* 概要カード */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  総グループ数
                </p>
                <p className="text-2xl font-bold">{subtotalGroups.length}</p>
              </div>
              <BarChart3 className="text-muted-foreground h-8 w-8" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  総項目数
                </p>
                <p className="text-2xl font-bold">
                  {subtotalGroups.reduce(
                    (sum, group) => sum + group.subtotals.length,
                    0
                  )}
                </p>
              </div>
              <Calculator className="text-muted-foreground h-8 w-8" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  総配点
                </p>
                <p className="text-2xl font-bold">{totalPoints}点</p>
              </div>
              <Calculator className="text-muted-foreground h-8 w-8" />
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
          {subtotalGroups.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <Calculator className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>小計点がありません</p>
            </div>
          ) : (
            <div className="space-y-6">
              {subtotalGroups.map((group) => {
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
                        {group.subtotals.map((subtotal) => {
                          const subtotalData = groupData[subtotal.id] || {
                            questions: [],
                            totalPoints: 0,
                          }

                          return (
                            <TableRow key={subtotal.id}>
                              <TableCell className="font-medium">
                                {subtotal.name}
                              </TableCell>
                              <TableCell>
                                {subtotalData.questions.length === 0 ? (
                                  <span className="text-muted-foreground">
                                    未設定
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {subtotalData.questions.map(
                                      (question, index) => (
                                        <Badge
                                          key={index}
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          {question}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {subtotalData.totalPoints}点
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
      <div className="text-muted-foreground bg-muted/50 rounded-lg p-4 text-sm">
        <h4 className="mb-2 font-medium">小計点について:</h4>
        <ul className="ml-4 space-y-1">
          <li>• 各グループ項目に関連付けられた設問の点数を自動で合計します</li>
          <li>
            •
            一つの設問が複数の項目に関連付けられている場合、それぞれで計算されます
          </li>
          <li>• 出力時には、この小計点がExcelの列として表示されます</li>
          <li>• 設問の関連付けを変更すると、小計点も自動で更新されます</li>
        </ul>
      </div>
    </div>
  )
}
