"use client"

import type { Prisma } from "@prisma/client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Download,
  Edit,
  FolderInput,
  FolderOutput,
  PlusCircle,
  Trash2,
  Upload,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { Combobox } from "@/components/common/Combobox"
import { ListSearchInput } from "@/components/common/ListFilterControls"
import { ListPaginationFooter } from "@/components/common/ListPaginationFooter"
import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"
import PageHeader from "@/components/layout/PageHeader"
import { DeleteStudentModal } from "@/components/student/DeleteStudentModal"
import SpreadsheetImportModal from "@/components/student/SpreadsheetImportModal"
import { StudentArchiveExportDialog } from "@/components/student/StudentArchiveExportDialog"
import StudentModal from "@/components/student/StudentModal"
import { StudentImportWizardModal } from "@/components/student-import/StudentImportWizardModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import { useListPagination } from "@/hooks/useListPagination"
import { useTableSort } from "@/hooks/useTableSort"
import { isCurrentMembership } from "@/lib/membership"
import {
  classroomFilterOptions,
  studentSearchTerms,
} from "@/lib/searchKeywords"
import { matchesSearchTerm } from "@/lib/searchText"
import {
  classroomListQuery,
  createStudentMutation,
  exportStudentsExcelMutation,
  studentListQuery,
  updateStudentMutation,
} from "@/queries/student"
import type { ClassroomWithMemberships } from "@/types/prismaExtensions"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

// ソート用の型
interface StudentSortable {
  id: string
  studentNumber: string
  fullName: string
  enrollmentYear: number | null
  original: StudentWithMemberships
}

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
  const refreshClassrooms = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: classroomListQuery().queryKey,
      }),
    [queryClient]
  )
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
  const [isArchiveExportDialogOpen, setIsArchiveExportDialogOpen] =
    useState(false)
  const [isArchiveImportModalOpen, setIsArchiveImportModalOpen] =
    useState(false)
  // 削除の確認を開いている生徒（成績算出の名簿に載っていれば確認画面が断る）
  const studentDeletion = useDialogTarget<StudentWithMemberships>()

  // Data fetching
  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = matchesSearchTerm(
        searchTerm,
        studentSearchTerms(student)
      )

      if (!matchesSearch) return false

      // 学級は「その学級に所属したことがあるか」で絞る。在籍中に限ると、
      // 前年度の学級を選んだときに誰も出なくなる（在籍中かは所属状況のほうで問う）
      if (
        filterClassroomId !== "all" &&
        !student.memberships.some(
          (membership) => membership.classroom.id === filterClassroomId
        )
      ) {
        return false
      }

      const hasCurrentMembership = student.memberships.some((membership) =>
        isCurrentMembership(membership)
      )
      if (filterMembershipStatus === "current_unassigned") {
        return student.memberships.length === 0 || hasCurrentMembership
      } else if (filterMembershipStatus === "current") {
        return hasCurrentMembership
      } else if (filterMembershipStatus === "past") {
        return student.memberships.length > 0 && !hasCurrentMembership
      } else if (filterMembershipStatus === "unassigned") {
        return student.memberships.length === 0
      }
      return true
    })
  }, [students, searchTerm, filterClassroomId, filterMembershipStatus])

  const classroomOptions = useMemo(
    () =>
      // 非表示の学級も選べるようにする。前年度の学級はたいてい非表示にされており、
      // 外すと過去の所属で絞り込めない。表示中を先に並べる
      classroomFilterOptions(
        classrooms.toSorted(
          (classroomA, classroomB) =>
            Number(classroomA.isVisible === false) -
              Number(classroomB.isVisible === false) ||
            classroomA.name.localeCompare(classroomB.name)
        )
      ),
    [classrooms]
  )

  // ソート用のデータ変換
  const sortableData = useMemo<StudentSortable[]>(() => {
    return filteredStudents.map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      fullName: `${student.lastName}${student.firstName}`,
      enrollmentYear: student.enrollmentYear ?? null,
      original: student,
    }))
  }, [filteredStudents])

  // ソート機能
  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "fullName", direction: "asc" },
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

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // 表示中のものだけ解除
      const newSet = new Set(selectedStudentIds)
      filteredIds.forEach((id) => newSet.delete(id))
      setSelectedStudentIds(newSet)
    } else {
      // 表示中のものを全選択
      const newSet = new Set(selectedStudentIds)
      filteredIds.forEach((id) => newSet.add(id))
      setSelectedStudentIds(newSet)
    }
  }

  const toggleSelectStudent = (studentId: string) => {
    const newSet = new Set(selectedStudentIds)
    if (newSet.has(studentId)) {
      newSet.delete(studentId)
    } else {
      newSet.add(studentId)
    }
    setSelectedStudentIds(newSet)
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

  const refreshData = async () => {
    await Promise.all([refreshStudents(), refreshClassrooms()])
  }

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
    toolbarButtonAction({
      id: "archive-import",
      priority: 60,
      icon: FolderInput,
      label: ".students 読み込み",
      onClick: () => setIsArchiveImportModalOpen(true),
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
        id: "archive-export",
        priority: 40,
        icon: FolderOutput,
        label: `.students 書き出し（${selectedStudentIds.size}名）`,
        onClick: () => setIsArchiveExportDialogOpen(true),
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
                {pageRows.map(({ original: student }) => {
                  const isSelected = selectedStudentIds.has(student.id)

                  return (
                    <TableRow
                      key={student.id}
                      onClick={() => router.push(`/students/${student.id}`)}
                      className="group cursor-pointer"
                      data-state={isSelected ? "selected" : undefined}
                    >
                      <TableCell
                        className="w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            toggleSelectStudent(student.id)
                          }
                          aria-label={`${student.lastName} ${student.firstName}を選択`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {student.studentNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.lastName} {student.firstName}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {student.enrollmentYear || (
                          <span className="text-muted-foreground">未設定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {/* 在籍中を先に、過去の所属は薄い枠で（並びは開始日の新しい順） */}
                          {student.memberships
                            .toSorted(
                              (membershipA, membershipB) =>
                                Number(isCurrentMembership(membershipB)) -
                                Number(isCurrentMembership(membershipA))
                            )
                            .map((membership) =>
                              isCurrentMembership(membership) ? (
                                <Badge
                                  key={membership.id}
                                  variant="secondary"
                                  className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                                >
                                  {membership.classroom.name}
                                </Badge>
                              ) : (
                                <Badge
                                  key={membership.id}
                                  variant="outline"
                                  title="過去の所属"
                                  className="rounded-full px-2.5 py-0.5 text-xs font-normal text-muted-foreground"
                                >
                                  {membership.classroom.name}
                                </Badge>
                              )
                            )}
                          {student.memberships.length === 0 && (
                            <span className="text-sm text-muted-foreground">
                              未所属
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                aria-label="生徒を編集"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg transition-colors hover:bg-muted"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditStudent(student)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>生徒を編集</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                aria-label="生徒を削除"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  studentDeletion.openWith(student)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>生徒を削除</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
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

      {isArchiveExportDialogOpen && (
        <StudentArchiveExportDialog
          isOpen={isArchiveExportDialogOpen}
          onClose={() => setIsArchiveExportDialogOpen(false)}
          selectedStudentIds={selectedStudentIds}
        />
      )}

      {isArchiveImportModalOpen && (
        <StudentImportWizardModal
          isOpen={isArchiveImportModalOpen}
          onClose={() => setIsArchiveImportModalOpen(false)}
          onComplete={refreshData}
        />
      )}
    </div>
  )
}
