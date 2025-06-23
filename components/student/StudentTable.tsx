"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Edit, Info, PlusCircle, Search, Trash2, Upload, Users } from "lucide-react"
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
  const [filterMembershipStatus, setFilterMembershipStatus] = useState<string>("all")
  const [filterClassId, setFilterClassId] = useState<string>("all")

  // Modal states
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
  const [studentToEdit, setStudentToEdit] = useState<StudentWithMemberships | null>(null)
  const [isStudentImportModalOpen, setIsStudentImportModalOpen] = useState(false)
  const [isSpreadsheetImportModalOpen, setIsSpreadsheetImportModalOpen] = useState(false)

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

  // Get current attendance number for a student in a specific class
  const getAttendanceNumber = (student: StudentWithMemberships, classId?: string): number | null => {
    if (!classId || classId === "all") {
      // Get attendance number from the first current membership
      const currentMembership = student.memberships.find(m => !m.endDate)
      return currentMembership?.attendanceNumber || null
    }
    const membership = student.memberships.find(
      m => m.class.id === classId && !m.endDate
    )
    return membership?.attendanceNumber || null
  }

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
          m => m.class.id === filterClassId && !m.endDate
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
      // Sort by attendance number first, then by name
      const aNumber = getAttendanceNumber(a, filterClassId)
      const bNumber = getAttendanceNumber(b, filterClassId)
      
      if (aNumber !== null && bNumber !== null) {
        return aNumber - bNumber
      }
      if (aNumber !== null) return -1
      if (bNumber !== null) return 1
      
      // If no attendance numbers, sort by name
      return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
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

  const handleSaveStudent = async (studentData: any) => {
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
        const newStudent = await window.electronAPI.createStudent(studentData)
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
      .filter(m => !m.endDate)
      .map(m => ({
        name: m.class.name,
        attendanceNumber: m.attendanceNumber
      }))
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Search and Filter Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              検索・フィルタ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="search">検索</Label>
                <Input
                  id="search"
                  placeholder="生徒名・学籍番号で検索"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filterClass">学級フィルタ</Label>
                <Select
                  value={filterClassId}
                  onValueChange={setFilterClassId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての学級</SelectItem>
                    {classes
                      .filter(c => c.isVisible !== false)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="membershipStatus">所属状況</Label>
                <Select
                  value={filterMembershipStatus}
                  onValueChange={setFilterMembershipStatus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="current">現在所属中</SelectItem>
                    <SelectItem value="past">過去の所属</SelectItem>
                    <SelectItem value="unassigned">未所属</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Students List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                生徒一覧 ({filteredStudents.length}名)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>生徒は出席番号順に表示されます。</p>
                    <p className="mt-1">特定の学級でフィルタすると、その学級での出席番号順になります。</p>
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
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">出席番号</TableHead>
                    <TableHead>学籍番号</TableHead>
                    <TableHead>氏名</TableHead>
                    <TableHead>入学年度</TableHead>
                    <TableHead>所属学級</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const attendanceNumber = getAttendanceNumber(student, filterClassId)
                    const currentClasses = getCurrentClasses(student)
                    
                    return (
                      <TableRow
                        key={student.id}
                        onClick={() => router.push(`/students/${student.id}`)}
                        className="hover:bg-muted/50 cursor-pointer"
                      >
                        <TableCell className="font-medium">
                          {attendanceNumber || "-"}
                        </TableCell>
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
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {cls.name}
                                {cls.attendanceNumber && ` (${cls.attendanceNumber}番)`}
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
                          <div className="flex gap-1 justify-end">
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
                      <TableCell colSpan={6} className="text-center">
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
            onSave={handleSaveStudent}
            onUpdate={handleSaveStudent}
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