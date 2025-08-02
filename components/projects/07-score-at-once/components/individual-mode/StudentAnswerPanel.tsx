"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

interface Student {
  id: string
  studentId: string
  lastName: string
  firstName: string
  customOrder: number
}

interface StudentAnswerPanelProps {
  students: Student[]
  currentStudentId: string
  onStudentChange: (studentId: string) => void
}

export function StudentAnswerPanel({
  students,
  currentStudentId,
  onStudentChange,
}: StudentAnswerPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // 受験生徒順にソート
  const sortedStudents = [...students].sort((a, b) => a.customOrder - b.customOrder)
  const currentStudent = sortedStudents.find(s => s.id === currentStudentId)

  const handlePrevStudent = () => {
    const currentIndex = sortedStudents.findIndex(s => s.id === currentStudentId)
    if (currentIndex > 0) {
      onStudentChange(sortedStudents[currentIndex - 1].id)
    }
  }

  const handleNextStudent = () => {
    const currentIndex = sortedStudents.findIndex(s => s.id === currentStudentId)
    if (currentIndex < sortedStudents.length - 1) {
      onStudentChange(sortedStudents[currentIndex + 1].id)
    }
  }

  return (
    <div className="border rounded-lg bg-white">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="font-medium">生徒答案</h3>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>
      
      {isExpanded && (
        <div className="p-3 border-t space-y-3">
          {/* 生徒選択プルダウン */}
          <div>
            <Select value={currentStudentId} onValueChange={onStudentChange}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {currentStudent ? 
                    `${currentStudent.lastName} ${currentStudent.firstName} (${currentStudent.studentId})` : 
                    "生徒を選択"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortedStudents.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.lastName} {student.firstName} ({student.studentId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 前/次ボタン */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrevStudent}
              disabled={sortedStudents.findIndex(s => s.id === currentStudentId) === 0}
              className="flex-1"
            >
              前の生徒
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNextStudent}
              disabled={sortedStudents.findIndex(s => s.id === currentStudentId) === sortedStudents.length - 1}
              className="flex-1"
            >
              次の生徒
            </Button>
          </div>

          {/* 現在の位置表示 */}
          <div className="text-sm text-gray-600 text-center">
            {sortedStudents.findIndex(s => s.id === currentStudentId) + 1} / {sortedStudents.length}
          </div>
        </div>
      )}
    </div>
  )
}