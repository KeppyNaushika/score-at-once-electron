"use client"

import { type LucideIcon, UserCheck, Users, UserX } from "lucide-react"
import { useMemo } from "react"

import type {
  RosterColumn,
  RosterRow,
  RosterTableSlots,
} from "@/components/common/roster-table"
import { RosterTableView } from "@/components/common/roster-table/RosterTableView"
import type { SortableStudentTableProps } from "@/components/exams/05-students/components/sortable-student-table/types"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ExamClassroomPlacement } from "@/lib/examClassroomPlacement"
import { ignoreDeselect } from "@/lib/toggleSelection"
import {
  EXAM_STUDENT_STATUSES,
  type ExamStudentStatus,
} from "@/types/examStudentStatus.types"
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
      classroom: placement?.classroom ?? null,
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
 * 試験固有の「答案枚数列」「受験状態列」をスロットで、「受験状態フィルタ」の UI を
 * 表示だけの枠で差し込む。状態・選択・絞り込みはページ側フック（props）が持つ。
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
            onValueChange={ignoreDeselect(EXAM_STUDENT_STATUSES, (nextStatus) =>
              onStudentStatusUpdate(row.id, nextStatus)
            )}
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

  return (
    <div className="space-y-4">
      <RosterTableView
        allRows={allRows}
        filteredRows={filteredRows}
        selectedIds={selectedStudents}
        onSelectionChange={onStudentSelectionChange}
        onSelectAll={onSelectAll}
        onOrderUpdate={(rowOrders) => onStudentOrderUpdate(examId, rowOrders)}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        selectedClassroomId={selectedClassroomId}
        onClassroomChange={onClassroomChange}
        classrooms={classrooms}
        // 受験状態の絞り込みはページ側（filteredStudents）で済んでいる。ここは選ぶ UI だけ
        extraFilterControls={
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="w-40" aria-label="受験状態で絞り込む">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての受験状態</SelectItem>
              <SelectItem value="participating">受験</SelectItem>
              <SelectItem value="expected">見込</SelectItem>
              <SelectItem value="absent">欠席</SelectItem>
            </SelectContent>
          </Select>
        }
        additionalColumns={additionalColumns}
        rowActionButtons={rowActionButtons}
        showResetButtonIcon={false}
      />
    </div>
  )
}
