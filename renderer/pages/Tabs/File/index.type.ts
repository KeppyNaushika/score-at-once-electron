export type Field = "examName" | "examDate"
export type Sorted = "ascending" | "descending"

export interface ExamSort {
  field: null | Field
  sorted: null | Sorted
}

export interface Project {
  id: number
  projectId: string
  examName: string
  examDate: Date
  selected: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Tag {
  id: number
  name: string
  color: string
  projects: Project[]
}

export interface Exam {
  selected: boolean
  name: string
  date: string
}
