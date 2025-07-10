"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

import type { ClassGroup, StudentStatus } from "../utils/studentTypes"

interface StudentFiltersProps {
  classes: ClassGroup[]
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedClassId: string
  onClassChange: (value: string) => void
  statusFilter: StudentStatus | "all"
  onStatusChange: (value: StudentStatus | "all") => void
}

export const StudentFilters = ({
  classes,
  searchTerm,
  onSearchChange,
  selectedClassId,
  onClassChange,
  statusFilter,
  onStatusChange,
}: StudentFiltersProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>フィルタ・検索</CardTitle>
        <CardDescription>生徒を絞り込んで表示します</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="search">生徒検索</Label>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="search"
              placeholder="生徒ID、氏名、ふりがなで検索"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="class-filter">学級フィルタ</Label>
            <Select value={selectedClassId} onValueChange={onClassChange}>
              <SelectTrigger>
                <SelectValue placeholder="学級を選択" />
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
            <Label htmlFor="status-filter">受験状況フィルタ</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                onStatusChange(value as StudentStatus | "all")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="受験状況を選択" />
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
      </CardContent>
    </Card>
  )
}
