"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useEffectEvent } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { SubtotalGroupSelection } from "@/electron-src/lib/export/individual-report/types"
import { queryKeys } from "@/lib/queryKeys"

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
  const { data: groups, isPending } = useQuery({
    queryKey: queryKeys.subtotalGroupsForReport.detail(examId),
    queryFn: () => window.electronAPI.export.getSubtotalGroupsForReport(examId),
  })

  // 保存済みの選択を、実在するグループだけに整える。取得直後に一度だけ走る初期化であり、
  // 以後の選択変更で再実行してはならない（全解除を打ち消してしまう）ため Effect Event にする
  const reconcileSelection = useEffectEvent((availableGroupIds: string[]) => {
    const restoredGroupIds = selection.selectedGroupIds
    if (restoredGroupIds.length === 0) {
      // 保存された選択が無い（初回）ときは全グループを選択
      onChange({ enabled: true, selectedGroupIds: availableGroupIds })
      return
    }
    const validGroupIds = restoredGroupIds.filter((groupId) =>
      availableGroupIds.includes(groupId)
    )
    if (validGroupIds.length === 0) {
      // 保存された選択がすべて消えていたら全グループへ戻す
      onChange({ enabled: true, selectedGroupIds: availableGroupIds })
      return
    }
    if (validGroupIds.length !== restoredGroupIds.length) {
      // 消えたグループが混ざっていた分だけ取り除く
      onChange({ enabled: true, selectedGroupIds: validGroupIds })
    }
  })

  // 取得できたグループへ、保存済みの選択を合わせる
  useEffect(() => {
    if (!groups || groups.length === 0) return
    reconcileSelection(groups.map((subtotalGroup) => subtotalGroup.id))
  }, [groups])

  // グループがない場合は表示しない
  if (isPending || !groups || groups.length === 0) {
    return null
  }

  const handleGroupToggle = (groupId: string, checked: boolean) => {
    if (checked) {
      onChange({
        enabled: true,
        selectedGroupIds: [...selection.selectedGroupIds, groupId],
      })
    } else {
      const remainingGroupIds = selection.selectedGroupIds.filter(
        (selectedGroupId) => selectedGroupId !== groupId
      )
      onChange({
        enabled: remainingGroupIds.length > 0,
        selectedGroupIds: remainingGroupIds,
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
        <Label className="text-xs text-muted-foreground">小計点グループ</Label>
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
                  ? "border-primary bg-primary/5"
                  : "bg-background hover:bg-muted/50"
              }`}
              onClick={() => handleGroupToggle(group.id, !isSelected)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(value) =>
                  handleGroupToggle(group.id, value === true)
                }
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
