"use client"

import { Student } from "@/app/projects/[projectId]/08-export/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Check,
  CheckSquare,
  Search,
  Square,
  UserCheck,
  Users,
  UserX,
} from "lucide-react"

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
      [...selectedStudents].filter((id) => !filteredIds.has(id))
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
    <div className="flex h-full flex-col">
      {/* タイトル */}
      <div className="mb-2 flex items-center gap-2">
        <Users className="h-5 w-5" />
        <h3 className="text-lg font-semibold">生徒選択</h3>
      </div>

      {/* 1行目: 検索のみ */}
      <div className="mb-2 flex items-center">
        {/* 検索 */}
        <div className="relative w-full">
          <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="名前または学籍番号で検索"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* 2行目: 学級 | 状態 | 選択 */}
      <div className="mb-2 flex items-center justify-between">
        {/* 学級フィルタ */}
        <div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs whitespace-nowrap"
              >
                学級({selectedClasses.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="space-y-1">
                <h4 className="mb-2 text-sm font-medium">学級を選択</h4>
                {availableClasses.map((cls) => (
                  <Button
                    key={cls.id}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-between px-2"
                    onClick={() => toggleClassFilter(cls.id)}
                  >
                    <span className="text-sm">{cls.name}</span>
                    {selectedClasses.includes(cls.id) && (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* 状態フィルタ（アイコン付き）*/}
        <div className="flex gap-1">
          {[
            { value: "participating", label: "受験", icon: UserCheck },
            { value: "expected", label: "見込", icon: Users },
            { value: "absent", label: "欠席", icon: UserX },
          ].map((status) => {
            const Icon = status.icon
            return (
              <Button
                key={status.value}
                variant={
                  selectedStatuses.includes(status.value)
                    ? "default"
                    : "outline"
                }
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => toggleStatusFilter(status.value)}
              >
                <Icon className="mr-1 h-3 w-3" />
                {status.label}
              </Button>
            )
          })}
        </div>

        {/* 一括選択 */}
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={selectAllFiltered}
          >
            <CheckSquare className="mr-1 h-3 w-3" />
            全選択
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={deselectAllFiltered}
          >
            <Square className="mr-1 h-3 w-3" />
            全解除
          </Button>
        </div>
      </div>

      {/* 3行目: 生徒リスト - 残りの高さを使用 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
          <span>生徒一覧</span>
          <span>
            {selectedStudents.size}人選択中 / {students.length}人表示中
          </span>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto rounded-md border p-1.5">
          {students.map((student) => (
            <div
              key={student.id}
              className="hover:bg-muted flex items-center space-x-2 rounded p-1"
            >
              <Checkbox
                id={`student-${student.id}`}
                checked={selectedStudents.has(student.id)}
                onCheckedChange={() => toggleStudentSelection(student.id)}
                className="h-4 w-4"
              />
              <Label
                htmlFor={`student-${student.id}`}
                className="flex-1 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs">
                    {student.lastName} {student.firstName}
                  </span>
                  <div className="flex items-center gap-1">
                    {student.customOrder !== null &&
                      student.customOrder !== undefined && (
                        <span className="text-muted-foreground bg-muted rounded px-1 text-xs">
                          {student.customOrder}
                        </span>
                      )}
                    <span className="text-muted-foreground text-xs">
                      {student.studentId}
                    </span>
                  </div>
                </div>
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
