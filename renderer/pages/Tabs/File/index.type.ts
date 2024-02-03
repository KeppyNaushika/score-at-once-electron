export type Field = "name" | "date"
export type Sorted = "ascending" | "descending"

export interface ExamSort {
  field: null | Field
  sorted: null | Sorted
}

export interface Exam {
  selected: boolean
  name: string
  date: string
}
