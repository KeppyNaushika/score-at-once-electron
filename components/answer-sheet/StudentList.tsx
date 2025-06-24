"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckSquare, Square } from "lucide-react"

interface StudentWithAnswers {
  id: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  studentId: string
  isSelected: boolean
  hasExistingAnswers: boolean
  overwrite: boolean
  status?: 'participating' | 'expected' | 'absent'
  customOrder?: number | null
  attendanceNumber?: number | null
}

interface ConvertedFile {
  id: string
  studentId?: string
}

interface StudentListProps {
  studentsWithAnswers: StudentWithAnswers[]
  files: ConvertedFile[]
  selectedStudentsCount: number
  isUploading: boolean
  onToggleStudentSelection: (studentId: string) => void
  onToggleStudentOverwrite: (studentId: string) => void
  onSelectAllStudents: () => void
  onDeselectAllStudents: () => void
}

export default function StudentList({
  studentsWithAnswers,
  files,
  selectedStudentsCount,
  isUploading,
  onToggleStudentSelection,
  onToggleStudentOverwrite,
  onSelectAllStudents,
  onDeselectAllStudents,
}: StudentListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>生徒一覧 ({selectedStudentsCount}人選択中)</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAllStudents}
              disabled={isUploading}
            >
              <CheckSquare className="mr-1 h-4 w-4" />
              全選択
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDeselectAllStudents}
              disabled={isUploading}
            >
              <Square className="mr-1 h-4 w-4" />
              全解除
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          アップロードする生徒を選択してください。生徒を無効にするとファイルが自動スキップされます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {studentsWithAnswers.map((student) => {
            const assignedFilesCount = files.filter(f => f.studentId === student.id).length
            return (
              <div
                key={student.id}
                className={`flex items-center gap-3 rounded-lg border p-2 transition-colors ${
                  student.isSelected
                    ? "bg-primary/5 border-primary/20"
                    : "hover:bg-muted/50 bg-muted/20"
                }`}
              >
                <Checkbox
                  checked={student.isSelected}
                  onCheckedChange={() => onToggleStudentSelection(student.id)}
                  disabled={isUploading}
                />

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {student.lastName} {student.firstName}
                    </span>
                    <Badge variant="outline" className="text-xs">{student.studentId}</Badge>

                    {assignedFilesCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {assignedFilesCount}ファイル
                      </Badge>
                    )}

                    {student.hasExistingAnswers && (
                      <Badge variant="destructive" className="text-xs">
                        既存答案
                      </Badge>
                    )}
                  </div>

                  <p className="text-muted-foreground text-xs">
                    {student.lastNameKana} {student.firstNameKana}
                  </p>
                </div>

                {student.hasExistingAnswers && (
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={student.overwrite}
                      onCheckedChange={() => onToggleStudentOverwrite(student.id)}
                      disabled={isUploading || !student.isSelected}
                    />
                    <span className="text-muted-foreground text-xs">
                      上書き
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}