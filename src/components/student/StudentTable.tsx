"use client"

import type { Prisma } from "@prisma/client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, FileArchive, PlusCircle, Upload, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { ArchiveImportScreens } from "@/components/archive-import/ArchiveImportScreens"
import { archiveImportToolbarAction } from "@/components/archive-import/archiveImportToolbarAction"
import { useArchiveImportLauncher } from "@/components/archive-import/hooks/useArchiveImportLauncher"
import { Combobox } from "@/components/common/Combobox"
import { ListSearchInput } from "@/components/common/ListFilterControls"
import { ListPaginationFooter } from "@/components/common/ListPaginationFooter"
import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"
import PageHeader from "@/components/layout/PageHeader"
import { DeleteStudentModal } from "@/components/student/DeleteStudentModal"
import { useStudentTableRows } from "@/components/student/hooks/useStudentTableRows"
import SpreadsheetImportModal from "@/components/student/SpreadsheetImportModal"
import StudentModal from "@/components/student/StudentModal"
import { StudentTableRow } from "@/components/student/StudentTableRow"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SortableTableHead } from "@/components/ui/SortableTableHead"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { UnifiedArchiveExportInitialSelection } from "@/components/unified-archive/export/types"
import { UnifiedArchiveExportDialog } from "@/components/unified-archive/export/UnifiedArchiveExportDialog"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import { useListPagination } from "@/hooks/useListPagination"
import {
  classroomListQuery,
  createStudentMutation,
  exportStudentsExcelMutation,
  studentListQuery,
  updateStudentMutation,
} from "@/queries/student"
import type { ClassroomWithMemberships } from "@/types/prismaExtensions"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_STUDENTS: StudentWithMemberships[] = []

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_CLASSROOMS: ClassroomWithMemberships[] = []

/** 1行の高さの見積もり（px）。「自動」の件数はこれで割る。はみ出すより余らせる */
const STUDENT_TABLE_ROW_HEIGHT = 60

/** 行の上に居座る見出し行の高さ（`h-12`） */
const STUDENT_TABLE_HEADER_HEIGHT = 48

