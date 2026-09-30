"use client"

import { type LucideIcon, UserCheck, Users, UserX } from "lucide-react"
import { useMemo, useState } from "react"

import type {
  RosterColumn,
  RosterFilter,
  RosterRow,
  RosterTableSlots,
} from "@/components/common/roster-table"
import {
  RosterDragOverlay,
  RosterTableFilters,
  RosterTableHeader,
  RosterTableRow,
  useRosterTable,
} from "@/components/common/roster-table"
import { SortableTableProvider } from "@/components/common/sortable-table"
import type { SortableStudentTableProps } from "@/components/exams/05-students/components/sortable-student-table/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ExamClassroomPlacement } from "@/lib/examClassroomPlacement"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface ExamStudentStatusOption {
  status: ExamStudentStatus
  label: string
  Icon: LucideIcon
  /** 選択中の色（受験・見込・欠席で塗り分ける） */
  selectedClassName: string
}

const EXAM_STUDENT_STATUS_OPTIONS: ExamStudentStatusOption[] = [
  {
    status: "participating",
    label: "受験",
    Icon: UserCheck,
    selectedClassName:
      "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
  },
  {
    status: "expected",
    label: "見込",
    Icon: Users,
    selectedClassName:
      "data-[state=on]:bg-amber-400 data-[state=on]:text-amber-950",
  },
  {
    status: "absent",
    label: "欠席",
    Icon: UserX,
    selectedClassName:
      "data-[state=on]:bg-destructive data-[state=on]:text-white",
  },
]

/** 受験生徒（ExamStudent）と表示学級情報を共通の RosterRow へ変換 */
function toRosterRow(
  examStudent: ExamStudentWithMemberships,
  placement: ExamClassroomPlacement | undefined
): RosterRow {
  const student = examStudent.student
  return {
    id: examStudent.studentId,
    studentNumber: student.studentNumber,
    lastName: student.lastName,
    firstName: student.firstName,
    kana: `${student.lastNameKana} ${student.firstNameKana}`,
    classroomInfo: {
      className: placement?.classroom?.name ?? null,
      classroomCode: placement?.classroom?.classroomCode ?? null,
      grade: placement?.classroom?.grade ?? null,
      attendanceNumber: placement?.attendanceNumber ?? null,
      classroomOrder: placement?.order ?? null,
    },
    customOrder: examStudent.customOrder,
  }
}

/**
 * 受験生徒管理テーブル
 *
 * 共通 roster-table の表示部品（ヘッダー/行/フィルタ/ドラッグ）を用い、
 * 試験固有の「答案枚数列」「受験状態列」「受験状態フィルタ」をスロットで差し込む。
 * 状態・選択・フィルタは従来どおりページ側フック（props）で制御する。
 */
