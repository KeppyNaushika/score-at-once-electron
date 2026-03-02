"use client"

import { Search } from "lucide-react"

import type {
  AvailableClass,
  AvailableStudent,
} from "@/components/exams/05-students/components/exam-student-add-modal/types/examStudentAddTypes"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TabsContent } from "@/components/ui/tabs"

interface IndividualSelectionTabProps {
  availableClasses: AvailableClass[]
  searchTerm: string
  filterClassId: string
  loading: boolean
  filteredStudents: AvailableStudent[]
  onSearchChange: (value: string) => void
  onFilterClassChange: (value: string) => void
  onStudentSelection: (studentId: string, isSelected: boolean) => void
}

export function IndividualSelectionTab({
  availableClasses,
  searchTerm,
  filterClassId,
  loading,
  filteredStudents,
  onSearchChange,
  onFilterClassChange,
  onStudentSelection,
}: IndividualSelectionTabProps) {
  return (
    <TabsContent
      value="individuals"
      className="mt-4 h-full space-y-4 overflow-auto"
    >
      {/* 生徒一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            利用可能な生徒 ({filteredStudents.length}名)
          </CardTitle>
          <CardDescription>
            追加したい生徒を検索・選択してください
          </CardDescription>
          {/* フィルター機能を統合 */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                id="student-search"
                placeholder="名前、ふりがな、学籍番号で検索"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterClassId} onValueChange={onFilterClassChange}>
              <SelectTrigger>
                <SelectValue placeholder="学級フィルタ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての学級</SelectItem>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="max-h-96 overflow-auto">
          {loading ? (
            <div className="py-4 text-center">読み込み中...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-muted-foreground py-4 text-center">
              該当する生徒が見つかりません
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((student) => (
                <Card key={student.id} className="p-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`student-${student.id}`}
                      checked={student.isSelected}
                      onCheckedChange={(checked) =>
                        onStudentSelection(student.id, checked as boolean)
                      }
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={`student-${student.id}`}
                          className="cursor-pointer"
                        >
                          <div className="font-medium">
                            {student.lastName} {student.firstName}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {student.studentNumber}
                          </div>
                        </label>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {student.memberships?.[0]?.class.name || "未所属"}
                          </div>
                          {student.memberships?.[0]?.attendanceNumber && (
                            <div className="text-muted-foreground text-xs">
                              出席番号:{" "}
                              {student.memberships?.[0]?.attendanceNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )
}
