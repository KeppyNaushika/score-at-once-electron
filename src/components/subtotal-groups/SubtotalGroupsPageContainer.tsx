"use client"

import { Plus, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { SubtotalGroupCard } from "@/components/subtotal-groups/components/SubtotalGroupCard"
import { SubtotalGroupModal } from "@/components/subtotal-groups/components/SubtotalGroupModal"
import type { SubtotalGroup } from "@/components/subtotal-groups/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SubtotalGroupsPageContainer() {
  const [subtotalGroups, setSubtotalGroups] = useState<SubtotalGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<SubtotalGroup | null>(null)
  const [ipcError, setIpcError] = useState<string | null>(null)

  // データの取得
  const fetchSubtotalGroups = useCallback(async () => {
    setLoading(true)
    try {
      // IPCハンドラーが利用可能かチェック
      if (typeof window.electronAPI?.getSubtotalGroups !== "function") {
        setIpcError(
          "IPCハンドラーが利用できません。Electronアプリを再起動してください。"
        )
        setSubtotalGroups([])
        return
      }

      setIpcError(null)

      const result = await window.electronAPI.getSubtotalGroups()
      if (result.success && result.subtotalGroups) {
        setSubtotalGroups(result.subtotalGroups)
      } else {
        console.error("Failed to fetch subtotal groups:", result.error)
      }
    } catch (error) {
      console.error("Error fetching subtotal groups:", error)
      setSubtotalGroups([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubtotalGroups()
  }, [fetchSubtotalGroups])

  // 新規作成
  const handleCreate = useCallback(() => {
    setEditingGroup(null)
    setShowModal(true)
  }, [])

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // モーダルが開いている時は無視
      if (showModal) return

      if ((event.ctrlKey || event.metaKey) && event.key === "n") {
        event.preventDefault()
        handleCreate()
      }

      if (event.key === "F5" || (event.ctrlKey && event.key === "r")) {
        event.preventDefault()
        fetchSubtotalGroups()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [fetchSubtotalGroups, handleCreate, showModal])

  // 検索フィルタリング（グループ名と小計項目名で検索）
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return subtotalGroups

    const searchLower = searchTerm.toLowerCase()
    return subtotalGroups.filter((group) => {
      // グループ名で検索
      const matchesGroupName = group.name.toLowerCase().includes(searchLower)

      // 小計項目名で検索
      const matchesSubtotalName = group.subtotals.some((subtotal) =>
        subtotal.name.toLowerCase().includes(searchLower)
      )

      return matchesGroupName || matchesSubtotalName
    })
  }, [searchTerm, subtotalGroups])

  // 編集
  const handleEdit = (group: SubtotalGroup) => {
    setEditingGroup(group)
    setShowModal(true)
  }

  // 削除
  const handleDelete = async (groupId: string) => {
    const group = subtotalGroups.find(
      (subtotalGroup) => subtotalGroup.id === groupId
    )
    const groupName = group?.name || "不明なグループ"

    if (
      !confirm(
        `小計点グループ「${groupName}」を削除しますか？\n\n注意：設問との関連付けがある場合は削除できません。\n削除前に04-question-groupページで関連付けを解除してください。`
      )
    )
      return

    try {
      const result = await window.electronAPI.deleteSubtotalGroup(groupId)
      if (result.success) {
        await fetchSubtotalGroups() // リストを再読み込み
        alert(`小計点グループ「${groupName}」を削除しました。`)
      } else {
        // 詳細なエラーメッセージを改行付きで表示
        alert(result.error)
      }
    } catch (error) {
      console.error("Error deleting subtotal group:", error)
      alert("削除中にエラーが発生しました。")
    }
  }

  // モーダルの保存処理
  const handleSave = async () => {
    await fetchSubtotalGroups() // リストを再読み込み
    setShowModal(false)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      {/* Action Bar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleCreate}
            variant="outline"
            className="rounded-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="グループ名、小計項目名で検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-56 rounded-lg pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            {filteredGroups.length}件
          </span>
        </div>
      </div>

      {/* エラーメッセージ */}
      {ipcError && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="mb-2 font-medium text-red-800">接続エラー</div>
          <div className="text-sm text-red-700">{ipcError}</div>
          <Button
            onClick={fetchSubtotalGroups}
            className="mt-3"
            variant="outline"
            size="sm"
          >
            再試行
          </Button>
        </div>
      )}

      {/* グループ一覧 */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!ipcError && filteredGroups.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <p className="mb-2 text-muted-foreground">
              {searchTerm
                ? "検索結果が見つかりません"
                : "小計点グループがありません"}
            </p>
            {!searchTerm && (
              <Button variant="outline" onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                最初のグループを作成
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredGroups.map((group) => (
              <SubtotalGroupCard
                key={group.id}
                group={group}
                onEdit={() => handleEdit(group)}
                onDelete={() => handleDelete(group.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* モーダル */}
      {showModal && (
        <SubtotalGroupModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          editingGroup={editingGroup}
        />
      )}
    </div>
  )
}
