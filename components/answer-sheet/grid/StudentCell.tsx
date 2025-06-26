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
        return <Badge variant="destructive" className="text-xs">欠席</Badge>
      case 'expected':
        return <Badge variant="secondary" className="text-xs">見込</Badge>
      case 'participating':
      default:
        return <Badge variant="outline" className="text-xs">受験</Badge>
    }
  }

  return (
    <TableCell className={`
      border-r border-border min-w-48 p-4
      ${!isEnabled || isSkipped ? 'bg-muted/80' : 'bg-background'}
    `}>
      <div className="flex items-center gap-3">
        {/* チェックボックス */}
        <Checkbox
          checked={isEnabled && !isSkipped}
          onCheckedChange={onToggle}
          disabled={student.status === 'absent'} // 欠席者は変更不可
          className="data-[state=checked]:bg-primary"
        />
        
        {/* 生徒情報 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getStatusIcon()}
            <span className={`font-medium text-sm truncate ${
              !isEnabled || isSkipped ? 'text-muted-foreground' : 'text-foreground'
            }`}>
              {student.lastName} {student.firstName}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              {student.studentId}
            </Badge>
            {student.attendanceNumber && (
              <Badge variant="secondary" className="text-xs">
                {student.attendanceNumber}番
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {(!isEnabled || isSkipped) && (
              <Badge variant="secondary" className="text-xs">
                スキップ
              </Badge>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {student.lastNameKana} {student.firstNameKana}
          </div>
        </div>
      </div>
    </TableCell>
  )
}