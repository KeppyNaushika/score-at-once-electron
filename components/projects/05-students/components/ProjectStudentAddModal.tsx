"use client"

import { ProjectStudentAddModalContainer } from "@/components/projects/05-students/components/project-student-add-modal/components/ProjectStudentAddModalContainer"
import type { ProjectStudentAddModalProps } from "@/components/projects/05-students/components/project-student-add-modal/types/projectStudentAddTypes"

export default function ProjectStudentAddModal(
  props: ProjectStudentAddModalProps
) {
  return <ProjectStudentAddModalContainer {...props} />
}
