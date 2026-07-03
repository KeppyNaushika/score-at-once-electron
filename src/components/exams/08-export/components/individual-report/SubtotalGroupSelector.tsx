"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type {
  SubtotalGroupInfo,
  SubtotalGroupSelection,
} from "@/electron-src/lib/export/individual-report/types"

interface SubtotalGroupSelectorProps {
  examId: string
  selection: SubtotalGroupSelection
  onChange: (selection: SubtotalGroupSelection) => void
}

export function SubtotalGroupSelector({
  examId,
  selection,
  onChange,
}: SubtotalGroupSelectorProps) {
  const [groups, setGroups] = useState<SubtotalGroupInfo[]>([])
  const [loading, setLoading] = useState(true)

  // グループ一覧を取得（ページ読み込み時のみ）
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true)
        const result =
          await window.electronAPI.export.getSubtotalGroupsForReport(examId)
        if (result.success && result.subtotalGroups) {
          setGroups(result.subtotalGroups)
          const fetchedGroupIds = result.subtotalGroups.map(
            (subtotalGroup) => subtotalGroup.id
          )

          // localStorageから復元された選択がある場合、有効なIDのみにフィルタ
          // 復元された選択がない（初回）または無効な場合のみ、全グループを選択
          if (selection.selectedGroupIds.length > 0) {
            // 有効なグループIDのみにフィルタ
            const validIds = selection.selectedGroupIds.filter((id) =>
              fetchedGroupIds.includes(id)
            )
            if (validIds.length > 0) {
              // 有効な選択があればそのまま使用（localStorageの値を維持）
              if (validIds.length !== selection.selectedGroupIds.length) {
                // 無効なIDがあった場合のみ更新
                onChange({
                  enabled: true,
                  selectedGroupIds: validIds,
                })
              }
            } else {
              // 有効な選択がない場合は全グループを選択
              onChange({
                enabled: true,
                selectedGroupIds: fetchedGroupIds,
              })
            }
          } else if (result.subtotalGroups.length > 0) {
            // 初回（選択がない）の場合は全グループを選択
            onChange({
              enabled: true,
              selectedGroupIds: fetchedGroupIds,
            })
          }
        }
      } catch (error) {
        console.error("Failed to fetch subtotal groups:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId])

  // グループがない場合は表示しない
  if (loading || groups.length === 0) {
    return null
  }

  const handleGroupToggle = (groupId: string, checked: boolean) => {
    if (checked) {
      onChange({
        enabled: true,
        selectedGroupIds: [...selection.selectedGroupIds, groupId],
      })
    } else {
      const newIds = selection.selectedGroupIds.filter((id) => id !== groupId)
      onChange({
        enabled: newIds.length > 0,
        selectedGroupIds: newIds,
      })
    }
  }

  const handleSelectAll = () => {
    onChange({
      enabled: true,
      selectedGroupIds: groups.map((subtotalGroup) => subtotalGroup.id),
    })
  }

  const handleDeselectAll = () => {
    onChange({
      enabled: false,
      selectedGroupIds: [],
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs">小計点グループ</Label>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-xs"
            onClick={handleSelectAll}
          >
            全選択
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-xs"
            onClick={handleDeselectAll}
          >
            全解除
          </Button>
        </div>
      </div>

      {/* グループリスト */}
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => {
          const isSelected = selection.selectedGroupIds.includes(group.id)
          return (
            <div
              key={group.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors ${
                isSelected
                  ? "bg-primary/5 border-primary"
                  : "bg-background hover:bg-muted/50"
              }`}
              onClick={() => handleGroupToggle(group.id, !isSelected)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(v) => handleGroupToggle(group.id, v === true)}
                onClick={(e) => e.stopPropagation()}
              />
              <Label className="cursor-pointer text-xs">{group.name}</Label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
