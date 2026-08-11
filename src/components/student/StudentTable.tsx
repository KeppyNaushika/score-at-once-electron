"use client"

import type { Prisma } from "@prisma/client"
import {
  Download,
  Edit,
  FolderInput,
  FolderOutput,
  PlusCircle,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import SpreadsheetImportModal from "@/components/student/SpreadsheetImportModal"
import { StudentArchiveExportDialog } from "@/components/student/StudentArchiveExportDialog"
import StudentModal from "@/components/student/StudentModal"
import { StudentImportWizardModal } from "@/components/student-import/StudentImportWizardModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
import { useTableSort } from "@/hooks/useTableSort"
import { isCurrentMembership } from "@/lib/membership"
import type {
  ClassroomWithMemberships,
  StudentWithMemberships,
} from "@/types/prismaExtensions"

// ソート用の型
interface StudentSortable {
  id: string
  studentNumber: string
  fullName: string
  enrollmentYear: number | null
  original: StudentWithMemberships
}

export default function StudentTable() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentWithMemberships[]>([])
  const [classrooms, setClassrooms] = useState<ClassroomWithMemberships[]>([])
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
  const [isExporting, setIsExporting] = useState(false)

  // Data fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedStudents = await window.electronAPI.fetchStudents()
        const fetchedClassrooms = await window.electronAPI.fetchClassrooms()
        setStudents(fetchedStudents || [])
        setClassrooms(fetchedClassrooms || [])
      } catch (error) {
        console.error("Failed to fetch data:", error)
      }
    }
    fetchData()
  }, [])

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const fullName = `${student.lastName} ${student.firstName}`
      const fullNameKana = `${student.lastNameKana} ${student.firstNameKana}`
      const matchesSearch =
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fullNameKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentNumber.toLowerCase().includes(searchTerm.toLowerCase())

      if (filterClassroomId !== "all") {
        const belongsToClassroom = student.memberships.some(
          (membership) =>
            membership.classroom.id === filterClassroomId &&
            isCurrentMembership(membership)
        )
        if (!belongsToClassroom) return false
      }

      if (filterMembershipStatus === "current_unassigned") {
        return (
          matchesSearch &&
          (student.memberships.length === 0 ||
            student.memberships.some((membership) =>
              isCurrentMembership(membership)
            ))
        )
      } else if (filterMembershipStatus === "current") {
        return (
          matchesSearch &&
          student.memberships.some((membership) =>
            isCurrentMembership(membership)
          )
        )
      } else if (filterMembershipStatus === "past") {
        return (
          matchesSearch &&
          student.memberships.length > 0 &&
          student.memberships.every(
            (membership) => !isCurrentMembership(membership)
          )
        )
      } else if (filterMembershipStatus === "unassigned") {
        return matchesSearch && student.memberships.length === 0
      }
      return matchesSearch
    })
  }, [students, searchTerm, filterClassroomId, filterMembershipStatus])

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

  const handleDeleteStudent = async (studentId: string) => {
    if (window.confirm("本当にこの生徒を削除しますか？")) {
      try {
        await window.electronAPI.deleteStudent(studentId)
        setStudents(students.filter((student) => student.id !== studentId))
        setSelectedStudentIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(studentId)
          return newSet
        })
      } catch (error) {
        console.error("Failed to delete student:", error)
        alert("生徒の削除に失敗しました。")
      }
    }
  }

  const handleCreateStudent = async (
    studentData: Prisma.StudentCreateInput
  ) => {
    try {
      const newStudent = await window.electronAPI.createStudent(studentData)
      setStudents([...students, newStudent])
      setIsStudentModalOpen(false)
    } catch (error) {
      console.error("Failed to create student:", error)
      alert("生徒の作成に失敗しました。")
    }
  }

  const handleUpdateStudent = async (
    id: string,
    studentData: Prisma.StudentUpdateInput
  ) => {
    try {
      const updatedStudent = await window.electronAPI.updateStudent(
        id,
        studentData
      )
      setStudents(
        students.map((student) =>
          student.id === updatedStudent.id ? updatedStudent : student
        )
      )
      setIsStudentModalOpen(false)
    } catch (error) {
      console.error("Failed to update student:", error)
      alert("生徒の更新に失敗しました。")
    }
  }

  const handleExportExcel = async () => {
    if (selectedStudentIds.size === 0) return
    setIsExporting(true)
    try {
      const result = await window.electronAPI.exportStudentsExcel(
        Array.from(selectedStudentIds)
      )
      if (!result.canceled) {
        toast.success(
          `${selectedStudentIds.size}名の生徒データをExcelに出力しました`
        )
      }
    } catch (error) {
      toast.error("エクスポートに失敗しました", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsExporting(false)
    }
  }

  const refreshData = async () => {
    try {
      const fetchedStudents = await window.electronAPI.fetchStudents()
      const fetchedClassrooms = await window.electronAPI.fetchClassrooms()
      setStudents(fetchedStudents || [])
      setClassrooms(fetchedClassrooms || [])
    } catch (error) {
      console.error("Failed to refresh data:", error)
    }
  }

  const onStudentsImported = (importedStudents: StudentWithMemberships[]) => {
    setStudents((prevStudents) => {
      const existingStudentIds = new Set(
        prevStudents.map((student) => student.id)
      )
      const newStudents = importedStudents.filter(
        (student) => !existingStudentIds.has(student.id)
      )
      return [...prevStudents, ...newStudents]
    })
  }

  // Get current classrooms for display
  const getCurrentClassrooms = (student: StudentWithMemberships) => {
    return student.memberships
      .filter((membership) => isCurrentMembership(membership))
      .map((membership) => ({
        name: membership.classroom.name,
      }))
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      {/* Action Bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleAddNewStudent}
            variant="outline"
            className="rounded-lg"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            生徒追加
          </Button>
          <Button
            onClick={() => setIsSpreadsheetImportModalOpen(true)}
            variant="outline"
            className="rounded-lg"
          >
            <Upload className="mr-2 h-4 w-4" />
            Excel 貼付一括追加
          </Button>
          <Button
            onClick={() => setIsArchiveImportModalOpen(true)}
            variant="outline"
            className="rounded-lg"
          >
            <FolderInput className="mr-2 h-4 w-4" />
            .students 読み込み
          </Button>
          {selectedStudentIds.size > 0 && (
            <>
              <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                {selectedStudentIds.size}名選択中
              </span>
              <Button
                onClick={handleExportExcel}
                variant="outline"
                className="rounded-lg"
                disabled={isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "出力中..." : "Excel出力"}
              </Button>
              <Button
                onClick={() => setIsArchiveExportDialogOpen(true)}
                variant="outline"
                className="rounded-lg"
              >
                <FolderOutput className="mr-2 h-4 w-4" />
                .students 書き出し
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="生徒名・学籍番号で検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-56 rounded-lg pl-9"
            />
          </div>
          <Select
            value={filterClassroomId}
            onValueChange={setFilterClassroomId}
          >
            <SelectTrigger className="h-9 w-40 rounded-lg">
              <SelectValue placeholder="学級フィルタ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての学級</SelectItem>
              {classrooms
                .filter((classroom) => classroom.isVisible !== false)
                .sort((classroomA, classroomB) =>
                  classroomA.name.localeCompare(classroomB.name)
                )
                .map((classroom) => (
                  <SelectItem key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select
            value={filterMembershipStatus}
            onValueChange={setFilterMembershipStatus}
          >
            <SelectTrigger className="h-9 w-36 rounded-lg">
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
          <span className="text-sm text-muted-foreground tabular-nums">
            {sortedData.length}名
          </span>
        </div>
      </div>

      {/* Students Table */}
      <div className="min-h-0 flex-1 p-4">
        <div className="h-full overflow-hidden rounded-xl border border-border/50 shadow-sm">
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
              {sortedData.map(({ original: student }) => {
                const currentClassrooms = getCurrentClassrooms(student)
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
                        onCheckedChange={() => toggleSelectStudent(student.id)}
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
                        {currentClassrooms.map((classroom, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                          >
                            {classroom.name}
                          </Badge>
                        ))}
                        {currentClassrooms.length === 0 && (
                          <span className="text-sm text-muted-foreground">
                            未所属
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                        <Button
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteStudent(student.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {sortedData.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-muted-foreground"
                  >
                    該当する生徒が見つかりません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modals */}
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
