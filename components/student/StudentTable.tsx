"use client"

import { Badge } from "@/components/ui/badge"
import { StudentData } from "@/types/common.types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Edit,
  Info,
  PlusCircle,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import SpreadsheetImportModal from "./SpreadsheetImportModal"
import StudentImportModal from "./StudentImportModal"
import StudentModal from "./StudentModal"

interface StudentWithMemberships {
  id: string
  studentId: string
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

export default function StudentTable() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentWithMemberships[]>([])
  const [classes, setClasses] = useState<ClassWithMemberships[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterMembershipStatus, setFilterMembershipStatus] =
    useState<string>("all")
  const [filterClassId, setFilterClassId] = useState<string>("all")

  // Modal states
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
  const [studentToEdit, setStudentToEdit] =
    useState<StudentWithMemberships | null>(null)
  const [isStudentImportModalOpen, setIsStudentImportModalOpen] =
    useState(false)
  const [isSpreadsheetImportModalOpen, setIsSpreadsheetImportModalOpen] =
    useState(false)

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

  // Filter and sort students
  const filteredStudents = students
    .filter((student) => {
      const fullName = `${student.lastName} ${student.firstName}`
      const fullNameKana = `${student.lastNameKana} ${student.firstNameKana}`
      const matchesSearch =
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fullNameKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchTerm.toLowerCase())

      if (filterClassId !== "all") {
        const belongsToClass = student.memberships.some(
          (m) => m.class.id === filterClassId && !m.endDate,
        )
        if (!belongsToClass) return false
      }

      if (filterMembershipStatus === "current") {
        return matchesSearch && student.memberships.some((m) => !m.endDate)
      } else if (filterMembershipStatus === "past") {
        return (
          matchesSearch &&
          student.memberships.length > 0 &&
          student.memberships.every((m) => m.endDate)
        )
      } else if (filterMembershipStatus === "unassigned") {
        return matchesSearch && student.memberships.length === 0
      }
      return matchesSearch
    })
    .sort((a, b) => {
      // Sort by name
      return `${a.lastName}${a.firstName}`.localeCompare(
        `${b.lastName}${b.firstName}`,
      )
    })

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
      } catch (error) {
        console.error("Failed to delete student:", error)
        alert("生徒の削除に失敗しました。")
      }
    }
  }

  const handleSaveStudent = async (studentData: Partial<StudentData>) => {
    try {
      if (studentToEdit) {
        const updatedStudent = await window.electronAPI.updateStudent(
          studentToEdit.id,
          studentData,
        )
        setStudents(
          students.map((s) =>
            s.id === updatedStudent.id ? updatedStudent : s,
          ),
        )
      } else {
        const newStudent = await window.electronAPI.createStudent(
          studentData as any,
        )
        setStudents([...students, newStudent])
      }
      setIsStudentModalOpen(false)
    } catch (error) {
      console.error("Failed to save student:", error)
      alert("生徒の保存に失敗しました。")
    }
  }

  const onStudentsImported = (importedStudents: StudentWithMemberships[]) => {
    setStudents((prevStudents) => {
      const existingStudentIds = new Set(prevStudents.map((s) => s.id))
      const newStudents = importedStudents.filter(
        (s) => !existingStudentIds.has(s.id),
      )
      return [...prevStudents, ...newStudents]
    })
  }

  // Get current classes for display
  const getCurrentClasses = (student: StudentWithMemberships) => {
    return student.memberships
      .filter((m) => !m.endDate)
      .map((m) => ({
        name: m.class.name,
      }))
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header with Help */}
        <div className="mb-6 flex items-center gap-2">
          <h1 className="text-3xl font-bold">生徒管理</h1>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[450px]" align="start" side="bottom">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <h3 className="text-base font-semibold">
                      生徒管理について
                    </h3>
                  </div>
                  <p className="text-muted-foreground pl-7 text-sm">
                    生徒の基本情報と学級所属状況を一元管理できます。
                  </p>
                </div>

                <div className="space-y-3 pl-7">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                    <strong>複数学級対応システム</strong>
                    <br />
                    生徒は同時に複数のクラスに所属できます。
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>ホームルーム：1年A組</li>
                      <li>英語：E1クラス（習熟度別）</li>
                      <li>数学：M2クラス（習熟度別）</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">主な機能：</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 text-green-600" />
                        <span>個別追加</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-blue-600" />
                        <span>一括インポート</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Edit className="h-4 w-4 text-orange-600" />
                        <span>情報編集</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <span>削除</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                    <strong>ヒント:</strong>{" "}
                    行をクリックすると生徒の詳細ページへ移動します。
                    所属履歴の確認や編集が可能です。
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {/* Students List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="mb-3 flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                生徒一覧 ({filteredStudents.length}名)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>生徒は名前順に表示されます。</p>
                    <p className="mt-1">
                      特定の学級でフィルタすると、その学級での生徒のみが表示されます。
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddNewStudent}
                  size="sm"
                  variant="outline"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  生徒追加
                </Button>
                <Button
                  onClick={() => setIsSpreadsheetImportModalOpen(true)}
                  size="sm"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  表形式インポート
                </Button>
              </div>
            </div>
            {/* Search and Filter Controls */}
            <div className="bg-muted/30 flex flex-wrap items-center gap-3 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Search className="text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="生徒名・学籍番号で検索"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-60"
                />
              </div>
              <Select value={filterClassId} onValueChange={setFilterClassId}>
                <SelectTrigger className="w-44">
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
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="所属状況" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="current">現在所属中</SelectItem>
                  <SelectItem value="past">過去の所属</SelectItem>
                  <SelectItem value="unassigned">未所属</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[500px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>学籍番号</TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>入学年度</TableHead>
                    <TableHead>所属学級</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const currentClasses = getCurrentClasses(student)

                    return (
                      <TableRow
                        key={student.id}
                        onClick={() => router.push(`/students/${student.id}`)}
                        className="hover:bg-muted/50 cursor-pointer"
                      >
                        <TableCell>{student.studentId}</TableCell>
                        <TableCell>
                          {student.lastName} {student.firstName}
                        </TableCell>
                        <TableCell>
                          {student.enrollmentYear || "未設定"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {currentClasses.map((cls, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs"
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
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditStudent(student)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteStudent(student.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        該当する生徒が見つかりません。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Modals */}
        {isStudentModalOpen && (
          <StudentModal
            isOpen={isStudentModalOpen}
            onClose={() => setIsStudentModalOpen(false)}
            onSave={handleSaveStudent as any}
            onUpdate={handleSaveStudent as any}
            studentToEdit={studentToEdit as any}
            availableClasses={classes as any}
          />
        )}

        {isStudentImportModalOpen && (
          <StudentImportModal
            isOpen={isStudentImportModalOpen}
            onClose={() => setIsStudentImportModalOpen(false)}
            onImportSuccess={onStudentsImported as any}
            existingClasses={classes as any}
          />
        )}

        {isSpreadsheetImportModalOpen && (
          <SpreadsheetImportModal
            isOpen={isSpreadsheetImportModalOpen}
            onClose={() => setIsSpreadsheetImportModalOpen(false)}
            onImportSuccess={onStudentsImported}
            existingClasses={classes}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
