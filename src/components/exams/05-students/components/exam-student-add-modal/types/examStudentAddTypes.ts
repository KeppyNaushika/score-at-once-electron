export interface ExamStudentAddModalProps {
  isOpen: boolean
  onClose: () => void
  examId: string
  onStudentsAdded: () => void
}
