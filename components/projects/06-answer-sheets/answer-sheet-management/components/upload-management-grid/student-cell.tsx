"use client"

import { UserCheck, UserMinus, UserX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { TableCell } from "@/components/ui/table"
import type { StudentCellProps } from "@/components/projects/06-answer-sheets/answer-sheet-management/types"

export function StudentCell({
  student,
  isEnabled,
  onToggle,
}: StudentCellProps) {
  // 生徒の状態に応じたアイコンと色
  const getStatusIcon = () => {
    if (student.status === "absent") {
      return <UserX className="h-4 w-4 text-red-500" />
    }
    if (student.status === "expected") {
      return <UserMinus className="h-4 w-4 text-orange-500" />
    }
    return <UserCheck className="h-4 w-4 text-green-500" />
  }

  const getStatusBadge = () => {
    switch (student.status) {
      case "absent":
        return (
          <Badge
            variant="destructive"
            className="border-none bg-transparent text-xs text-red-600"
          >
            欠席
          </Badge>
        )
      case "expected":
        return (
          <Badge
            variant="secondary"
            className="border-none bg-transparent text-xs text-orange-600"
          >
            見込
          </Badge>
        )
      case "participating":
      default:
        return (
          <Badge
            variant="outline"
            className="border-none bg-transparent text-xs text-green-600"
          >
            受験
          </Badge>
        )
    }
  }

  return (
    <TableCell
      className={`border-border relative min-w-36 cursor-pointer border-r p-2 ${!isEnabled ? "bg-muted/80" : "bg-background"} hover:bg-muted/50`}
      onClick={onToggle}
    >
      <div className="flex flex-col gap-1">
        {/* ホバー時のツールチップ */}
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-transparent opacity-0 transition-opacity hover:opacity-100">
          <div className="text-xs font-medium text-slate-800">
            {!isEnabled ? "クリックして生徒を表示" : "クリックして生徒を除外"}
          </div>
        </div>

        {/* 生徒情報 */}
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1">
            {getStatusIcon()}
            <span
              className={`truncate text-xs font-medium ${
                !isEnabled ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {student.lastName} {student.firstName}
            </span>
          </div>

          <div className="text-muted-foreground mb-1 text-xs">
            {student.studentId}
          </div>

          <div className="flex items-center gap-1">
            {getStatusBadge()}
            {student.attendanceNumber && (
              <Badge
                variant="secondary"
                className="border-none bg-transparent px-1 py-0 text-xs text-slate-600"
              >
                {student.attendanceNumber}
              </Badge>
            )}
          </div>

          {/* 生徒状態表示 */}
          <div className="text-muted-foreground mt-1 text-xs">
            {!isEnabled ? "クリックして表示" : "クリックして除外"}
          </div>
        </div>
      </div>
    </TableCell>
  )
}