export function SortableStudentTableContainer(
  props: SortableStudentTableProps
) {
  const {
    classrooms,
    selectedStudents,
    onStudentSelectionChange,
    onSelectAll,
    onStudentStatusUpdate,
    onStudentOrderUpdate,
    students,
    filteredStudents,
    placementByStudent,
    examId,
    searchTerm,
    onSearchChange,
    selectedClassroomId,
    onClassroomChange,
    statusFilter,
    onStatusChange,
  } = props

  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const allRows = useMemo(
    () =>
      students.map((examStudent) =>
        toRosterRow(examStudent, placementByStudent[examStudent.studentId])
      ),
    [students, placementByStudent]
  )

  const filteredRows = useMemo(
    () =>
      filteredStudents.map((examStudent) =>
        toRosterRow(examStudent, placementByStudent[examStudent.studentId])
      ),
    [filteredStudents, placementByStudent]
  )

  // スロット列（答案枚数・受験状態）が元の ExamStudent を型安全に参照するための索引。
  // RosterRow に無型の extras を積んで as で取り出すのを避ける。
  const examStudentByStudentId = useMemo(
    () =>
      new Map<string, ExamStudentWithMemberships>(
        filteredStudents.map((examStudent) => [
          examStudent.studentId,
          examStudent,
        ])
      ),
    [filteredStudents]
  )

  const {
    sortedRows,
    activeRow,
    handleDragStart,
    handleDragEnd,
    handleToggleSelection,
    handleSelectAll,
    handleResetOrder,
  } = useRosterTable({
    allRows,
    filteredRows,
    selectedIds: selectedStudents,
    onSelectionChange: onStudentSelectionChange,
    onSelectAll,
    onOrderUpdate: (rowOrders) => onStudentOrderUpdate(examId, rowOrders),
  })

  // 答案枚数列（スロット）
  const additionalColumns: RosterColumn[] = useMemo(
    () => [
      {
        key: "answerSheetCount",
        header: "答案枚数",
        headerClassName: "w-24 text-center",
        cellClassName: "text-center",
        cell: (row) => {
          const count =
            examStudentByStudentId.get(row.id)?.studentAnswerImages.length ?? 0
          return count > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {count}枚
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
        },
      },
    ],
    [examStudentByStudentId]
  )

  // 受験状態フィルタ（スロット）
  const additionalFilters: RosterFilter[] = useMemo(
    () => [
      {
        render: () => (
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての受験状態</SelectItem>
              <SelectItem value="participating">受験</SelectItem>
              <SelectItem value="expected">見込</SelectItem>
              <SelectItem value="absent">欠席</SelectItem>
            </SelectContent>
          </Select>
        ),
        // フィルタはページ側 filteredStudents で適用済みのため常に true
        predicate: () => true,
      },
    ],
    [statusFilter, onStatusChange]
  )

  // 受験状態ボタン列（スロット）
  const rowActionButtons: RosterTableSlots["rowActionButtons"] = useMemo(
    () => ({
      header: "受験状態",
      render: (row) => {
        const status = examStudentByStudentId.get(row.id)?.status
        return (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={status ?? ""}
            aria-label="受験状態"
            onValueChange={(value) => {
              // 選択中をもう一度押すと空文字が来る。選択は外さない
              const nextStatusOption = EXAM_STUDENT_STATUS_OPTIONS.find(
                (candidateOption) => candidateOption.status === value
              )
              if (nextStatusOption)
                onStudentStatusUpdate(row.id, nextStatusOption.status)
            }}
          >
            {EXAM_STUDENT_STATUS_OPTIONS.map((statusOption) => (
              <ToggleGroupItem
                key={statusOption.status}
                value={statusOption.status}
                className={`gap-1 px-2.5 ${statusOption.selectedClassName}`}
              >
                <statusOption.Icon className="h-3 w-3" />
                {statusOption.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )
      },
    }),
    [onStudentStatusUpdate, examStudentByStudentId]
  )

  const handleConfirmReset = async () => {
    setIsResetting(true)
    try {
      await handleResetOrder()
    } finally {
      setIsResetting(false)
      setShowResetDialog(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* フィルター行 */}
      <div className="flex items-center gap-3">
        <RosterTableFilters
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          selectedClassroomId={selectedClassroomId}
          onClassroomChange={onClassroomChange}
          classrooms={classrooms}
          additionalFilters={additionalFilters}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowResetDialog(true)}
        >
          並び順をリセット
        </Button>
      </div>

      {/* テーブル */}
      <div className="min-h-96 rounded-md border">
        <SortableTableProvider
          items={sortedRows.map((row) => row.id)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          dragOverlay={
            <RosterDragOverlay
              activeRow={activeRow}
              selectedIds={selectedStudents}
            />
          }
        >
          <Table>
            <RosterTableHeader
              sortedRows={sortedRows}
              selectedIds={selectedStudents}
              onSelectAll={handleSelectAll}
              additionalColumns={additionalColumns}
              rowActionButtons={rowActionButtons}
            />
            <TableBody>
              {sortedRows.map((row) => (
                <RosterTableRow
                  key={row.id}
                  row={row}
                  isSelected={selectedStudents.has(row.id)}
                  onToggleSelection={(studentId) =>
                    handleToggleSelection(studentId)
                  }
                  additionalColumns={additionalColumns}
                  rowActionButtons={rowActionButtons}
                />
              ))}
            </TableBody>
          </Table>
        </SortableTableProvider>
      </div>

      {/* 並び順リセット確認ダイアログ */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>並び順をリセットしますか？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                手動で設定した並び順を、学級の関連付け設定に基づいて再設定します（検索・フィルタ中でも全生徒が対象になります）。
              </span>
              <span className="block font-medium">リセット後の並び順：</span>
              <span className="block pl-4 text-muted-foreground">
                1. 学級の関連付け順（上から順）
                <br />
                2. 学級内の出席番号順
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              disabled={isResetting}
            >
              {isResetting ? "リセット中..." : "リセット"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
