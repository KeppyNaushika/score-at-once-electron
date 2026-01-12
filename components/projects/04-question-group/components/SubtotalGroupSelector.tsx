"use client"

import { Calculator, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect,useState } from "react"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import type { SubtotalGroup } from "@/components/subtotal-groups/types/subtotalGroupTypes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

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

  useEffect(() => {
    if (showSelector) {
      const fetchAvailableGroups = async () => {
        setLoading(true)
        try {
          const result =
            await window.electronAPI.getAvailableSubtotalGroupsForProject(
              projectId
            )
          if (result.success && result.subtotalGroups) {
            setAvailableGroups(result.subtotalGroups)
          }
        } catch (error) {
          console.error("Error fetching available subtotal groups:", error)
        } finally {
          setLoading(false)
        }
      }
      fetchAvailableGroups()
    }
  }, [showSelector, projectId, setAvailableGroups])

  // 小計点グループをプロジェクトに追加
  const handleAddGroup = async (groupId: string) => {
    try {
      const result = await window.electronAPI.addSubtotalGroupToProject(
        projectId,
        groupId
      )
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
    if (
      !confirm(
        "この小計点グループをプロジェクトから削除しますか？\\n\\n注意：関連する採点データにも影響する可能性があります。"
      )
    ) {
      return
    }

    try {
      const result = await window.electronAPI.removeSubtotalGroupFromProject(
        projectId,
        groupId
      )
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
  const filteredGroups = availableGroups.filter((group) =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            小計点グループ
          </CardTitle>
          <Button onClick={() => setShowSelector(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            グループを追加
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activeSubtotalGroups.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Calculator className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>有効化された小計点グループがありません</p>
            <p className="mt-2 text-sm">
              「グループを追加」ボタンで既存のグループを有効化するか、新しいグループを作成できます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeSubtotalGroups.map((group) => {
              return (
                <div
                  key={group.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h4 className="font-medium">{group.name}</h4>
                      <Badge variant="secondary">
                        {group.subtotals.length}項目
                      </Badge>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      項目: {group.subtotals.map((s) => s.name).join(", ")}
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
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>小計点グループを選択</DialogTitle>
          </DialogHeader>

          {/* 新規小計点グループ作成ボタン */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-800">
                新しいグループを作成
              </span>
              <Link href="/subtotal-groups">
                <Button
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  新規作成
                </Button>
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            {/* 検索 */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
              <div className="text-muted-foreground py-8 text-center">
                <Calculator className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>
                  {searchTerm
                    ? "検索結果が見つかりません"
                    : "利用可能なグループがありません"}
                </p>
                {!searchTerm && (
                  <p className="mt-2 text-sm">
                    上部の「新規作成」ボタンから新しいグループを作成できます
                  </p>
                )}
              </div>
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto">
                {filteredGroups.map((group) => {
                  return (
                    <div
                      key={group.id}
                      className="hover:bg-accent/50 flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h4 className="font-medium">{group.name}</h4>
                          <Badge variant="secondary">
                            {group.subtotals.length}項目
                          </Badge>
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">
                          項目:{" "}
                          {group.subtotals
                            .slice(0, 3)
                            .map((s) => s.name)
                            .join(", ")}
                          {group.subtotals.length > 3 &&
                            ` 他${group.subtotals.length - 3}項目`}
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
