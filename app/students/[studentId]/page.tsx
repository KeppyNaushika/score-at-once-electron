"use client"

import { CurrentMembershipsCard } from "@/app/students/[studentId]/components/current-memberships-card"
import { ExamResultsCard } from "@/app/students/[studentId]/components/exam-results-card"
import {
  LoadingState,
  StudentNotFoundState,
} from "@/app/students/[studentId]/components/loading-state"
import { MembershipHistoryCard } from "@/app/students/[studentId]/components/membership-history-card"
import { StudentDetailHeader } from "@/app/students/[studentId]/components/student-detail-header"
import { StudentInfoCard } from "@/app/students/[studentId]/components/student-info-card"
import { useStudentDetail } from "@/app/students/[studentId]/hooks/useStudentDetail"
import { Membership } from "@/app/students/[studentId]/types"
import StudentClassMembershipModal from "@/components/student/StudentClassMembershipModal"
import StudentModal from "@/components/student/StudentModal"
import type { StudentClassMembership } from "@prisma/client"
import { useParams } from "next/navigation"
import { useState } from "react"

export default function StudentDetailPage() {
  const params = useParams()
  const studentId = params.studentId as string

  const {
    student,
    classes,
    loading,
    handleEditStudent,
    handleDeleteStudent,
    handleSaveMembership,
    handleEndMembership,
  } = useStudentDetail(studentId)

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false)
  const [membershipToEdit, setMembershipToEdit] = useState<Membership | null>(
    null
  )

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

  const handleEditMembership = (membership: Membership) => {
    setMembershipToEdit(membership)
    setIsMembershipModalOpen(true)
  }

  const handleSaveMembershipData = async (
    membershipData: Partial<StudentClassMembership> & { classId: string }
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

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <StudentDetailHeader />

      <StudentInfoCard
        student={student}
        onEditStudent={handleEditStudentClick}
        onDeleteStudent={handleDeleteStudent}
      />

      <ExamResultsCard studentId={studentId} />

      <CurrentMembershipsCard
        student={student}
        onAddMembership={handleAddMembership}
        onEditMembership={handleEditMembership}
        onEndMembership={handleEndMembership}
      />

      <MembershipHistoryCard
        student={student}
        onEditMembership={handleEditMembership}
        onEndMembership={handleEndMembership}
      />

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
          availableClasses={classes}
          membershipToEdit={membershipToEdit}
        />
      )}
    </div>
  )
}
