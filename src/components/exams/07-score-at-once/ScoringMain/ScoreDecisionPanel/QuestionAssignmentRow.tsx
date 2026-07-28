"use client"

import { ChevronDown, ChevronRight, Plus, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/AuthContext"
import type {
  ExamMemberSummary,
  ScoreDecisionCell,
  ScoreDecisionQuestion,
} from "@/types/scoreDecision.types"

interface QuestionAssignmentRowProps {
  question: ScoreDecisionQuestion
  members: ExamMemberSummary[]
  canManage: boolean
  selectedCell: ScoreDecisionCell | null
  onSelectCell: (cell: ScoreDecisionCell) => void
  /** 割当変更後にサマリと採点画面の設問集合を取り直す */
  onAssignmentChanged: () => void
}

/**
 * 設問1行（担当バッジ・進捗・裁定対象）。
 *
 * 担当バッジは `User` 実体を持ち、割当の書き込みは必ず
 * (cropRegionId, userId) のペアで行う — 行や列の添字から引かない。
 */
export function QuestionAssignmentRow({
  question,
  members,
  canManage,
  selectedCell,
  onSelectCell,
  onAssignmentChanged,
}: QuestionAssignmentRowProps) {
  const { user } = useAuth()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const assignedUserIds = new Set(
    question.assignees.map((assignee) => assignee.userId)
  )
  const assignableMembers = members.filter(
    (member) => !assignedUserIds.has(member.userId)
  )

  const handleAssign = async (member: ExamMemberSummary) => {
    if (!user) return
    setIsSaving(true)
    try {
      const result = await window.electronAPI.assignCropRegion(
        question.cropRegionId,
        member.userId,
        user.id
      )
      if (result.success) {
        onAssignmentChanged()
      } else {
        toast.error(result.error ?? "採点担当の割り当てに失敗しました")
      }
    } catch (error) {
      console.error("Failed to assign crop region:", error)
      toast.error("採点担当の割り当てに失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnassign = async (userId: string) => {
    if (!user) return
    setIsSaving(true)
    try {
      const result = await window.electronAPI.unassignCropRegion(
        question.cropRegionId,
        userId,
        user.id
      )
      if (result.success) {
        onAssignmentChanged()
      } else {
        toast.error(result.error ?? "採点担当の解除に失敗しました")
      }
    } catch (error) {
      console.error("Failed to unassign crop region:", error)
      toast.error("採点担当の解除に失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="border-b border-gray-100">
      <div className="flex items-start gap-2 px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={question.cells.length === 0}
          className="mt-0.5 shrink-0 text-gray-400 disabled:opacity-30"
          title={
            question.cells.length > 0
              ? "裁定対象を表示"
              : "裁定対象はありません"
          }
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">
              {question.questionLabel}
              <span className="ml-1 text-xs font-normal text-gray-500">
                {question.maxScore}点
              </span>
            </span>
            <span className="shrink-0 text-xs text-gray-500">
              {question.scoredCount}/{question.totalStudents}
            </span>
          </div>

          {/* 担当バッジ（担当0人は全員担当） */}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {question.assignees.length === 0 ? (
              <span className="text-xs text-gray-400">担当なし（全員）</span>
            ) : (
              question.assignees.map((assignee) => (
                <Badge
                  key={assignee.userId}
                  variant="outline"
                  className="gap-1 font-normal"
                >
                  {assignee.userName}
                  <span className="text-gray-500">
                    {assignee.scoredCount}/{question.totalStudents}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => handleUnassign(assignee.userId)}
                      disabled={isSaving}
                      className="text-gray-400 hover:text-red-600"
                      title="担当を外す"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))
            )}

            {canManage && assignableMembers.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1"
                    disabled={isSaving}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {assignableMembers.map((member) => (
                    <DropdownMenuItem
                      key={member.userId}
                      onClick={() => handleAssign(member)}
                    >
                      {member.userName}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {question.cells.length > 0 && (
              <Badge className="ml-auto shrink-0 bg-purple-600">
                要裁定 {question.cells.length}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* 裁定対象の生徒 */}
      {isExpanded &&
        question.cells.map((cell) => (
          <button
            key={`${cell.cropRegionId}:${cell.examStudentId}`}
            onClick={() => onSelectCell(cell)}
            className={`flex w-full items-center justify-between gap-2 py-1.5 pr-3 pl-9 text-left text-sm hover:bg-blue-50 ${
              selectedCell?.cropRegionId === cell.cropRegionId &&
              selectedCell?.examStudentId === cell.examStudentId
                ? "bg-blue-50 font-medium"
                : ""
            }`}
          >
            <span className="truncate">{cell.studentName}</span>
            {cell.reason === "conflict" ? (
              <Badge className="shrink-0 bg-purple-600">食い違い</Badge>
            ) : (
              <Badge className="shrink-0 bg-yellow-600">要再確認</Badge>
            )}
          </button>
        ))}
    </div>
  )
}
