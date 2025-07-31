"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Calculator, Plus, Search, Trash2 } from "lucide-react"
import type { SubtotalGroup } from "@/components/subtotal-groups/types/subtotal-group-types"
import LoadingSpinner from "@/components/common/LoadingSpinner"

interface SubtotalGroupSelectorProps {
  projectId: string
  activeSubtotalGroups: SubtotalGroup[]
  onRefresh: () => void
}

export function SubtotalGroupSelector({
  projectId,
  activeSubtotalGroups,
  onRefresh,
}: SubtotalGroupSelectorProps) {
  const [availableGroups, setAvailableGroups] = useState<SubtotalGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // 利用可能な小計点グループを取得
  const fetchAvailableGroups = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.getAvailableSubtotalGroupsForProject(projectId)
      if (result.success && result.subtotalGroups) {
        setAvailableGroups(result.subtotalGroups)
      }
    } catch (error) {
      console.error("Error fetching available subtotal groups:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showSelector) {
      fetchAvailableGroups()
    }
  }, [showSelector, projectId])

  // 小計点グループをプロジェクトに追加
  const handleAddGroup = async (groupId: string) => {
    try {
      const result = await window.electronAPI.addSubtotalGroupToProject(projectId, groupId)
      if (result.success) {
        setShowSelector(false)
        onRefresh()
      } else {
        alert("小計点グループの追加に失敗しました: " + result.error)
      }
    } catch (error) {
      console.error("Error adding subtotal group to project:", error)
      alert("小計点グループの追加中にエラーが発生しました")
    }
  }

  // 小計点グループをプロジェクトから削除
  const handleRemoveGroup = async (groupId: string) => {
    if (!confirm("この小計点グループをプロジェクトから削除しますか？\\n\\n注意：関連する採点データにも影響する可能性があります。")) {
      return
    }

    try {
      const result = await window.electronAPI.removeSubtotalGroupFromProject(projectId, groupId)
      if (result.success) {
        onRefresh()
      } else {
        alert("小計点グループの削除に失敗しました: " + result.error)
      }
    } catch (error) {
      console.error("Error removing subtotal group from project:", error)
      alert("小計点グループの削除中にエラーが発生しました")
    }
  }

  // 検索フィルタリング
  const filteredGroups = availableGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            共有小計点グループ
          </CardTitle>
          <Button onClick={() => setShowSelector(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            グループを追加
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activeSubtotalGroups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>有効化された小計点グループがありません</p>
            <p className="text-sm mt-2">「グループを追加」ボタンで既存のグループを有効化できます</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeSubtotalGroups.map((group) => {
              return (
                <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{group.name}</h4>
                      <Badge variant="secondary">{group.subtotals.length}項目</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      項目: {group.subtotals.map(s => s.name).join(", ")}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveGroup(group.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* 小計点グループ選択モーダル */}
      <Dialog open={showSelector} onOpenChange={setShowSelector}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>小計点グループを選択</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 検索 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="グループ名、説明で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* グループ一覧 */}
            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{searchTerm ? "検索結果が見つかりません" : "利用可能なグループがありません"}</p>
                {!searchTerm && (
                  <p className="text-sm mt-2">
                    <a href="/subtotal-groups" className="text-blue-600 hover:underline">
                      小計点管理ページ
                    </a>
                    で新しいグループを作成できます
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredGroups.map((group) => {
                  return (
                    <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{group.name}</h4>
                          <Badge variant="secondary">{group.subtotals.length}項目</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          項目: {group.subtotals.slice(0, 3).map(s => s.name).join(", ")}
                          {group.subtotals.length > 3 && ` 他${group.subtotals.length - 3}項目`}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleAddGroup(group.id)}
                        size="sm"
                      >
                        追加
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSelector(false)}>
              キャンセル
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}