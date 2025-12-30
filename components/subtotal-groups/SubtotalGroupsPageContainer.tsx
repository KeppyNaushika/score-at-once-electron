"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import { SubtotalGroupCard } from "@/components/subtotal-groups/components/SubtotalGroupCard"
import { SubtotalGroupModal } from "@/components/subtotal-groups/components/SubtotalGroupModal"
import type { SubtotalGroup } from "@/components/subtotal-groups/types/subtotal-group-types"

export function SubtotalGroupsPageContainer() {
  const [subtotalGroups, setSubtotalGroups] = useState<SubtotalGroup[]>([])
  const [filteredGroups, setFilteredGroups] = useState<SubtotalGroup[]>([])
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
        setFilteredGroups([])
        return
      }

      setIpcError(null)

      const result = await window.electronAPI.getSubtotalGroups()
      if (result.success && result.subtotalGroups) {
        setSubtotalGroups(result.subtotalGroups)
        setFilteredGroups(result.subtotalGroups)
      } else {
        console.error("Failed to fetch subtotal groups:", result.error)
      }
    } catch (error) {
      console.error("Error fetching subtotal groups:", error)
      setSubtotalGroups([])
      setFilteredGroups([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubtotalGroups()
  }, [fetchSubtotalGroups])

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
  }, [fetchSubtotalGroups, showModal])

  // 検索フィルタリング（グループ名と小計項目名で検索）
  useEffect(() => {
    if (!searchTerm) {
      setFilteredGroups(subtotalGroups)
    } else {
      const searchLower = searchTerm.toLowerCase()
      const filtered = subtotalGroups.filter((group) => {
        // グループ名で検索
        const matchesGroupName = group.name.toLowerCase().includes(searchLower)

        // 小計項目名で検索
        const matchesSubtotalName = group.subtotals.some((subtotal) =>
          subtotal.name.toLowerCase().includes(searchLower)
        )

        return matchesGroupName || matchesSubtotalName
      })
      setFilteredGroups(filtered)
    }
  }, [searchTerm, subtotalGroups])

  // 新規作成
  const handleCreate = () => {
    setEditingGroup(null)
    setShowModal(true)
  }

  // 編集
  const handleEdit = (group: SubtotalGroup) => {
    setEditingGroup(group)
    setShowModal(true)
  }

  // 削除
  const handleDelete = async (groupId: string) => {
    const group = subtotalGroups.find((g) => g.id === groupId)
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
    <div className="flex h-full flex-col p-6">
      {/* ヘッダーアクション */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 検索 */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="グループ名、小計項目名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-80 pl-10"
            />
          </div>
          <div className="text-muted-foreground text-sm">
            {filteredGroups.length}件表示
          </div>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新規作成
        </Button>
      </div>

      {/* エラーメッセージ */}
      {ipcError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
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
      <div className="flex-1 overflow-auto">
        {!ipcError && filteredGroups.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-muted-foreground mb-4">
                {searchTerm
                  ? "検索結果が見つかりません"
                  : "小計点グループがありません"}
              </div>
              {!searchTerm && (
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  最初のグループを作成
                </Button>
              )}
            </div>
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
