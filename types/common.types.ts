export type Id = string
export type ProjectId = Id // Changed from ExamId
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
  projectId: ProjectId // Changed from examId
  questionId: QuestionId
  sheetId: SheetId
  crop: CropCoords
}

export type ProjectSortField = "examName" | "examDate" // These field names come from Project model in schema
export type SortDirection = "ascending" | "descending" | "none" | null

export interface ProjectSort {
  field: null | ProjectSortField
  sorted: null | SortDirection
}

export interface ClientTag {
  id: string // react-tag-input often prefers string IDs, Prisma's Tag ID is string.
  text: string
}

export interface ProjectListItem {
  // Renamed from ExamListItem
  selected: boolean
  name: string // Corresponds to Project.examName
  date: string // Corresponds to Project.examDate
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
  score: Score // Assuming Score type is defined elsewhere or intended to be
  partialPoints: number | null
  cropTmp: CropCoords
}

export type DragAction = "newAnswerArea" | "addAnswerArea" | "dragAnswerArea"

// Score 型の定義 (仮の定義、必要に応じて調整してください)
export type ScoreStatus =
  | "unscored"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "noanswer"

export interface Score {
  status: ScoreStatus
  points: number | null
  // 必要に応じて他のプロパティを追加
}
