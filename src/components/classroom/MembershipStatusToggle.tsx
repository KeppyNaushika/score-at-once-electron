"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  MEMBERSHIP_STATUS_FILTER_OPTIONS,
  type MembershipStatusFilter,
} from "@/lib/membership"

interface MembershipStatusToggleProps {
  statusFilter: MembershipStatusFilter
  onStatusFilterChange: (statusFilter: MembershipStatusFilter) => void
}

/** 学級の所属を在籍中・終了済みで絞り込むトグル */
export function MembershipStatusToggle({
  statusFilter,
  onStatusFilterChange,
}: MembershipStatusToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={statusFilter}
      aria-label="所属状況で絞り込む"
      onValueChange={(value) => {
        // 選択中をもう一度押すと空文字が来る。選択は外さない
        const nextFilterOption = MEMBERSHIP_STATUS_FILTER_OPTIONS.find(
          (candidateOption) => candidateOption.statusFilter === value
        )
        if (nextFilterOption)
          onStatusFilterChange(nextFilterOption.statusFilter)
      }}
    >
      {MEMBERSHIP_STATUS_FILTER_OPTIONS.map((filterOption) => (
        <ToggleGroupItem
          key={filterOption.statusFilter}
          value={filterOption.statusFilter}
          className="px-3"
        >
          {filterOption.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
