"use client"

import type { StudentClassMembership } from "@prisma/client"
import { ArrowLeft, BarChart3, Edit, Trash2, Users } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

import { ExamResultsCard } from "@/app/students/[studentId]/components/ExamResultsCard"
import { ExamSummaryCards } from "@/app/students/[studentId]/components/ExamSummaryCards"
import {
  LoadingState,
  StudentNotFoundState,
} from "@/app/students/[studentId]/components/LoadingState"
import { MembershipsCard } from "@/app/students/[studentId]/components/MembershipsCard"
import { ScoreTrendChart } from "@/app/students/[studentId]/components/ScoreTrendChart"
import { TagAnalyticsCard } from "@/app/students/[studentId]/components/TagAnalyticsCard"
import { useStudentDetail } from "@/app/students/[studentId]/hooks/useStudentDetail"
import { useStudentExamResults } from "@/app/students/[studentId]/hooks/useStudentExamResults"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import PageHeader from "@/components/layout/PageHeader"
import StudentClassMembershipModal from "@/components/student/StudentClassMembershipModal"
import StudentModal from "@/components/student/StudentModal"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { StudentClassMembershipWithDetails } from "@/types/prismaExtensions"

export default function StudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const studentId = typeof params.studentId === "string" ? params.studentId : ""

  const {
    student,
    classes,
    loading,
    handleEditStudent,
    handleDeleteStudent,
    handleSaveMembership,
    handleEndMembership,
  } = useStudentDetail(studentId)

  const { results: examResults, loading: examResultsLoading } =
    useStudentExamResults(studentId)

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false)
  const [membershipToEdit, setMembershipToEdit] =
    useState<StudentClassMembershipWithDetails | null>(null)

  const handleEditStudentClick = () => {
    setIsStudentModalOpen(true)
  }

  const handleSaveStudentData = async (
    _id: string,
    studentData: Record<string, unknown>
  ) => {
    const success = await handleEditStudent(studentData)
    if (success) {
      setIsStudentModalOpen(false)
    }
  }

  const handleAddMembership = () => {
    setMembershipToEdit(null)
    setIsMembershipModalOpen(true)
  }

  const handleEditMembership = (
    membership: StudentClassMembershipWithDetails
  ) => {
    setMembershipToEdit(membership)
    setIsMembershipModalOpen(true)
  }

  const handleSaveMembershipData = async (
    membershipData: Partial<StudentClassMembership> & { classroomId: string }
  ) => {
    const success = await handleSaveMembership(membershipData, membershipToEdit)
    if (success) {
      setIsMembershipModalOpen(false)
    }
  }

  if (loading) {
    return <LoadingState />
  }

  if (!student) {
    return <StudentNotFoundState />
  }

  const studentName = `${student.lastName} ${student.firstName}`

  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col">
        <PageHeader
          title={studentName}
          subtitle={
            <>
              <span className="text-muted-foreground">
                {student.lastNameKana} {student.firstNameKana}
              </span>
              <span className="bg-muted/50 rounded px-2 py-0.5 font-mono text-xs">
                {student.studentNumber}
              </span>
              {student.enrollmentYear && (
                <span className="bg-muted/50 rounded px-2 py-0.5 text-xs tabular-nums">
                  {student.enrollmentYear}年入学
                </span>
              )}
            </>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg"
            onClick={() => router.push("/students")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Button>
          <Button
            onClick={handleEditStudentClick}
            variant="outline"
            className="rounded-lg"
          >
            <Edit className="mr-2 h-4 w-4" />
            編集
          </Button>
          <Button
            onClick={handleDeleteStudent}
            variant="ghost"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            削除
          </Button>
        </PageHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="container mx-auto max-w-6xl px-6 py-6">
            <Tabs defaultValue="analytics">
              <TabsList className="mb-6 w-full">
                <TabsTrigger value="analytics" className="flex-1">
                  <BarChart3 className="mr-1.5 h-4 w-4" />
                  成績分析
                </TabsTrigger>
                <TabsTrigger value="membership" className="flex-1">
                  <Users className="mr-1.5 h-4 w-4" />
                  学級所属
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analytics">
                {examResultsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <>
                    <ExamSummaryCards results={examResults} />
                    <ScoreTrendChart results={examResults} />
                    <TagAnalyticsCard results={examResults} />
                    <ExamResultsCard results={examResults} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="membership">
                <MembershipsCard
                  student={student}
                  onAddMembership={handleAddMembership}
                  onEditMembership={handleEditMembership}
                  onEndMembership={handleEndMembership}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Modals */}
        {isStudentModalOpen && (
          <StudentModal
            isOpen={isStudentModalOpen}
            onClose={() => setIsStudentModalOpen(false)}
            onSave={() => {}} // Not used for editing
            onUpdate={handleSaveStudentData}
            studentToEdit={student}
          />
        )}

        {isMembershipModalOpen && (
          <StudentClassMembershipModal
            isOpen={isMembershipModalOpen}
            onClose={() => setIsMembershipModalOpen(false)}
            onSave={handleSaveMembershipData}
            studentId={student.id}
            classroomId={undefined}
            availableStudents={[
              {
                id: student.id,
                studentNumber: student.studentNumber,
                lastName: student.lastName,
                firstName: student.firstName,
                lastNameKana: student.lastNameKana,
                firstNameKana: student.firstNameKana,
              },
            ]}
            availableClasses={classes}
            membershipToEdit={membershipToEdit}
          />
        )}
      </div>
    </ProtectedRoute>
  )
}
