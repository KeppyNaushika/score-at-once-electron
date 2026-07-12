"use client"

import { useDroppable } from "@dnd-kit/core"
import { Ban, FileX, X } from "lucide-react"

import type { EmptyTableCellProps } from "@/components/exams/06-student-answers/student-answer-table/types"
import { encodeCellDroppableId } from "@/components/exams/06-student-answers/student-answer-table/utils/dragDropUtils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TableCell } from "@/components/ui/table"

export function EmptyTableCell({
  examStudent,
  pageNumber,
  isPositionDisabled,
  isPendingChange = false,
  mode = "upload",
  hasExistingAnswer = false,
  allowOverwrite = false,
  disabledReason,
  onTogglePosition,
  onToggleAnswerDisabled,
  hasNewFileToUpload = false,
}: EmptyTableCellProps) {
  // 無効化理由のテキストを取得
  const getDisabledReasonText = () => {
    // 確認モード（view）では「答案なし」と表示
    if (mode === "view") {
      return "答案なし"
    }

    // uploadモードでは詳細な理由を表示
    switch (disabledReason) {
      case "absent_student":
        return "欠席生徒"
      case "row":
        return "行無効"
      case "column":
        return "列無効"
      case "position":
        return "セル無効"
      case "existing_answer":
        return "既存答案あり（上書き無効）"
      case undefined:
      case null:
        return "空セル"
      default:
        return "空セル"
    }
  }

  // 右クリックメニューを表示するかの判定（uploadモードでは無効セルでもメニュー表示）
  const shouldShowContextMenu = mode === "upload"

  // 確認モード（方式B）: 空セルも答案のドロップ先にする。
  // セル座標を droppable ID にして handleDragEnd で (studentId, pageNumber) を復号する。
  // upload では disabled にして方式A（ファイル間の並べ替え）に影響させない。
  // 欠席生徒のマスは「答案なし」表示だが、欠席者に答案を割り当てないようドロップ不可にする。
  const isAbsentStudent = examStudent?.status === "absent"
  const { setNodeRef, isOver } = useDroppable({
    id: encodeCellDroppableId(
      examStudent?.studentId ?? "none",
      pageNumber ?? 0
    ),
    disabled: mode !== "view" || !examStudent || isAbsentStudent,
  })
  const isDropTarget = mode === "view" && isOver

  return (
    <TableCell
      ref={setNodeRef}
      className={`relative h-32 w-32 border p-1 transition-colors ${
        isPositionDisabled ? "bg-gray-100" : "bg-white"
      } ${
        isDropTarget ? "bg-blue-100 outline outline-2 outline-blue-500" : ""
      }`}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex h-full w-full items-center justify-center">
            {isPositionDisabled ? (
              <div className="flex flex-col items-center">
                <Ban className="h-6 w-6 text-gray-400" />
                <div className="mt-1 text-center text-xs text-gray-500">
                  {getDisabledReasonText()}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400">
                {hasExistingAnswer ? "答案画像あり" : "空セル"}
                {examStudent && (
                  <div className="mt-1">
                    {examStudent.student.lastName}{" "}
                    {examStudent.student.firstName}
                  </div>
                )}
                {pageNumber && <div>P{pageNumber}</div>}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        {shouldShowContextMenu && (
          <ContextMenuContent>
            <ContextMenuItem
              onClick={onTogglePosition}
              className="flex items-center gap-2"
            >
              {isPositionDisabled ? (
                <>
                  <X className="h-4 w-4" />
                  セルを有効化
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4" />
                  セル無効
                </>
              )}
            </ContextMenuItem>
            {hasNewFileToUpload && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={onToggleAnswerDisabled}
                  className="flex items-center gap-2"
                >
                  <FileX className="h-4 w-4" />
                  答案無効
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        )}
      </ContextMenu>

      {/* 変更予定オーバーレイ */}
      {isPendingChange && (
        <div className="pointer-events-none absolute inset-0 z-40 animate-pulse border-4 border-red-500 bg-red-500/30" />
      )}

      {/* 既存答案警告オーバーレイ（上書きオン時のみ表示） */}
      {hasExistingAnswer && mode === "upload" && allowOverwrite && (
        <div className="pointer-events-none absolute inset-0 z-30 border-2 border-orange-500 bg-orange-500/20" />
      )}
    </TableCell>
  )
}
