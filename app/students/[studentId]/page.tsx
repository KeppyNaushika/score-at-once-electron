"use client"

import StudentClassMembershipModal from "@/components/student/StudentClassMembershipModal"
import StudentMembershipTimeline from "@/components/student/StudentMembershipTimeline"
import StudentModal from "@/components/student/StudentModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  Edit,
  PlusCircle,
  Trash2,
  UserCircle,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

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

export default function StudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const studentId = params.studentId as string

  const [student, setStudent] = useState<StudentWithMemberships | null>(null)
  const [classes, setClasses] = useState<ClassWithMemberships[]>([])
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false)
  const [membershipToEdit, setMembershipToEdit] = useState<Membership | null>(
    null,
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Fetch all students and find the one we need
        const students = await window.electronAPI.fetchStudents()
        const targetStudent = students.find((s) => s.id === studentId)
        if (targetStudent) {
          // Transform the student data to match the expected interface
          const transformedStudent = {
            ...targetStudent,
            memberships: targetStudent.memberships.map((membership: any) => ({
              ...membership,
              membershipType: membership.membershipType || "regular",
              startDate: new Date(membership.startDate || membership.createdAt),
              endDate: membership.endDate ? new Date(membership.endDate) : null,
            })),
          }
          setStudent(transformedStudent)
        }

        // Fetch all classes for membership management
        const fetchedClasses = await window.electronAPI.fetchClasses()
        setClasses(fetchedClasses || [])
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [studentId])

  const handleEditStudent = () => {
    setIsStudentModalOpen(true)
  }

  const handleDeleteStudent = async () => {
    if (
      window.confirm(
        "本当にこの生徒を削除しますか？\nこの操作は取り消すことができません。",
      )
    ) {
      try {
        await window.electronAPI.deleteStudent(studentId)
        router.push("/students")
      } catch (error) {
        console.error("Failed to delete student:", error)
        alert("生徒の削除に失敗しました。")
      }
    }
  }

  const handleSaveStudent = async (studentData: any) => {
    try {
      const updatedStudent = await window.electronAPI.updateStudent(
        studentId,
        studentData,
      )
      // Transform the updated student data to match the expected interface
      const transformedStudent = {
        ...updatedStudent,
        memberships:
          updatedStudent.memberships?.map((membership: any) => ({
            ...membership,
            membershipType: membership.membershipType || "regular",
            startDate: new Date(membership.startDate || membership.createdAt),
            endDate: membership.endDate ? new Date(membership.endDate) : null,
          })) || [],
      }
      setStudent(transformedStudent)
      setIsStudentModalOpen(false)
    } catch (error) {
      console.error("Failed to update student:", error)
      alert("生徒情報の更新に失敗しました。")
    }
  }

  const handleAddMembership = () => {
    setMembershipToEdit(null)
    setIsMembershipModalOpen(true)
  }

  const handleEditMembership = (membership: Membership) => {
    setMembershipToEdit(membership)
    setIsMembershipModalOpen(true)
  }

  const handleSaveMembership = async (membershipData: any) => {
    try {
      if (membershipToEdit) {
        await window.electronAPI.updateStudentClassMembership(
          membershipToEdit.id,
          membershipData,
        )
      } else {
        await window.electronAPI.addStudentToClass(
          studentId,
          membershipData.classId,
        )
      }

      // Refresh student data
      const students = await window.electronAPI.fetchStudents()
      const updatedStudent = students.find((s) => s.id === studentId)
      if (updatedStudent) {
        // Transform the updated student data to match the expected interface
        const transformedStudent = {
          ...updatedStudent,
          memberships:
            updatedStudent.memberships?.map((membership: any) => ({
              ...membership,
              membershipType: membership.membershipType || "regular",
              startDate: new Date(membership.startDate || membership.createdAt),
              endDate: membership.endDate ? new Date(membership.endDate) : null,
            })) || [],
        }
        setStudent(transformedStudent)
      }
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

        // Refresh student data
        const students = await window.electronAPI.fetchStudents()
        const updatedStudent = students.find((s) => s.id === studentId)
        if (updatedStudent) {
          // Transform the updated student data to match the expected interface
          const transformedStudent = {
            ...updatedStudent,
            memberships:
              updatedStudent.memberships?.map((membership: any) => ({
                ...membership,
                membershipType: membership.membershipType || "regular",
                startDate: new Date(
                  membership.startDate || membership.createdAt,
                ),
                endDate: membership.endDate
                  ? new Date(membership.endDate)
                  : null,
              })) || [],
          }
          setStudent(transformedStudent)
        }
      } catch (error) {
        console.error("Failed to end membership:", error)
        alert("所属関係の終了に失敗しました。")
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-4">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <UserCircle className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="mb-2 text-lg font-medium">生徒が見つかりません</p>
            <p className="text-muted-foreground mb-4 text-sm">
              指定された生徒が存在しないか、削除されています。
            </p>
            <Button onClick={() => router.push("/students")} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              生徒一覧に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentMemberships = student.memberships.filter((m) => !m.endDate)
  const pastMemberships = student.memberships.filter((m) => m.endDate)

  return (
    <div className="container mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          onClick={() => router.push("/students")}
          variant="ghost"
          size="sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          生徒一覧に戻る
        </Button>
      </div>

      {/* Student Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">
                {student.lastName} {student.firstName}
                <span className="text-muted-foreground ml-4 text-lg">
                  {student.lastNameKana} {student.firstNameKana}
                </span>
              </CardTitle>
              <div className="mt-2 space-y-1">
                <p className="text-muted-foreground">
                  学籍番号:{" "}
                  <span className="font-mono">{student.studentId}</span>
                </p>
                {student.enrollmentYear && (
                  <p className="text-muted-foreground">
                    入学年度: {student.enrollmentYear}年
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleEditStudent} variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                編集
              </Button>
              <Button onClick={handleDeleteStudent} variant="outline" size="sm">
                <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                削除
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Current Memberships */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              現在の所属学級
            </CardTitle>
            <Button onClick={handleAddMembership} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              所属追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {currentMemberships.length > 0 ? (
            <div className="space-y-3">
              {currentMemberships.map((membership) => (
                <div key={membership.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h4 className="text-lg font-medium">
                          {membership.class.name}
                        </h4>
                        {membership.class.classCode && (
                          <Badge variant="outline">
                            {membership.class.classCode}
                          </Badge>
                        )}
                        {membership.class.subject && (
                          <Badge variant="secondary">
                            {membership.class.subject}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground space-y-1 text-sm">
                        <p className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          開始日:{" "}
                          {new Date(membership.startDate).toLocaleDateString(
                            "ja-JP",
                          )}
                        </p>
                        {membership.notes && (
                          <p className="bg-muted rounded p-2">
                            {membership.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const membershipWithIds: Membership = {
                            ...membership,
                            studentId: student.id,
                            classId: membership.class.id,
                            student: {
                              id: student.id,
                              studentId: student.studentId,
                              lastName: student.lastName,
                              firstName: student.firstName,
                              lastNameKana: student.lastNameKana,
                              firstNameKana: student.firstNameKana,
                            },
                          }
                          handleEditMembership(membershipWithIds)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEndMembership(membership.id)}
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              <BookOpen className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>現在所属している学級はありません</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Membership History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            所属履歴
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StudentMembershipTimeline
            memberships={student.memberships.map((m) => ({
              ...m,
              studentId: student.id,
              classId: m.class.id,
              student: {
                id: student.id,
                studentId: student.studentId,
                lastName: student.lastName,
                firstName: student.firstName,
                lastNameKana: student.lastNameKana,
                firstNameKana: student.firstNameKana,
              },
            }))}
            onEditMembership={handleEditMembership}
            onEndMembership={handleEndMembership}
            showActions={true}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      {isStudentModalOpen && (
        <StudentModal
          isOpen={isStudentModalOpen}
          onClose={() => setIsStudentModalOpen(false)}
          onSave={() => {}} // Not used for editing
          onUpdate={handleSaveStudent}
          studentToEdit={student as any}
          availableClasses={classes as any}
        />
      )}

      {isMembershipModalOpen && (
        <StudentClassMembershipModal
          isOpen={isMembershipModalOpen}
          onClose={() => setIsMembershipModalOpen(false)}
          onSave={handleSaveMembership}
          studentId={student.id}
          classId={undefined}
          availableStudents={[
            {
              id: student.id,
              studentId: student.studentId,
              lastName: student.lastName,
              firstName: student.firstName,
              lastNameKana: student.lastNameKana,
              firstNameKana: student.firstNameKana,
            },
          ]}
          availableClasses={classes as any}
          membershipToEdit={membershipToEdit as any}
        />
      )}
    </div>
  )
}
