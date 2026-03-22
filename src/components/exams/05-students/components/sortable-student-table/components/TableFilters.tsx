"use client"

import { Search } from "lucide-react"

import type {
  ClassGroup,
  StudentStatus,
} from "@/components/exams/05-students/components/sortable-student-table/types/studentTableTypes"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

      <Select value={selectedClassId} onValueChange={onClassChange}>
        <SelectTrigger className="w-40">
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

      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべての受験状態</SelectItem>
          <SelectItem value="participating">受験</SelectItem>
          <SelectItem value="expected">見込</SelectItem>
          <SelectItem value="absent">欠席</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
