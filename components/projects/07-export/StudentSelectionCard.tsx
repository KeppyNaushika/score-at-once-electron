"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Search, Users, CheckSquare, Square } from "lucide-react"
import { Student } from "../../../app/projects/[projectId]/07-export/types"

interface StudentSelectionCardProps {
  students: Student[]
  availableClasses: Array<{ id: string; name: string }>
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedClasses: string[]
  setSelectedClasses: (classes: string[]) => void
  selectedStatuses: string[]
  setSelectedStatuses: (statuses: string[]) => void
  selectedStudents: Set<string>
  setSelectedStudents: (students: Set<string>) => void
}

export function StudentSelectionCard({
  students,
  availableClasses,
  searchTerm,
  setSearchTerm,
  selectedClasses,
  setSelectedClasses,
  selectedStatuses,
  setSelectedStatuses,
  selectedStudents,
  setSelectedStudents,
}: StudentSelectionCardProps) {
  const toggleStudentSelection = (studentId: string) => {
    const newSelection = new Set(selectedStudents)
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId)
    } else {
      newSelection.add(studentId)
    }
    setSelectedStudents(newSelection)
  }

  const selectAllFiltered = () => {
    const allFilteredIds = students.map((s) => s.id)
    setSelectedStudents(new Set([...selectedStudents, ...allFilteredIds]))
  }

  const deselectAllFiltered = () => {
    const filteredIds = new Set(students.map((s) => s.id))
    const newSelection = new Set(
      [...selectedStudents].filter((id) => !filteredIds.has(id)),
    )
    setSelectedStudents(newSelection)
  }

  const toggleClassFilter = (classId: string) => {
    if (selectedClasses.includes(classId)) {
      setSelectedClasses(selectedClasses.filter((id) => id !== classId))
    } else {
      setSelectedClasses([...selectedClasses, classId])
    }
  }

  const toggleStatusFilter = (status: string) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter((s) => s !== status))
    } else {
      setSelectedStatuses([...selectedStatuses, status])
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          生徒選択
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 検索 */}
        <div className="space-y-2">
          <Label htmlFor="search">検索</Label>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
            <Input
              id="search"
              placeholder="名前または学籍番号で検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* フィルタ */}
        <div className="flex gap-2">
          {/* 学級フィルタ */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                学級 ({selectedClasses.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                <h4 className="font-medium">学級を選択</h4>
                {availableClasses.map((cls) => (
                  <div key={cls.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`class-${cls.id}`}
                      checked={selectedClasses.includes(cls.id)}
                      onCheckedChange={() => toggleClassFilter(cls.id)}
                    />
                    <Label htmlFor={`class-${cls.id}`} className="text-sm">
                      {cls.name}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* 状態フィルタ */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                状態 ({selectedStatuses.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                <h4 className="font-medium">状態を選択</h4>
                {[
                  { value: "participating", label: "参加中" },
                  { value: "expected", label: "見込" },
                  { value: "absent", label: "欠席" },
                ].map((status) => (
                  <div
                    key={status.value}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`status-${status.value}`}
                      checked={selectedStatuses.includes(status.value)}
                      onCheckedChange={() => toggleStatusFilter(status.value)}
                    />
                    <Label
                      htmlFor={`status-${status.value}`}
                      className="text-sm"
                    >
                      {status.label}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* 一括選択 */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAllFiltered}>
            <CheckSquare className="mr-1 h-4 w-4" />
            表示中を全選択
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAllFiltered}>
            <Square className="mr-1 h-4 w-4" />
            表示中を全解除
          </Button>
        </div>

        {/* 生徒リスト */}
        <div className="max-h-96 space-y-2 overflow-y-auto rounded-md border p-2">
          {students.map((student) => (
            <div
              key={student.id}
              className="hover:bg-muted flex items-center space-x-2 rounded p-2"
            >
              <Checkbox
                id={`student-${student.id}`}
                checked={selectedStudents.has(student.id)}
                onCheckedChange={() => toggleStudentSelection(student.id)}
              />
              <Label
                htmlFor={`student-${student.id}`}
                className="flex-1 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span>
                    {student.lastName} {student.firstName}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {student.studentId}
                  </span>
                </div>
              </Label>
            </div>
          ))}
        </div>

        <div className="text-muted-foreground text-sm">
          {selectedStudents.size}人選択中 / {students.length}人表示中
        </div>
      </CardContent>
    </Card>
  )
}
