"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  PlusCircle, 
  Edit, 
  Trash2, 
  Upload, 
  Users, 
  Clock,
  Search,
  Filter,
  Calendar,
  BookOpen,
  Info
} from "lucide-react"

import ClassModal from "./ClassModal"
import StudentImportModal from "./StudentImportModal"
import SpreadsheetImportModal from "./SpreadsheetImportModal"
import StudentModal from "./StudentModal"
import StudentClassMembershipModal from "./StudentClassMembershipModal"
import StudentMembershipTimeline from "./StudentMembershipTimeline"

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
    membershipType: string
    subject?: string | null
    notes?: string | null
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
    membershipType: string
    subject?: string | null
    notes?: string | null
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

interface Membership {
  id: string
  studentId: string
  classId: string
  startDate: Date
  endDate?: Date | null
  membershipType: string
  subject?: string | null
  notes?: string | null
  student: {
    id: string
    studentId: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
  }
  class: {
    id: string
    name: string
    classCode?: string | null
    subject?: string | null
    isVisible?: boolean
  }
}

export default function StudentManagementTable() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentWithMemberships[]>([])
  const [classes, setClasses] = useState<ClassWithMemberships[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  // filterClassType は削除
  const [filterMembershipStatus, setFilterMembershipStatus] = useState<string>("current")

  // Modal states
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [classToEdit, setClassToEdit] = useState<ClassWithMemberships | null>(null)
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
  const [studentToEdit, setStudentToEdit] = useState<StudentWithMemberships | null>(null)
  const [isStudentImportModalOpen, setIsStudentImportModalOpen] = useState(false)
  const [isSpreadsheetImportModalOpen, setIsSpreadsheetImportModalOpen] = useState(false)
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false)
  const [membershipToEdit, setMembershipToEdit] = useState<Membership | null>(null)

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

  // Filter functions
  const filteredStudents = students.filter((student) => {
    const fullName = `${student.lastName} ${student.firstName}`
    const fullNameKana = `${student.lastNameKana} ${student.firstNameKana}`
    const matchesSearch = 
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fullNameKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filterMembershipStatus === "current") {
      return matchesSearch && student.memberships.some(m => !m.endDate)
    } else if (filterMembershipStatus === "past") {
      return matchesSearch && student.memberships.every(m => m.endDate)
    }
    return matchesSearch
  })

  const filteredClasses = classes.filter((classItem) => {
    const matchesSearch = classItem.name.toLowerCase().includes(searchTerm.toLowerCase())
    const isVisible = classItem.isVisible !== false // デフォルトは表示
    return matchesSearch && isVisible
  })

  // Event handlers
  const handleAddNewClass = () => {
    setClassToEdit(null)
    setIsClassModalOpen(true)
  }

  const handleEditClass = (classItem: ClassWithMemberships) => {
    setClassToEdit(classItem)
    setIsClassModalOpen(true)
  }

  const handleDeleteClass = async (classId: string) => {
    if (window.confirm("本当にこの学級を削除しますか？")) {
      try {
        await window.electronAPI.deleteClass(classId)
        setClasses(classes.filter((c) => c.id !== classId))
      } catch (error) {
        console.error("Failed to delete class:", error)
        alert("学級の削除に失敗しました。")
      }
    }
  }

  const handleSaveClass = async (classData: any) => {
    try {
      if (classToEdit) {
        const updatedClass = await window.electronAPI.updateClass({
          id: classToEdit.id,
          ...classData,
        })
        setClasses(classes.map((c) => (c.id === updatedClass.id ? updatedClass : c)))
      } else {
        const newClass = await window.electronAPI.createClass(classData)
        setClasses([...classes, newClass])
      }
      setIsClassModalOpen(false)
    } catch (error) {
      console.error("Failed to save class:", error)
      alert("学級の保存に失敗しました。")
    }
  }

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
        const updatedStudent = await window.electronAPI.updateStudent(studentToEdit.id, studentData)
        setStudents(students.map((s) => (s.id === updatedStudent.id ? updatedStudent : s)))
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


  const handleEditMembership = (membership: Membership) => {
    setMembershipToEdit(membership)
    setIsMembershipModalOpen(true)
  }

  const handleSaveMembership = async (membershipData: any) => {
    try {
      if (membershipToEdit) {
        await window.electronAPI.updateStudentClassMembership(membershipToEdit.id, membershipData)
      } else {
        await window.electronAPI.addStudentToClass(
          membershipData.studentId,
          membershipData.classId,
          membershipData.startDate,
          membershipData.membershipType,
          membershipData.subject,
          membershipData.notes
        )
      }
      
      // Refresh data
      const fetchedStudents = await window.electronAPI.fetchStudents()
      setStudents(fetchedStudents || [])
      setIsMembershipModalOpen(false)
    } catch (error) {
      console.error("Failed to save membership:", error)
      alert("所属関係の保存に失敗しました。")
    }
  }

  const handleEndMembership = async (membershipId: string) => {
    if (window.confirm("この所属関係を終了しますか？")) {
      try {
        await window.electronAPI.endStudentMembership(membershipId)
        
        // Refresh data
        const fetchedStudents = await window.electronAPI.fetchStudents()
        setStudents(fetchedStudents || [])
      } catch (error) {
        console.error("Failed to end membership:", error)
        alert("所属関係の終了に失敗しました。")
      }
    }
  }

  const onStudentsImported = (importedStudents: StudentWithMemberships[]) => {
    setStudents((prevStudents) => {
      const existingStudentIds = new Set(prevStudents.map((s) => s.id))
      const newStudents = importedStudents.filter((s) => !existingStudentIds.has(s.id))
      return [...prevStudents, ...newStudents]
    })
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">検索</Label>
              <Input
                id="search"
                placeholder="生徒名・学籍番号・学級名で検索"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="membershipStatus">所属状況</Label>
              <Select value={filterMembershipStatus} onValueChange={setFilterMembershipStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">現在所属中</SelectItem>
                  <SelectItem value="past">過去の所属</SelectItem>
                  <SelectItem value="all">すべて</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="students" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="students">生徒管理</TabsTrigger>
          <TabsTrigger value="classes">学級管理</TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Students List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      生徒一覧 ({filteredStudents.length}名)
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <div className="space-y-2">
                            <p className="font-semibold">複数学級対応システム</p>
                            <p>生徒は同時に複数のクラスに所属できます。</p>
                            <p className="text-sm">例：</p>
                            <ul className="text-sm list-disc list-inside">
                              <li>ホームルーム：1年A組</li>
                              <li>英語：E1クラス（習熟度別）</li>
                              <li>数学：M2クラス（習熟度別）</li>
                            </ul>
                            <p className="text-sm mt-2">生徒の詳細画面で所属状況を確認できます。</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button onClick={handleAddNewStudent} size="sm" variant="outline">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        生徒追加
                      </Button>
                      <Button onClick={() => setIsSpreadsheetImportModalOpen(true)} size="sm">
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
                          <TableHead>学籍番号</TableHead>
                          <TableHead>氏名</TableHead>
                          <TableHead>入学年度</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map((student) => (
                            <TableRow
                              key={student.id}
                              onClick={() => router.push(`/students/${student.id}`)}
                              className="cursor-pointer hover:bg-muted/50"
                            >
                              <TableCell>{student.studentId}</TableCell>
                              <TableCell>{student.lastName} {student.firstName}</TableCell>
                              <TableCell>{student.enrollmentYear || "未設定"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1">
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
                        ))}
                        {filteredStudents.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              該当する生徒が見つかりません。
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Student Detail Panel */}
            <div>
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Info className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-medium">生徒をクリックして詳細を表示</p>
                  <p className="text-sm mt-1">各生徒の所属学級や履歴を確認できます</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Classes Tab */}
        <TabsContent value="classes">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Classes List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      学級一覧 ({filteredClasses.length}学級)
                    </CardTitle>
                    <Button onClick={handleAddNewClass} size="sm">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      学級追加
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>学級名・コード</TableHead>
                          <TableHead>学年</TableHead>
                          <TableHead>教科</TableHead>
                          <TableHead>現在の所属数</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredClasses.map((classItem) => (
                          <TableRow
                            key={classItem.id}
                            onClick={() => router.push(`/classes/${classItem.id}`)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{classItem.name}</span>
                                {classItem.classCode && (
                                  <Badge variant="outline" className="text-xs">
                                    {classItem.classCode}
                                  </Badge>
                                )}
                              </div>
                              {classItem.subject && (
                                <span className="text-sm text-muted-foreground">
                                  ({classItem.subject})
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{classItem.grade || "未設定"}</TableCell>
                            <TableCell>
                              {classItem.subject ? (
                                <Badge variant="secondary">{classItem.subject}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">なし</span>
                              )}
                            </TableCell>
                            <TableCell>{classItem.memberships.length}名</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditClass(classItem)
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteClass(classItem.id)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredClasses.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">
                              該当する学級が見つかりません。
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Class Detail Panel */}
            <div>
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-medium">学級をクリックして詳細を表示</p>
                  <p className="text-sm mt-1">所属生徒一覧や学級情報を確認できます</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {isClassModalOpen && (
        <ClassModal
          isOpen={isClassModalOpen}
          onClose={() => setIsClassModalOpen(false)}
          onSave={handleSaveClass}
          classToEdit={classToEdit}
        />
      )}

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

      {isMembershipModalOpen && (
        <StudentClassMembershipModal
          isOpen={isMembershipModalOpen}
          onClose={() => setIsMembershipModalOpen(false)}
          onSave={handleSaveMembership}
          studentId={undefined}
          classId={undefined}
          availableStudents={students.map(s => ({ 
            id: s.id, 
            studentId: s.studentId, 
            lastName: s.lastName,
            firstName: s.firstName,
            lastNameKana: s.lastNameKana,
            firstNameKana: s.firstNameKana
          }))}
          availableClasses={classes as any}
          membershipToEdit={membershipToEdit as any}
        />
      )}
      </div>
    </TooltipProvider>
  )
}