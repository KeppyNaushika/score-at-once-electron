"use client"

import type { Classroom } from "@prisma/client"
import { Search } from "lucide-react"
import { type ReactNode, useMemo } from "react"

import { Combobox } from "@/components/common/Combobox"
import { Input } from "@/components/ui/input"
import { classroomFilterOptions } from "@/lib/searchKeywords"

interface RosterTableFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedClassroomId: string
  onClassroomChange: (value: string) => void
  classrooms: Classroom[]
  /**
   * 学級の後ろに並べる追加の絞り込みの UI（表示だけ）。
   * ここでは行を絞らない。絞り込みは行を持つ呼び手が済ませてから渡す
   */
  extraFilterControls?: ReactNode
}

/** 検索 + 学級セレクト + 追加の絞り込み UI を描画する共通フィルタ行 */
export function RosterTableFilters({
  searchTerm,
  onSearchChange,
  selectedClassroomId,
  onClassroomChange,
  classrooms,
  extraFilterControls,
}: RosterTableFiltersProps) {
  const classroomOptions = useMemo(
    () => classroomFilterOptions(classrooms),
    [classrooms]
  )

  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
        <Input
          placeholder="名前、カナ、学籍番号で検索"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <Combobox
        options={classroomOptions}
        value={selectedClassroomId}
        onValueChange={onClassroomChange}
        placeholder="学級フィルタ"
        searchPlaceholder="学級を検索"
        emptyText="該当する学級がありません"
        aria-label="学級で絞り込む"
        className="w-40"
      />

      {extraFilterControls}
    </div>
  )
}
