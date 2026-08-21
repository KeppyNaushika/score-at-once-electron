"use client"

import { useDraggable, useDroppable } from "@dnd-kit/core"
import type { ExamPage } from "@prisma/client"
import { Trash2 } from "lucide-react"
import { useState } from "react"

import { DeleteConfirmationModal } from "@/components/exams/06-student-answers/student-answer-table/components/DeleteConfirmationModal"
import { encodeCellDroppableId } from "@/components/exams/06-student-answers/student-answer-table/utils/dragDropUtils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TableCell } from "@/components/ui/table"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"
import type { StudentAnswerDatasetExamStudent } from "@/types/prismaExtensions"

interface DraggableAnswerCellProps {
  fileId: string
  // 生徒・ページは実体のまま受け取る（座標 droppable の examPageId・削除確認の氏名/ページ表示に使う）
  examStudent: StudentAnswerDatasetExamStudent
  examPage: ExamPage
  /** 削除の実行。利用者に見せた件数を添えて渡す（消す直前に main が数え直す） */
  onDelete: (confirmedCounts: ConfirmedDeletionCount[]) => Promise<void>
  children: React.ReactNode
}

/**
 * 確認モード（方式B）の答案セル。
 *
 * sortable（並べ替えリスト）ではなく素の droppable（マス）＋ draggable（答案）で構成する。
 * これにより掴んでも他マスに reflow transform が当たらず、ドラッグ中に周囲が散らばらない。
 * セル自体が `cell:studentId:examPageId` の droppable なので、占有マスへのドロップ＝swap も
 * `decodeCellDroppableId` で素直に解決できる（空マスの EmptyTableCell と同じ座標スキーム）。
 */
export function DraggableAnswerCell({
  fileId,
  examStudent,
  examPage,
  onDelete,
  children,
}: DraggableAnswerCellProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const studentName = `${examStudent.student.lastName} ${examStudent.student.firstName}`

  // マス（ドロップ受け皿）: 占有マスも空マスと同じ座標 droppable（examPageId）にする
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: encodeCellDroppableId(examStudent, examPage),
  })

  // 答案（掴む対象）
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: fileId })

  return (
    <TableCell
      ref={setDropRef}
      className={`relative h-32 w-32 border p-1 transition-colors ${
        isOver ? "bg-blue-100 outline outline-2 outline-blue-500" : "bg-white"
      }`}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={setDragRef}
            className="h-full w-full cursor-grab active:cursor-grabbing"
            style={{ opacity: isDragging ? 0.5 : 1 }}
            {...listeners}
            {...attributes}
          >
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            答案画像を削除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={onDelete}
        fileId={fileId}
        studentName={studentName}
        pageNumber={examPage.pageNumber}
      />
    </TableCell>
  )
}
