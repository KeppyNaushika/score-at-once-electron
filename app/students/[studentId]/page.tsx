"use client"

import type { StudentClassMembership } from "@prisma/client"
import { useParams } from "next/navigation"
import { useState } from "react"

import { CurrentMembershipsCard } from "@/app/students/[studentId]/components/CurrentMembershipsCard"
import { ExamResultsCard } from "@/app/students/[studentId]/components/ExamResultsCard"
import {
  LoadingState,
  StudentNotFoundState,
} from "@/app/students/[studentId]/components/LoadingState"
import { MembershipHistoryCard } from "@/app/students/[studentId]/components/MembershipHistoryCard"
import { StudentDetailHeader } from "@/app/students/[studentId]/components/StudentDetailHeader"
import { StudentInfoCard } from "@/app/students/[studentId]/components/StudentInfoCard"
import { useStudentDetail } from "@/app/students/[studentId]/hooks/useStudentDetail"
import StudentClassMembershipModal from "@/components/student/StudentClassMembershipModal"
import StudentModal from "@/components/student/StudentModal"
import type { StudentClassMembershipWithDetails } from "@/types/prismaExtensions"

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
  )
}
