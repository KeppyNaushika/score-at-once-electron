"use client"

import { Search } from "lucide-react"

import type {
  RosterClassroomOption,
  RosterFilter,
} from "@/components/common/roster-table/types"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RosterTableFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedClassroomId: string
  onClassChange: (value: string) => void
  classes: RosterClassroomOption[]
  additionalFilters: RosterFilter[]
}

/** 検索 + 学級セレクト + 追加フィルタ（スロット）を描画する共通フィルタ行 */
export function RosterTableFilters({
  searchTerm,
  onSearchChange,
  selectedClassroomId,
  onClassChange,
  classes,
  additionalFilters,
}: RosterTableFiltersProps) {
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
        <Input
          placeholder="名前、ふりがな、学籍番号で検索"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <Select value={selectedClassroomId} onValueChange={onClassChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべての学級</SelectItem>
          {classes.map((classroom) => (
            <SelectItem key={classroom.id} value={classroom.id}>
              {classroom.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {additionalFilters.map((filter, index) => (
        <div key={index}>{filter.render()}</div>
      ))}
    </div>
  )
}
