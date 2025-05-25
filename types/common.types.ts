export type Id = string
export type ExamId = Id
export type SheetId = Id
export type QuestionId = Id
export type StudentId = Id

export interface CropCoords {
  top: number
  bottom: number
  left: number
  right: number
}

export interface QuestionTag {
  name: string
  isEnabled: boolean
}

export interface GeneralQuestion {
  tags: [QuestionTag[]] // Consider if this nesting is intended: Tag[][]
  examId: ExamId
  questionId: QuestionId
  sheetId: SheetId
  crop: CropCoords
}

export type ProjectSortField = "examName" | "examDate"
export type SortDirection = "ascending" | "descending" | "none" | null

export interface ProjectSort {
  field: null | ProjectSortField
  sorted: null | SortDirection
}

export interface ClientTag {
  id: string // react-tag-input often prefers string IDs, Prisma's Tag ID is string.
  text: string
}

export interface ExamListItem {
  // Renamed from Exam to avoid conflict and be more descriptive
  selected: boolean
  name: string
  date: string
}

export const MOVES = ["left", "right", "up", "down"] as const
const DIRECTION_TO_MOVE_ANSWER_AREA = [
  "prev",
  "next",
  "prevRow",
  "nextRow",
  "prevColumn",
  "nextColumn",
] as const

export type Move = (typeof MOVES)[number]

export type DirectionToMoveAnswerArea =
  (typeof DIRECTION_TO_MOVE_ANSWER_AREA)[number]

export interface AnswerArea {
  isSelected: boolean
  isShown: boolean
  index: number | null
  studentId: StudentId
  studentName: string
  maxPoints: number
  score: Score
  partialPoints: number | null
  cropTmp: CropCoords
}

export type DragAction = "newAnswerArea" | "addAnswerArea" | "dragAnswerArea"
