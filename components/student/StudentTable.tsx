"use client"

import type { Prisma } from "@prisma/client"
import {
  Archive,
  Download,
  Edit,
  FolderDown,
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

interface StudentWithMemberships {
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
  memberships: Array<{
    id: string
    startDate: Date
    endDate?: Date | null
    subject?: string | null
    notes?: string | null
    attendanceNumber?: number | null
    class: {
      id: string
      name: string
      classCode?: string | null
      subject?: string | null
      isVisible?: boolean
    }
  }>
}

interface ClassWithMemberships {
  id: string
  name: string
  classCode?: string | null
  grade?: number | null
  description?: string | null
  subject?: string | null
  isVisible?: boolean
  memberships: Array<{
    id: string
    startDate: Date
    endDate?: Date | null
    subject?: string | null
    notes?: string | null
    attendanceNumber?: number | null
    student: {
      id: string
      studentId: string
      lastName: string
      firstName: string
      lastNameKana: string
      firstNameKana: string
    }
  }>
}

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
  const [classes, setClasses] = useState<ClassWithMemberships[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterMembershipStatus, setFilterMembershipStatus] =
    useState<string>("all")
  const [filterClassId, setFilterClassId] = useState<string>("all")

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
        const fetchedClasses = await window.electronAPI.fetchClasses()
        setStudents(fetchedStudents || [])
        setClasses(fetchedClasses || [])
      } catch (error) {
        console.error("Failed to fetch data:", error)
      }
    }
    fetchData()
  }, [])

  // 現在所属中かどうかを判定するヘルパー関数
  const isCurrentMembership = (m: { endDate?: Date | null }) => {
    if (!m.endDate) return true
    return new Date(m.endDate) >= new Date()
  }

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const fullName = `${student.lastName} ${student.firstName}`
      const fullNameKana = `${student.lastNameKana} ${student.firstNameKana}`
      const matchesSearch =
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fullNameKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentNumber.toLowerCase().includes(searchTerm.toLowerCase())

      if (filterClassId !== "all") {
        const belongsToClass = student.memberships.some(
          (m) => m.class.id === filterClassId && isCurrentMembership(m)
        )
        if (!belongsToClass) return false
      }

      if (filterMembershipStatus === "current") {
        return (
          matchesSearch &&
          student.memberships.some((m) => isCurrentMembership(m))
        )
      } else if (filterMembershipStatus === "past") {
        return (
          matchesSearch &&
          student.memberships.length > 0 &&
          student.memberships.every((m) => !isCurrentMembership(m))
        )
      } else if (filterMembershipStatus === "unassigned") {
        return matchesSearch && student.memberships.length === 0
      }
      return matchesSearch
    })
  }, [students, searchTerm, filterClassId, filterMembershipStatus])

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
  const filteredIds = useMemo(() => sortedData.map((d) => d.id), [sortedData])

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
        setStudents(students.filter((s) => s.id !== studentId))
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
        students.map((s) => (s.id === updatedStudent.id ? updatedStudent : s))
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
      if (result.success) {
        toast.success(
          `${selectedStudentIds.size}名の生徒データをExcelに出力しました`
        )
      } else if (result.error !== "出力がキャンセルされました") {
        toast.error(`エクスポートに失敗しました: ${result.error}`)
      }
    } catch (error) {
      console.error("Failed to export students:", error)
      toast.error("エクスポート中にエラーが発生しました")
    } finally {
      setIsExporting(false)
    }
  }

  const refreshData = async () => {
    try {
      const fetchedStudents = await window.electronAPI.fetchStudents()
      const fetchedClasses = await window.electronAPI.fetchClasses()
      setStudents(fetchedStudents || [])
      setClasses(fetchedClasses || [])
    } catch (error) {
      console.error("Failed to refresh data:", error)
    }
  }

  const onStudentsImported = (importedStudents: StudentWithMemberships[]) => {
    setStudents((prevStudents) => {
      const existingStudentIds = new Set(prevStudents.map((s) => s.id))
      const newStudents = importedStudents.filter(
        (s) => !existingStudentIds.has(s.id)
      )
      return [...prevStudents, ...newStudents]
    })
  }

  // Get current classes for display
  const getCurrentClasses = (student: StudentWithMemberships) => {
    return student.memberships
      .filter((m) => isCurrentMembership(m))
      .map((m) => ({
        name: m.class.name,
      }))
  }

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Controls */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="border-border/50 bg-card flex flex-wrap items-center gap-4 rounded-xl border p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Search className="text-muted-foreground h-4 w-4" />
            <Input
              placeholder="生徒名・学籍番号で検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-border/50 bg-muted/20 focus:bg-background h-9 w-64 rounded-lg transition-colors"
            />
          </div>
          <Select value={filterClassId} onValueChange={setFilterClassId}>
            <SelectTrigger className="h-9 w-44 rounded-lg">
              <SelectValue placeholder="学級フィルタ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての学級</SelectItem>
              {classes
                .filter((c) => c.isVisible !== false)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
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
              <SelectItem value="current">現在所属中</SelectItem>
              <SelectItem value="past">過去の所属</SelectItem>
              <SelectItem value="unassigned">未所属</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm tabular-nums">
            {selectedStudentIds.size > 0
              ? `${selectedStudentIds.size}名選択中 / `
              : ""}
            {sortedData.length}名
          </span>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleExportExcel}
            variant="outline"
            className="rounded-lg"
            disabled={isExporting || selectedStudentIds.size === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting
              ? "出力中..."
              : `Excel出力${selectedStudentIds.size > 0 ? `(${selectedStudentIds.size})` : ""}`}
          </Button>
          <Button
            onClick={() => setIsArchiveExportDialogOpen(true)}
            variant="outline"
            className="rounded-lg"
            disabled={selectedStudentIds.size === 0}
          >
            <Archive className="mr-2 h-4 w-4" />
            アーカイブ書き出し
            {selectedStudentIds.size > 0 && `(${selectedStudentIds.size})`}
          </Button>
          <Button
            onClick={handleAddNewStudent}
            variant="outline"
            className="rounded-lg"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            生徒追加
          </Button>
          <Button
            onClick={() => setIsArchiveImportModalOpen(true)}
            variant="outline"
            className="rounded-lg"
          >
            <FolderDown className="mr-2 h-4 w-4" />
            アーカイブ読み込み
          </Button>
          <Button
            onClick={() => setIsSpreadsheetImportModalOpen(true)}
            className="rounded-lg"
          >
            <Upload className="mr-2 h-4 w-4" />
            表形式インポート
          </Button>
        </div>
      </div>

      {/* Students Table */}
      <div className="border-border/50 bg-card min-h-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
        <Table wrapperClassName="h-full">
          <TableHeader className="bg-card sticky top-0 z-10 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
            <TableRow className="hover:bg-muted/40">
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
                currentSortKey={sortConfig.key as string | null}
                currentDirection={sortConfig.direction}
                onSort={(key) => requestSort(key as keyof StudentSortable)}
              >
                学籍番号
              </SortableTableHead>
              <SortableTableHead
                sortKey="fullName"
                currentSortKey={sortConfig.key as string | null}
                currentDirection={sortConfig.direction}
                onSort={(key) => requestSort(key as keyof StudentSortable)}
              >
                氏名
              </SortableTableHead>
              <SortableTableHead
                sortKey="enrollmentYear"
                currentSortKey={sortConfig.key as string | null}
                currentDirection={sortConfig.direction}
                onSort={(key) => requestSort(key as keyof StudentSortable)}
              >
                入学年度
              </SortableTableHead>
              <TableHead>所属学級</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map(({ original: student }) => {
              const currentClasses = getCurrentClasses(student)
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
                      {currentClasses.map((cls, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                        >
                          {cls.name}
                        </Badge>
                      ))}
                      {currentClasses.length === 0 && (
                        <span className="text-muted-foreground text-sm">
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
                        className="hover:bg-muted h-8 w-8 rounded-lg transition-colors"
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
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 rounded-lg transition-colors"
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
                  className="text-muted-foreground h-32 text-center"
                >
                  該当する生徒が見つかりません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
