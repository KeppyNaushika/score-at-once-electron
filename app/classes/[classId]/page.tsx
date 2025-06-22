"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  ArrowLeft,
  Edit, 
  Trash2, 
  BookOpen,
  Users,
  GraduationCap,
  Info,
  PlusCircle,
  UserCircle,
  Calendar,
  Clock
} from "lucide-react"
import ClassModal from "@/components/student/ClassModal"
import StudentClassMembershipModal from "@/components/student/StudentClassMembershipModal"

interface StudentWithMemberships {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
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

export default function ClassDetailPage() {
  const params = useParams()
  const router = useRouter()
  const classId = params.classId as string
  
  const [classData, setClassData] = useState<ClassWithMemberships | null>(null)
  const [students, setStudents] = useState<StudentWithMemberships[]>([])
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false)
  const [membershipToEdit, setMembershipToEdit] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Fetch all classes and find the one we need
        const classes = await window.electronAPI.fetchClasses()
        const targetClass = classes.find(c => c.id === classId)
        if (targetClass) {
          setClassData(targetClass)
        }
        
        // Fetch all students for membership management
        const fetchedStudents = await window.electronAPI.fetchStudents()
        setStudents(fetchedStudents || [])
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [classId])

  const handleEditClass = () => {
    setIsClassModalOpen(true)
  }

  const handleDeleteClass = async () => {
    if (classData?.memberships.filter(m => !m.endDate).length) {
      alert("現在所属している生徒がいるため、この学級を削除できません。\n先に生徒の所属を解除してください。")
      return
    }
    
    if (window.confirm("本当にこの学級を削除しますか？\nこの操作は取り消すことができません。")) {
      try {
        await window.electronAPI.deleteClass(classId)
        router.push("/students")
      } catch (error) {
        console.error("Failed to delete class:", error)
        alert("学級の削除に失敗しました。")
      }
    }
  }

  const handleSaveClass = async (classInfo: any) => {
    try {
      const updatedClass = await window.electronAPI.updateClass({
        id: classId,
        ...classInfo
      })
      setClassData(updatedClass)
      setIsClassModalOpen(false)
    } catch (error) {
      console.error("Failed to update class:", error)
      alert("学級情報の更新に失敗しました。")
    }
  }

  const handleAddMembership = () => {
    setMembershipToEdit(null)
    setIsMembershipModalOpen(true)
  }

  const handleEditMembership = (membership: any) => {
    const membershipWithIds: Membership = {
      ...membership,
      studentId: membership.student.id,
      classId: classId,
      class: {
        id: classId,
        name: classData?.name || '',
        classCode: classData?.classCode,
        subject: classData?.subject,
        isVisible: classData?.isVisible
      }
    }
    setMembershipToEdit(membershipWithIds)
    setIsMembershipModalOpen(true)
  }

  const handleSaveMembership = async (membershipData: any) => {
    try {
      if (membershipToEdit) {
        await window.electronAPI.updateStudentClassMembership(membershipToEdit.id, membershipData)
      } else {
        await window.electronAPI.addStudentToClass(
          membershipData.studentId,
          classId,
          membershipData.startDate,
          membershipData.membershipType,
          membershipData.subject || classData?.subject,
          membershipData.notes
        )
      }
      
      // Refresh class data
      const classes = await window.electronAPI.fetchClasses()
      const updatedClass = classes.find(c => c.id === classId)
      if (updatedClass) {
        setClassData(updatedClass)
      }
      setIsMembershipModalOpen(false)
    } catch (error) {
      console.error("Failed to save membership:", error)
      alert("所属関係の保存に失敗しました。")
    }
  }

  const handleEndMembership = async (membershipId: string) => {
    if (window.confirm("この生徒の所属を終了しますか？")) {
      try {
        await window.electronAPI.endStudentMembership(membershipId)
        
        // Refresh class data
        const classes = await window.electronAPI.fetchClasses()
        const updatedClass = classes.find(c => c.id === classId)
        if (updatedClass) {
          setClassData(updatedClass)
        }
      } catch (error) {
        console.error("Failed to end membership:", error)
        alert("所属関係の終了に失敗しました。")
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!classData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">学級が見つかりません</p>
            <p className="text-sm text-muted-foreground mb-4">指定された学級が存在しないか、削除されています。</p>
            <Button onClick={() => router.push("/students")} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              生徒・学級管理に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentMembers = classData.memberships.filter(m => !m.endDate)
  const pastMembers = classData.memberships.filter(m => m.endDate)

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Button onClick={() => router.push("/students")} variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          生徒・学級管理に戻る
        </Button>
      </div>

      {/* Class Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-2xl">{classData.name}</CardTitle>
                {classData.classCode && (
                  <Badge variant="outline" className="text-lg px-3">
                    {classData.classCode}
                  </Badge>
                )}
                {classData.subject && (
                  <Badge variant="secondary" className="text-lg px-3">
                    {classData.subject}
                  </Badge>
                )}
                {!classData.isVisible && (
                  <Badge variant="destructive">非表示</Badge>
                )}
              </div>
              <div className="space-y-1">
                {classData.grade && (
                  <p className="text-muted-foreground flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    {classData.grade}年生
                  </p>
                )}
                {classData.description && (
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    {classData.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleEditClass} variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                編集
              </Button>
              <Button onClick={handleDeleteClass} variant="outline" size="sm">
                <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                削除
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{currentMembers.length}</p>
              <p className="text-sm text-muted-foreground">現在の生徒数</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{classData.memberships.length}</p>
              <p className="text-sm text-muted-foreground">累計生徒数</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{pastMembers.length}</p>
              <p className="text-sm text-muted-foreground">過去の生徒数</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Members */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              現在の所属生徒 ({currentMembers.length}名)
            </CardTitle>
            <Button onClick={handleAddMembership} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              生徒追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {currentMembers.length > 0 ? (
            <div className="space-y-2">
              {currentMembers.map((membership) => (
                <div 
                  key={membership.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div 
                    className="flex-1 cursor-pointer" 
                    onClick={() => router.push(`/students/${membership.student.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <UserCircle className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {membership.student.lastName} {membership.student.firstName}
                          <span className="ml-2 text-sm text-muted-foreground">
                            ({membership.student.studentId})
                          </span>
                        </p>
                        <div className="text-xs text-muted-foreground flex items-center gap-4 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(membership.startDate).toLocaleDateString('ja-JP')}から
                          </span>
                          {membership.notes && (
                            <span className="italic">{membership.notes}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditMembership(membership)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEndMembership(membership.id)
                      }}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>現在所属している生徒はいません</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Members */}
      {pastMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              過去の所属生徒 ({pastMembers.length}名)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastMembers.map((membership) => (
                <div 
                  key={membership.id} 
                  className="flex items-center justify-between p-3 border rounded-lg opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => router.push(`/students/${membership.student.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <UserCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {membership.student.lastName} {membership.student.firstName}
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({membership.student.studentId})
                        </span>
                      </p>
                      <div className="text-xs text-muted-foreground flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(membership.startDate).toLocaleDateString('ja-JP')} 〜 
                          {membership.endDate && new Date(membership.endDate).toLocaleDateString('ja-JP')}
                        </span>
                        {membership.notes && (
                          <span className="italic">{membership.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {isClassModalOpen && (
        <ClassModal
          isOpen={isClassModalOpen}
          onClose={() => setIsClassModalOpen(false)}
          onSave={handleSaveClass}
          classToEdit={classData}
        />
      )}

      {isMembershipModalOpen && (
        <StudentClassMembershipModal
          isOpen={isMembershipModalOpen}
          onClose={() => setIsMembershipModalOpen(false)}
          onSave={handleSaveMembership}
          studentId={undefined}
          classId={classId}
          availableStudents={students.map(s => ({
            id: s.id,
            studentId: s.studentId,
            lastName: s.lastName,
            firstName: s.firstName,
            lastNameKana: s.lastNameKana,
            firstNameKana: s.firstNameKana
          }))}
          availableClasses={[classData] as any}
          membershipToEdit={membershipToEdit as any}
        />
      )}
    </div>
  )
}