export default function StudentTable() {
  const queryClient = useQueryClient()
  const router = useRouter()
  // 生徒・学級は全画面で共有するキャッシュから引く（この画面だけ取り直さない）
  const { data: students = EMPTY_STUDENTS } = useQuery(studentListQuery())
  const refreshStudents = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: studentListQuery().queryKey }),
    [queryClient]
  )
  const { data: classrooms = EMPTY_CLASSROOMS } = useQuery(classroomListQuery())
  const [searchTerm, setSearchTerm] = useState("")
  const [filterMembershipStatus, setFilterMembershipStatus] =
    useState<string>("current_unassigned")
  const [filterClassroomId, setFilterClassroomId] = useState<string>("all")

  // Selection states
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  )

  // Modal states
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
  const [studentToEdit, setStudentToEdit] =
    useState<StudentWithMemberships | null>(null)
  const [isSpreadsheetImportModalOpen, setIsSpreadsheetImportModalOpen] =
    useState(false)
  const archiveImport = useArchiveImportLauncher()
  /** .sao 書き出しを開いたときの最初の選択（押した時点の選択中の生徒）。null の間は閉じている */
  const [unifiedExportSelection, setUnifiedExportSelection] =
    useState<UnifiedArchiveExportInitialSelection | null>(null)
  // 削除の確認を開いている生徒（成績算出の名簿に載っていれば確認画面が断る）
  const studentDeletion = useDialogTarget<StudentWithMemberships>()

  const { sortedData, sortConfig, requestSort, classroomOptions } =
    useStudentTableRows({
      students,
      classrooms,
      searchTerm,
      classroomId: filterClassroomId,
      membershipStatus: filterMembershipStatus,
    })

  // 絞り込みと並び順を変えたら先頭のページから見る
  const paginationResetKey = [
    searchTerm,
    filterClassroomId,
    filterMembershipStatus,
    sortConfig.key ?? "",
    sortConfig.direction ?? "",
  ].join("|")
  const {
    pageRows,
    pageNumber,
    pageSize,
    pageSizeChoice,
    setPageSizeChoice,
    pageCount,
    setPageNumber,
    firstRowNumber,
    lastRowNumber,
    viewportRef,
  } = useListPagination(sortedData, {
    rowHeight: STUDENT_TABLE_ROW_HEIGHT,
    reservedHeight: STUDENT_TABLE_HEADER_HEIGHT,
    resetKey: paginationResetKey,
  })

  // Selection handlers
  const filteredIds = useMemo(
    () => sortedData.map((row) => row.id),
    [sortedData]
  )

  const isAllSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) => selectedStudentIds.has(id))

  const isSomeSelected =
    !isAllSelected && filteredIds.some((id) => selectedStudentIds.has(id))

  // 全選択・全解除は、表示中のものだけを対象にする
  const toggleSelectAll = () => {
    const nextSelected = new Set(selectedStudentIds)
    filteredIds.forEach((id) =>
      isAllSelected ? nextSelected.delete(id) : nextSelected.add(id)
    )
    setSelectedStudentIds(nextSelected)
  }

  const toggleSelectStudent = (studentId: string) => {
    const nextSelected = new Set(selectedStudentIds)
    if (!nextSelected.delete(studentId)) nextSelected.add(studentId)
    setSelectedStudentIds(nextSelected)
  }

  // Event handlers
  const handleAddNewStudent = () => {
    setStudentToEdit(null)
    setIsStudentModalOpen(true)
  }

  const handleEditStudent = (student: StudentWithMemberships) => {
    setStudentToEdit(student)
    setIsStudentModalOpen(true)
  }

  const handleStudentDeleted = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const remaining = new Set(prev)
      remaining.delete(studentId)
      return remaining
    })
  }

  const handleCreateStudent = (studentData: Prisma.StudentCreateInput) => {
    createStudent.mutate(studentData, {
      onSuccess: () => setIsStudentModalOpen(false),
    })
  }

  const handleUpdateStudent = (
    id: string,
    studentData: Prisma.StudentUpdateInput
  ) => {
    updateStudent.mutate(
      { id, student: studentData },
      { onSuccess: () => setIsStudentModalOpen(false) }
    )
  }

  const handleExportExcel = () => {
    if (selectedStudentIds.size === 0) return
    exportStudentsExcel.mutate(Array.from(selectedStudentIds), {
      onSuccess: (result) => {
        if (result.canceled) return
        toast.success(
          `${selectedStudentIds.size}名の生徒データをExcelに出力しました`
        )
      },
    })
  }

  const createStudent = useMutation(createStudentMutation())
  const updateStudent = useMutation(updateStudentMutation())
  const exportStudentsExcel = useMutation(exportStudentsExcelMutation())

  // 取り込んだ分は取り直して反映する（画面側で足し込むと重複の判定を二重に持つ）
  const onStudentsImported = () => {
    void refreshStudents()
  }

  const classroomFilter = (
    <Combobox
      options={classroomOptions}
      value={filterClassroomId}
      onValueChange={setFilterClassroomId}
      placeholder="学級フィルタ"
      searchPlaceholder="学級を検索"
      emptyText="該当する学級がありません"
      aria-label="学級で絞り込む"
      className="h-8 w-40 rounded-lg"
    />
  )
  const membershipStatusFilter = (
    <Select
      value={filterMembershipStatus}
      onValueChange={setFilterMembershipStatus}
    >
      <SelectTrigger size="sm" className="w-36 rounded-lg">
        <SelectValue placeholder="所属状況" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">すべて</SelectItem>
        <SelectItem value="unassigned">未在籍</SelectItem>
        <SelectItem value="current">在籍中</SelectItem>
        <SelectItem value="current_unassigned">未在籍・在籍中</SelectItem>
        <SelectItem value="past">過去在籍</SelectItem>
      </SelectContent>
    </Select>
  )

  const toolbarActions: ToolbarAction[] = [
    {
      id: "search",
      priority: 90,
      node: (
        <ListSearchInput
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          placeholder="生徒名・学籍番号で検索"
          className="w-56"
        />
      ),
      collapsedNode: (
        <ListSearchInput
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          placeholder="生徒名・学籍番号で検索"
          className="w-full"
        />
      ),
    },
    {
      id: "classroom-filter",
      priority: 85,
      node: classroomFilter,
      collapsedNode: classroomFilter,
    },
    {
      id: "membership-status-filter",
      priority: 84,
      node: membershipStatusFilter,
      collapsedNode: membershipStatusFilter,
    },
    toolbarButtonAction({
      id: "create",
      priority: 80,
      icon: PlusCircle,
      label: "生徒追加",
      onClick: handleAddNewStudent,
    }),
    toolbarButtonAction({
      id: "spreadsheet-import",
      priority: 70,
      icon: Upload,
      label: "Excel 貼付一括追加",
      onClick: () => setIsSpreadsheetImportModalOpen(true),
    }),
    archiveImportToolbarAction({
      priority: 60,
      isOpening: archiveImport.isOpening,
      onClick: () => void archiveImport.start(),
    }),
  ]
  if (selectedStudentIds.size > 0) {
    // 選択中だけ現れる操作。幅が急に増えるが、畳みは実測なので自然に吸収される
    toolbarActions.push(
      toolbarButtonAction({
        id: "excel-export",
        priority: 50,
        icon: Download,
        label: exportStudentsExcel.isPending
          ? "出力中..."
          : `Excel出力（${selectedStudentIds.size}名）`,
        onClick: handleExportExcel,
        disabled: exportStudentsExcel.isPending,
      }),
      toolbarButtonAction({
        id: "unified-archive-export",
        priority: 40,
        icon: FileArchive,
        label: `.sao 書き出し（${selectedStudentIds.size}名）`,
        onClick: () =>
          setUnifiedExportSelection({
            shared: { Student: [...selectedStudentIds] },
          }),
      })
    )
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      <PageHeader
        title="生徒管理"
        subtitle={`${sortedData.length}名`}
        actions={toolbarActions}
      />

      {/* Students Table */}
      <div className="min-h-0 flex-1 p-4">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/50 shadow-sm">
          {/* 「自動」はこの箱の高さを1行の高さで割る。縦に流すのは中の Table の側 */}
          <div ref={viewportRef} className="min-h-0 flex-1">
            <Table wrapperClassName="h-full">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        isAllSelected
                          ? true
                          : isSomeSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="全選択"
                    />
                  </TableHead>
                  <SortableTableHead
                    sortKey="studentNumber"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) => requestSort(key)}
                  >
                    学籍番号
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="fullName"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) => requestSort(key)}
                  >
                    氏名
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="enrollmentYear"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) => requestSort(key)}
                  >
                    入学年度
                  </SortableTableHead>
                  <TableHead>所属学級</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map(({ original: student }) => (
                  <StudentTableRow
                    key={student.id}
                    student={student}
                    isSelected={selectedStudentIds.has(student.id)}
                    onOpen={() => router.push(`/students/${student.id}`)}
                    onToggleSelect={() => toggleSelectStudent(student.id)}
                    onEdit={() => handleEditStudent(student)}
                    onDelete={() => studentDeletion.openWith(student)}
                  />
                ))}
                {sortedData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Users />
                          </EmptyMedia>
                          <EmptyTitle>該当する生徒が見つかりません</EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <ListPaginationFooter
            total={sortedData.length}
            firstRowNumber={firstRowNumber}
            lastRowNumber={lastRowNumber}
            pageSize={pageSize}
            pageSizeChoice={pageSizeChoice}
            onPageSizeChoiceChange={setPageSizeChoice}
            pageNumber={pageNumber}
            pageCount={pageCount}
            onPageChange={setPageNumber}
          />
        </div>
      </div>

      {/* Modals */}
      <DeleteStudentModal
        open={studentDeletion.isOpen}
        student={studentDeletion.target}
        onClose={studentDeletion.close}
        onDeleted={handleStudentDeleted}
      />
      {isStudentModalOpen && (
        <StudentModal
          isOpen={isStudentModalOpen}
          onClose={() => setIsStudentModalOpen(false)}
          onSave={handleCreateStudent}
          onUpdate={handleUpdateStudent}
          studentToEdit={studentToEdit}
        />
      )}

      {isSpreadsheetImportModalOpen && (
        <SpreadsheetImportModal
          isOpen={isSpreadsheetImportModalOpen}
          onClose={() => setIsSpreadsheetImportModalOpen(false)}
          existingStudents={students}
          onImportSuccess={onStudentsImported}
        />
      )}

      <UnifiedArchiveExportDialog
        open={unifiedExportSelection !== null}
        onOpenChange={(open) => {
          if (!open) setUnifiedExportSelection(null)
        }}
        initialSelection={unifiedExportSelection ?? {}}
      />

      <ArchiveImportScreens launcher={archiveImport} />
    </div>
  )
}
