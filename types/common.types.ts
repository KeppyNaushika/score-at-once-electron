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
}

export const LAYOUT_REAGION_AREA_TYPES = [
  "QUESTION_ANSWER",
  "STUDENT_NAME",
  "STUDENT_ID",
  "TOTAL_SCORE",
  "SUBTOTAL_SCORE",
  "MARK",
  "COMMENT",
  "OTHER",
] as const

export type LayoutRegionAreaType = (typeof LAYOUT_REAGION_AREA_TYPES)[number]

export interface LayoutRegionArea {
  id?: string
  projectId?: string
  masterImageId?: string
  label: string
  type: LayoutRegionAreaType
  x: number
  y: number
  width: number
  height: number
  questionNumber?: string | null
  points?: number | string | null
  createdAt?: Date
  updatedAt?: Date
}

export type EditableTableRow = Record<string, string | number | boolean | null>

export interface EditableTableColumn<T extends EditableTableRow> {
  id: keyof T
  header: string
  getValue: () => T[keyof T]
  row: T
  column: {
    id: keyof T
    header: string
  }
  table: {
    data: T[]
    columns: EditableTableColumn<T>[]
  }
}

export interface ProjectWithDetails {
  id: string
  examName: string
  examDate: Date | null
  subject?: string
  description?: string
  userId: string
  createdAt: Date
  updatedAt: Date
  masterImages?: MasterImageData[]
  layoutRegions?: LayoutRegionArea[]
  answerSheets?: AnswerSheetData[]
  tags?: TagData[]
  projectStudents?: ProjectStudentData[]
}

export interface ProjectStudentData {
  id: string
  projectId: string
  studentId: string
  status: string
  customOrder: number | null
  createdAt: Date
  updatedAt: Date
}

export interface MasterImageData {
  id: string
  projectId: string
  path: string
  pageNumber: number
  createdAt: Date
  updatedAt: Date
}

export interface AnswerSheetData {
  id: string
  projectId: string
  studentId?: string
  pageNumber: number
  originalImagePath: string
  processedImagePath?: string
  scoredPdfPath?: string
  isScored: boolean
  totalScore?: number
  isAbsent: boolean
  createdAt: Date
  updatedAt: Date
  version: number
  questionScores?: QuestionScoreData[]
}

export interface QuestionScoreData {
  id: string
  answerSheetId: string
  layoutRegionId: string
  partialScore: string | null
  status: string
  comment?: string
  scoredByUserId: string
  scoreVersion: number
  createdAt: Date
  updatedAt: Date
}

export interface TagData {
  id: string
  text: string
}

export interface StudentData {
  id: string
  studentId: string
  name: string
  furigana?: string
  admissionYear?: number
  createdAt: Date
  updatedAt: Date
}

export interface LayoutRegionCreateData {
  projectId: string
  masterImageId?: string
  label: string
  type:
    | "QUESTION_ANSWER"
    | "STUDENT_NAME"
    | "STUDENT_ID"
    | "TOTAL_SCORE"
    | "SUBTOTAL_SCORE"
    | "MARK"
    | "COMMENT"
    | "OTHER"
  x: number
  y: number
  width: number
  height: number
  questionNumber?: string
  points?: number
}

export interface LayoutRegionUpdateData {
  label?: string
  type?:
    | "QUESTION_ANSWER"
    | "STUDENT_NAME"
    | "STUDENT_ID"
    | "TOTAL_SCORE"
    | "SUBTOTAL_SCORE"
    | "MARK"
    | "COMMENT"
    | "OTHER"
  x?: number
  y?: number
  width?: number
  height?: number
  questionNumber?: string
  points?: number
}

export interface QuestionScoreCreateData {
  answerSheetId: string
  layoutRegionId: string
  partialScore?: number | null  // Decimal型をnumberとして扱う
  comment?: string
  scoredByUserId: string
  status?: string
}

export interface QuestionScoreUpdateData {
  partialScore?: number | null  // Decimal型をnumberとして扱う
  comment?: string
  status?: string
}

export interface ScoringMarkConfig {
  position:
    | "top-left"
    | "top-center"
    | "top-right"
    | "center-left"
    | "center"
    | "center-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"
  size: number
  showCorrect: boolean
  showIncorrect: boolean
  showPartial: boolean
}
