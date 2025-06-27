"use client"

import { TableCell } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { UserCheck, UserX, UserMinus } from "lucide-react"

interface Student {
  id: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  studentId: string
  attendanceNumber?: number | null
  status?: 'participating' | 'expected' | 'absent'
  customOrder?: number | null
}

interface StudentCellProps {
  student: Student
  isEnabled: boolean
  isSkipped: boolean
  onToggle: () => void
}

export default function StudentCell({
  student,
  isEnabled,
  isSkipped,
  onToggle
}: StudentCellProps) {
  
  // 生徒の状態に応じたアイコンと色
  const getStatusIcon = () => {
    if (student.status === 'absent') {
      return <UserX className="h-4 w-4 text-red-500" />
    }
    if (student.status === 'expected') {
      return <UserMinus className="h-4 w-4 text-orange-500" />
    }
    return <UserCheck className="h-4 w-4 text-green-500" />
  }

  const getStatusBadge = () => {
    switch (student.status) {
      case 'absent':
        return <Badge variant="destructive" className="text-xs bg-transparent border-none text-red-600">欠席</Badge>
      case 'expected':
        return <Badge variant="secondary" className="text-xs bg-transparent border-none text-orange-600">見込</Badge>
      case 'participating':
      default:
        return <Badge variant="outline" className="text-xs bg-transparent border-none text-green-600">受験</Badge>
    }
  }

  return (
    <TableCell 
      className={`
        border-r border-border min-w-36 p-2 cursor-pointer relative
        ${!isEnabled || isSkipped ? 'bg-muted/80' : 'bg-background'}
        hover:bg-muted/50
      `}
      onClick={onToggle}
    >
      <div className="flex flex-col gap-1">
        {/* ホバー時のツールチップ */}
        <div className="absolute inset-0 bg-transparent opacity-0 hover:opacity-100 transition-opacity z-20 flex items-center justify-center">
          <div className="text-slate-800 text-xs font-medium">
            {(!isEnabled || isSkipped) ? 'クリックして生徒を表示' : 'クリックして生徒を除外'}
          </div>
        </div>

        {/* 生徒情報 */}
        <div className="min-w-0">
          <div className="flex items-center gap-1 mb-1">
            {getStatusIcon()}
            <span className={`font-medium text-xs truncate ${
              !isEnabled || isSkipped ? 'text-muted-foreground' : 'text-foreground'
            }`}>
              {student.lastName} {student.firstName}
            </span>
          </div>
          
          <div className="text-xs text-muted-foreground mb-1">
            {student.studentId}
          </div>
          
          <div className="flex items-center gap-1">
            {getStatusBadge()}
            {student.attendanceNumber && (
              <Badge variant="secondary" className="text-xs px-1 py-0 bg-transparent border-none text-slate-600">
                {student.attendanceNumber}
              </Badge>
            )}
          </div>
          
          {/* 生徒状態表示 */}
          <div className="text-xs text-muted-foreground mt-1">
            {(!isEnabled || isSkipped) ? 'クリックして生徒を表示' : 'クリックして生徒を除外'}
          </div>
        </div>
      </div>
    </TableCell>
  )
}