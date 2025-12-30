"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"
import type {
  ClassGroup,
  StudentStatus,
} from "@/components/projects/05-students/components/sortable-student-table/types/student-table-types"

interface TableFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedClassId: string
  onClassChange: (value: string) => void
  statusFilter: StudentStatus | "all"
  onStatusChange: (value: StudentStatus | "all") => void
  classes: ClassGroup[]
}

export function TableFilters({
  searchTerm,
  onSearchChange,
  selectedClassId,
  onClassChange,
  statusFilter,
  onStatusChange,
  classes,
}: TableFiltersProps) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="search">検索</Label>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            id="search"
            placeholder="名前、ふりがな、学籍番号で検索"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>学級</Label>
        <Select value={selectedClassId} onValueChange={onClassChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての学級</SelectItem>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>受験状態</Label>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="participating">受験</SelectItem>
            <SelectItem value="expected">見込</SelectItem>
            <SelectItem value="absent">欠席</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
